const IS_LOGGED_IN = document.getElementById("isLoggedIn").value === "true";
mapboxgl.accessToken = MAPBOX_TOKEN;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [0, 0],
  zoom: 2,
});

map.addControl(new mapboxgl.NavigationControl());

const geolocate = new mapboxgl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true,
  showUserHeading: true,
});

map.addControl(geolocate);

// ─── Scan radius circle helpers ──────────────────────────────────────────────
function createCircleGeoJSON(lon, lat, radiusMeters) {
  const points = 64;
  const km = radiusMeters / 1000;
  const distLat = km / 111.32;
  const distLon = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const coords = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    coords.push([
      lon + distLon * Math.cos(angle),
      lat + distLat * Math.sin(angle),
    ]);
  }
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [coords] },
      },
    ],
  };
}

const emptyGeoJSON = { type: "FeatureCollection", features: [] };

function initScanCircleLayers() {
  map.addSource("scan-circle-user", { type: "geojson", data: emptyGeoJSON });
  map.addLayer({
    id: "scan-circle-user-fill",
    type: "fill",
    source: "scan-circle-user",
    paint: { "fill-color": "#2196F3", "fill-opacity": 0.10 },
  });
  map.addLayer({
    id: "scan-circle-user-border",
    type: "line",
    source: "scan-circle-user",
    paint: { "line-color": "#2196F3", "line-width": 2, "line-opacity": 0.65 },
  });

  map.addSource("scan-circle-custom", { type: "geojson", data: emptyGeoJSON });
  map.addLayer({
    id: "scan-circle-custom-fill",
    type: "fill",
    source: "scan-circle-custom",
    paint: { "fill-color": "#2196F3", "fill-opacity": 0.10 },
  });
  map.addLayer({
    id: "scan-circle-custom-border",
    type: "line",
    source: "scan-circle-custom",
    paint: { "line-color": "#2196F3", "line-width": 2, "line-opacity": 0.65 },
  });
}

function updateUserScanCircle() {
  if (!map.getSource("scan-circle-user") || lastKnownLat === null) return;
  map.getSource("scan-circle-user").setData(
    createCircleGeoJSON(lastKnownLon, lastKnownLat, pingRadius)
  );
}

function updateCustomScanCircle() {
  if (!map.getSource("scan-circle-custom")) return;
  if (customScanLon === null) {
    map.getSource("scan-circle-custom").setData(emptyGeoJSON);
  } else {
    map.getSource("scan-circle-custom").setData(
      createCircleGeoJSON(customScanLon, customScanLat, pingRadius)
    );
  }
}
// ─────────────────────────────────────────────────────────────────────────────

map.on("load", () => {
  initScanCircleLayers();
  geolocate.trigger();
});

// Radius panel state
let pingRadius = 500;
let transitExpansion = 1;
let secondaryPingRadius = 100;
let currentMarkers = [];
let relayMarkers = [];
let relayTimeouts = [];
let relayStoreLocations = [];
let addedStoreIds = new Set();
let relayAddedStoreIds = new Set(); // tracks which IDs relay added, so clearRelayMarkers can undo them
let groceryStoreLocations = [];
let relayGeneration = 0; // incremented each time runRelay starts; stale runs are discarded
let lastKnownLon = null;
let lastKnownLat = null;

// ─── Separate bus / skytrain flags (replaces the old single stopsEnabled) ────
let busEnabled = false;
let skytrainEnabled = false;
let relayEnabled = false;

function clearMarkers() {
  currentMarkers.forEach((m) => m.remove());
  currentMarkers = [];
  groceryStoreLocations = [];
}

function clearRelayMarkers() {
  relayMarkers.forEach((m) => m.remove());
  relayMarkers = [];
  relayTimeouts.forEach((t) => clearTimeout(t));
  relayTimeouts = [];
  relayStoreLocations = [];
  // Remove IDs that relay added so the next runRelay can re-discover and re-classify them
  relayAddedStoreIds.forEach((id) => addedStoreIds.delete(id));
  relayAddedStoreIds = new Set();
}

// Returns distance in km between two lat/lon points.
// AI assisted to write this function's formula.
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Mapbox category API cache ────────────────────────────────────────────────
// Caches results for 5 minutes keyed by category + rounded coords (~110m grid).
// This prevents the relay loop from hammering the same API endpoint repeatedly
// and triggering 429 Too Many Requests errors.
const _mapboxCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function _cacheKey(cat, lon, lat) {
  // Round to 3 decimal places ≈ 111 m resolution — close enough for dedup
  const rLon = Math.round(lon * 1000) / 1000;
  const rLat = Math.round(lat * 1000) / 1000;
  return `${cat}|${rLon}|${rLat}`;
}

function fetchMapboxCategory(cat, lon, lat) {
  const key = _cacheKey(cat, lon, lat);
  const cached = _mapboxCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return Promise.resolve(cached.data);
  }
  return fetch(
    `https://api.mapbox.com/search/searchbox/v1/category/${cat}?proximity=${lon},${lat}&limit=10&language=en&access_token=${MAPBOX_TOKEN}`
  )
    .then((res) => (res.ok ? res.json() : { features: [] }))
    .then((data) => {
      const features = data.features || [];
      _mapboxCache.set(key, { ts: Date.now(), data: features });
      return features;
    })
    .catch(() => []);
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── OSM Store Details ───────────────────────────────────────────────────────
function parseOSMHours(raw) {
  if (!raw) return "Unavailable";
  if (raw.trim().toLowerCase() === "24/7") return "Open 24/7";

  const dayMap = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun" };
  const dayOrder = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  function formatTime(t) {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  }

  function expandDayRange(range) {
    if (range.includes("-")) {
      const [start, end] = range.split("-");
      const si = dayOrder.indexOf(start);
      const ei = dayOrder.indexOf(end);
      if (si === -1 || ei === -1) return [range];
      if (ei < si) return [dayOrder[si], dayOrder[ei]];
      return dayOrder.slice(si, ei + 1);
    }
    return [range];
  }

  try {
    const segments = raw.split(";").map(s => s.trim()).filter(Boolean);
    const lines = segments.map(seg => {
      const fullMatch = seg.match(/^([A-Za-z,\-]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      if (fullMatch) {
        const [, dayPart, open, close] = fullMatch;
        const days = dayPart.includes(",")
          ? dayPart.split(",").flatMap(expandDayRange)
          : expandDayRange(dayPart);
        const dayNames = days.map(d => dayMap[d] || d).filter(Boolean);
        const timeStr = `${formatTime(open)} – ${formatTime(close)}`;
        if (dayNames.length === 0) return timeStr;
        const dayLabel = dayNames.length === 1
          ? dayNames[0]
          : dayNames.length === 7
            ? "Every day"
            : `${dayNames[0]} – ${dayNames[dayNames.length - 1]}`;
        return `${dayLabel}: ${timeStr}`;
      }
      const timeOnlyMatch = seg.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      if (timeOnlyMatch) {
        const [, open, close] = timeOnlyMatch;
        return `${formatTime(open)} – ${formatTime(close)}`;
      }
      return seg;
    });
    return lines.join("<br>");
  } catch (e) {
    return raw;
  }
}

async function fetchOSMDetails(name, lat, lon) {
  const query = `[out:json][timeout:10];(node["shop"~"supermarket|convenience|grocery|department_store"](around:120,${lat},${lon});way["shop"~"supermarket|convenience|grocery|department_store"](around:120,${lat},${lon}););out tags center;`;
  try {
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.elements || data.elements.length === 0) return null;
    const nameLower = name.toLowerCase();
    const best = data.elements.find(el =>
      el.tags?.name && (
        el.tags.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(el.tags.name.toLowerCase())
      )
    ) || data.elements[0];
    return {
      hours: best.tags?.opening_hours || null,
      phone: best.tags?.phone || best.tags?.["contact:phone"] || null,
      website: best.tags?.website || best.tags?.["contact:website"] || null,
    };
  } catch (e) {
    return null;
  }
}

function buildStoreDetailsHTML(details) {
  const hoursVal = details ? parseOSMHours(details.hours) : "Unavailable";
  const phoneVal = details?.phone
    ? `<a href="tel:${details.phone.replace(/\s/g, "")}" class="detail-link">${details.phone}</a>`
    : "Unavailable";
  const webVal = details?.website
    ? `<a href="${details.website}" target="_blank" rel="noopener" class="detail-link">${details.website.replace(/^https?:\/\/(www\.)?/, "")}</a>`
    : "Unavailable";
  return `<div class="store-details">
    <div class="store-detail-row"><span class="detail-label">Hours</span><span class="detail-value">${hoursVal}</span></div>
    <div class="store-detail-row"><span class="detail-label">Phone</span><span class="detail-value">${phoneVal}</span></div>
    <div class="store-detail-row"><span class="detail-label">Web</span><span class="detail-value">${webVal}</span></div>
  </div>`;
}

function storeDetailsId(lon, lat) {
  return `sd_${String(lon).replace(/[^0-9]/g, "_")}_${String(lat).replace(/[^0-9]/g, "_")}`;
}

//Stores that does not fit our category 
const NON_GROCERY_NAME_BLOCKLIST = [
  "bar", "pub", "tavern", "brewery", "brewhouse", "brew house",
  "liquor", "wine store", "beer store", "spirits",
  "restaurant", "bistro", "cafe", "coffee", "diner",
  "casino", "nightclub", "lounge",
  "winners", "homesense", "marshalls", "tj maxx", "t.j. maxx",
  "old navy", "h&m", "zara", "gap", "uniqlo", "banana republic",
  "hudson's bay", "the bay", "hbc", "nordstrom", "saks",
  "forever 21", "aritzia", "lululemon", "roots", "aldo",
  "sport chek", "sportchek", "atmosphere", "rei", "decathlon",
  "michael kors", "coach", "kate spade",
  "ikea", "homesense", "bed bath", "crate and barrel", "pottery barn",
  "west elm", "restoration hardware", "the brick", "leon's", "structube",
  "home depot", "rona", "home hardware", "canadian tire",
  "best buy", "the source", "apple store", "microsoft store",
  "staples", "bureau en gros",
  "pet store", "petco", "petsmart", "global pet",
  "shoppers drug mart", "rexall", "london drugs", "pharmasave",
  "dollarama", "dollar tree", "dollar store", "five below",
];

function isNonGroceryName(name) {
  const lower = (name || "").toLowerCase();
  return NON_GROCERY_NAME_BLOCKLIST.some((word) => lower.includes(word));
}

const CATEGORIES = [
  "grocery",
  "supermarket",
  "big_box_retail",
  "department_store",
  "warehouse_store",
  "wholesale_club",
];

// AI assisted to figure the logic of this function.
function fetchGroceryStores(lon, lat) {
  clearMarkers();
  clearRelayMarkers();
  addedStoreIds.clear();

  Promise.all(
    CATEGORIES.map((cat) => fetchMapboxCategory(cat, lon, lat))
  )
    .then((results) => {
      const seen = new Set();
      const allFeatures = results.flat().filter((store) => {
        const id = store.properties?.mapbox_id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      if (allFeatures.length === 0) {
        console.warn("No grocery stores found.");
        return;
      }

      allFeatures
        .filter((store) => {
          const [storeLon, storeLat] = store.geometry.coordinates;
          const name = store.properties.name || "";
          return (
            haversineKm(lat, lon, storeLat, storeLon) <= pingRadius / 1000 &&
            !isNonGroceryName(name)
          );
        })
        .forEach((store) => {
          const [storeLon, storeLat] = store.geometry.coordinates;
          const name = store.properties.name || "Grocery Store";
          const address =
            store.properties.full_address ||
            store.properties.place_formatted ||
            "Address unavailable";

          addedStoreIds.add(store.properties.mapbox_id);
          groceryStoreLocations.push({ lat: storeLat, lon: storeLon });

          const did = storeDetailsId(storeLon, storeLat);
          const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "300px" }).setHTML(`
            <div class="map-popup-body">
              <div class="map-popup-header">
                <strong class="map-popup-name">${name}</strong>
                ${IS_LOGGED_IN ? `
                  <button class="map-popup-save-btn"
                    onclick='saveLocation(this, ${JSON.stringify(name)}, ${JSON.stringify(address)})'>
                  Save
                  </button>
                  ` : ""}
              </div>
              <p class="map-popup-address">${address}</p>
              <div id="${did}" class="store-details-loading">Loading details…</div>
            </div>
          `);

          popup.on("open", () => {
            fetchOSMDetails(name, storeLat, storeLon).then(details => {
              const el = document.getElementById(did);
              if (el) el.outerHTML = buildStoreDetailsHTML(details);
            });
          });

          const marker = new mapboxgl.Marker({ color: "green" })
            .setLngLat([storeLon, storeLat])
            .setPopup(popup)
            .addTo(map);

          currentMarkers.push(marker);
        });

      // BUG FIX: Only fire transit stops from ONE place.
      // If relay is on, relay's onStopComplete handles bus/skytrain (after
      // relayStoreLocations is populated). If relay is off, fire them here.
      if (relayEnabled) {
        runRelay(lon, lat);
      } else {
        if (busEnabled) fetchBusStops(lon, lat);
        if (skytrainEnabled) fetchSkytrainStops(lon, lat);
      }
    })
    .catch((err) => {
      console.error("Failed to fetch grocery stores:", err);
    });
}

// ─── Relay ───────────────────────────────────────────────────────────────────
function collectRelayStoresNear(lon, lat, transitType, collector, onComplete) {
  Promise.all(
    CATEGORIES.map((cat) => fetchMapboxCategory(cat, lon, lat))  // uses cache
  )
    .then((results) => {
      if (!relayEnabled) { if (onComplete) onComplete(); return; }

      const seen = new Set();
      const allFeatures = results.flat().filter((store) => {
        const id = store.properties?.mapbox_id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });

      allFeatures
        .filter((store) => {
          const [storeLon, storeLat] = store.geometry.coordinates;
          const name = store.properties.name || "";
          const id = store.properties.mapbox_id;
          return (
            haversineKm(lat, lon, storeLat, storeLon) <= secondaryPingRadius / 1000 &&
            !addedStoreIds.has(id) &&
            !isNonGroceryName(name)
          );
        })
        .forEach((store) => {
          const id = store.properties.mapbox_id;
          if (collector.has(id)) {
            collector.get(id).transitTypes.add(transitType);
          } else {
            collector.set(id, { feature: store, transitTypes: new Set([transitType]) });
          }
        });

      if (onComplete) onComplete();
    })
    .catch(() => { if (onComplete) onComplete(); });
}

function createSplitMarkerElement() {
  const el = document.createElement("div");
  el.className = "split-relay-marker";
  return el;
}

function renderRelayStores(collector) {
  collector.forEach(({ feature, transitTypes }) => {
    const [storeLon, storeLat] = feature.geometry.coordinates;
    const name = feature.properties.name || "Grocery Store";
    const address =
      feature.properties.full_address ||
      feature.properties.place_formatted ||
      "Address unavailable";

    addedStoreIds.add(feature.properties.mapbox_id);
    relayAddedStoreIds.add(feature.properties.mapbox_id);
    relayStoreLocations.push({ lat: storeLat, lon: storeLon });

    const did = storeDetailsId(storeLon, storeLat);
    const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "300px" }).setHTML(`
      <div class="map-popup-body">
        <div class="map-popup-header">
          <strong class="map-popup-name">${name}</strong>
          <button class="map-popup-save-btn" onclick='saveLocation(${JSON.stringify(name)}, ${JSON.stringify(address)})'>Save</button>
        </div>
        <p class="map-popup-address">${address}</p>
        <div id="${did}" class="store-details-loading">Loading details…</div>
      </div>
    `);

    popup.on("open", () => {
      fetchOSMDetails(name, storeLat, storeLon).then((details) => {
        const el = document.getElementById(did);
        if (el) el.outerHTML = buildStoreDetailsHTML(details);
      });
    });

    const hasBus   = transitTypes.has("bus");
    const hasTrain = transitTypes.has("skytrain");
    let marker;

    if (hasBus && hasTrain) {
      marker = new mapboxgl.Marker({ element: createSplitMarkerElement(), anchor: "bottom" })
        .setLngLat([storeLon, storeLat])
        .setPopup(popup)
        .addTo(map);
    } else if (hasTrain) {
      marker = new mapboxgl.Marker({ color: "#8B5CF6" })
        .setLngLat([storeLon, storeLat])
        .setPopup(popup)
        .addTo(map);
    } else {
      marker = new mapboxgl.Marker({ color: "#FFD700" })
        .setLngLat([storeLon, storeLat])
        .setPopup(popup)
        .addTo(map);
    }

    relayMarkers.push(marker);
  });
}

function runRelay(lon, lat) {
  clearRelayMarkers();
  const generation = ++relayGeneration; // capture this run's generation

  Promise.all([
    fetch("/data/busStops.json").then((r) => r.json()),
    fetch("/data/skytrainStops.json").then((r) => r.json()),
  ]).then(([busStopsRaw, skytrainStopsRaw]) => {
    // Discard if a newer relay run has already started
    if (generation !== relayGeneration) return;

    busStopsRaw.forEach((s) => { s._transitType = "bus"; });
    skytrainStopsRaw.forEach((s) => { s._transitType = "skytrain"; });

    // Relay respects the bus/skytrain stop toggles:
    // only scan the transit types the user has enabled
    const allStops = [
      ...(busEnabled ? busStopsRaw : []),
      ...(skytrainEnabled ? skytrainStopsRaw : []),
    ];

    // Helper: called on any early exit so stop markers still appear
    const finishWithStops = () => {
      if (busEnabled) fetchBusStops(lon, lat);
      if (skytrainEnabled) fetchSkytrainStops(lon, lat);
    };

    if (allStops.length === 0) { finishWithStops(); return; }

    const nearbyRoutes = new Set();
    allStops.forEach((stop) => {
      if (haversineKm(lat, lon, stop.lat, stop.lon) <= pingRadius / 1000)
        Object.keys(stop.routes).forEach((r) => nearbyRoutes.add(r));
    });
    if (nearbyRoutes.size === 0) { finishWithStops(); return; }

    const seen = new Set();
    const expanded = [];
    allStops.forEach((stop) => {
      const onNearbyRoute = Object.keys(stop.routes).some((r) => nearbyRoutes.has(r));
      const withinExpansion = haversineKm(lat, lon, stop.lat, stop.lon) <= transitExpansion;
      // Use type-prefixed UID so bus stop #5 and skytrain stop #5 don't collide
      const uid = `${stop._transitType}_${stop.id}`;
      if (onNearbyRoute && withinExpansion && !seen.has(uid)) {
        seen.add(uid);
        expanded.push(stop);
      }
    });

    const deduped50m   = deduplicateStops(expanded, lat, lon);
    const stopsToFetch = deduplicateByStoreOverlap(deduped50m, lat, lon);

    console.log("Relay stops after dedup:", stopsToFetch.length,
      "| bus:", stopsToFetch.filter((s) => s._transitType === "bus").length,
      "| skytrain:", stopsToFetch.filter((s) => s._transitType === "skytrain").length);

    if (stopsToFetch.length === 0) { finishWithStops(); return; }

    const collector = new Map();

    let completed = 0;
    const onStopComplete = () => {
      // Discard if a newer relay run has already superseded this one
      if (generation !== relayGeneration) return;
      completed++;
      if (completed < stopsToFetch.length) return;

      renderRelayStores(collector);

      // BUG FIX: transit stops are fired here (only once, after relay stores
      // are added to relayStoreLocations) using separate flags per type.
      if (busEnabled) fetchBusStops(lon, lat);
      if (skytrainEnabled) fetchSkytrainStops(lon, lat);
    };

    stopsToFetch.forEach((stop, i) => {
      const t = setTimeout(
        () => collectRelayStoresNear(stop.lon, stop.lat, stop._transitType, collector, onStopComplete),
        i * 150
      );
      relayTimeouts.push(t);
    });

  }).catch((err) => {
    console.error("Failed to load transit stops for relay:", err);
    if (busEnabled) fetchBusStops(lon, lat);
    if (skytrainEnabled) fetchSkytrainStops(lon, lat);
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// Function to save location
async function saveLocation(button, name, address) {
  const response = await fetch("/saveLocation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, address }),
  });

  const result = await response.json();

  if (response.ok) {
    button.innerText = "Saved";
    button.style.backgroundColor = "red";
    button.disabled = true;
  }

  alert(result.message);
}

let initialLoadDone = false;

geolocate.on("geolocate", (e) => {
  lastKnownLon = e.coords.longitude;
  lastKnownLat = e.coords.latitude;

  updateUserScanCircle();

  if (!initialLoadDone) {
    initialLoadDone = true;
    fetchGroceryStores(lastKnownLon, lastKnownLat);
  }
});

// ─── Panel controls ───────────────────────────────────────────────────────────
const panel     = document.getElementById("radius-panel");
const toggleBtn = document.getElementById("radius-toggle");
const applyBtn  = document.getElementById("radius-apply");
const radiusInput = document.getElementById("radius-input");

// Separate bus / skytrain toggles
const busToggle      = document.getElementById("bus-toggle");
const skytrainToggle = document.getElementById("skytrain-toggle");
const relayToggle    = document.getElementById("relay-toggle");

busToggle.addEventListener("change", () => {
  busEnabled = busToggle.checked;
  if (!busEnabled) {
    clearBusMarkers();
  } else if (lastKnownLon !== null) {
    fetchBusStops(lastKnownLon, lastKnownLat);
  }
  // Re-run relay so it picks up the updated bus/skytrain selection
  if (relayEnabled && lastKnownLon !== null) {
    runRelay(lastKnownLon, lastKnownLat);
  }
});

skytrainToggle.addEventListener("change", () => {
  skytrainEnabled = skytrainToggle.checked;
  if (!skytrainEnabled) {
    clearSkytrainMarkers();
  } else if (lastKnownLon !== null) {
    fetchSkytrainStops(lastKnownLon, lastKnownLat);
  }
  // Re-run relay so it picks up the updated bus/skytrain selection
  if (relayEnabled && lastKnownLon !== null) {
    runRelay(lastKnownLon, lastKnownLat);
  }
});

relayToggle.addEventListener("change", () => {
  relayEnabled = relayToggle.checked;
  if (!relayEnabled) {
    clearRelayMarkers();
  } else if (lastKnownLon !== null) {
    runRelay(lastKnownLon, lastKnownLat);
  }
});

const foodBankToggle = document.getElementById("foodbank-toggle");
foodBankToggle.addEventListener("change", () => {
  foodBanksEnabled = foodBankToggle.checked;
  if (foodBanksEnabled) {
    if (foodBankData.length > 0) {
      renderFoodBanks();
    } else {
      fetch("/data/foodBanks.json")
        .then((res) => res.json())
        .then((data) => {
          foodBankData = data;
          renderFoodBanks();
        })
        .catch((err) => console.error("Failed to load food bank data:", err));
    }
  } else {
    clearFoodBankMarkers();
  }
});

toggleBtn.addEventListener("click", () => {
  panel.classList.toggle("open");
  toggleBtn.textContent = panel.classList.contains("open") ? "›" : "‹";
});

// BUG FIX: Only one applyBtn listener. The original code had two listeners
// which caused fetchGroceryStores to fire twice (once with wrong coords when
// a custom marker was active). Now one listener handles both cases correctly.
applyBtn.addEventListener("click", () => {
  console.log("relay enabled:", relayEnabled, "| bus enabled:", busEnabled, "| skytrain enabled:", skytrainEnabled);

  const val          = parseFloat(radiusInput.value);
  const expansionVal = parseFloat(document.getElementById("expansion-input").value);
  const secondaryVal = parseFloat(document.getElementById("secondary-input").value);

  if (!isNaN(val) && val > 0) pingRadius = val;
  if (!isNaN(expansionVal) && expansionVal > 0) transitExpansion = Math.min(expansionVal, 5);
  if (!isNaN(secondaryVal) && secondaryVal > 0) secondaryPingRadius = Math.min(secondaryVal, 300);

  // Use custom marker position if active, otherwise GPS
  const scanLon = customScanLon !== null ? customScanLon : lastKnownLon;
  const scanLat = customScanLat !== null ? customScanLat : lastKnownLat;

  if (scanLon !== null && scanLat !== null) {
    fetchGroceryStores(scanLon, scanLat);
  }

  updateUserScanCircle();
  updateCustomScanCircle();
  panel.classList.remove("open");
  toggleBtn.textContent = "‹";
});

// First time popup
const mapPopup = document.getElementById("mapFirstTimePopup");
const closeBtn = document.getElementById("closeMapPopup");

if (!localStorage.getItem("hasVisitedMap")) {
  mapPopup.style.display = "flex";
}

closeBtn.addEventListener("click", () => {
  mapPopup.style.display = "none";
  localStorage.setItem("hasVisitedMap", "true");
});

// ─── Transit markers ──────────────────────────────────────────────────────────
let busMarkers = [];
let skytrainMarkers = [];

function clearBusMarkers() {
  busMarkers.forEach((m) => m.remove());
  busMarkers = [];
}

function clearSkytrainMarkers() {
  skytrainMarkers.forEach((m) => m.remove());
  skytrainMarkers = [];
}

function isNearGroceryStore(stopLat, stopLon) {
  const allStores = [...groceryStoreLocations, ...relayStoreLocations];
  return allStores.some(
    (store) => haversineKm(stopLat, stopLon, store.lat, store.lon) <= secondaryPingRadius / 1000
  );
}

function deduplicateStops(stops, userLat, userLon) {
  const DEDUP_KM = 0.05;
  const toRemove = new Set();

  for (let i = 0; i < stops.length; i++) {
    if (toRemove.has(i)) continue;
    for (let j = i + 1; j < stops.length; j++) {
      if (toRemove.has(j)) continue;
      if (haversineKm(stops[i].lat, stops[i].lon, stops[j].lat, stops[j].lon) > DEDUP_KM) continue;
      const routesI = new Set(Object.keys(stops[i].routes));
      const sharesRoute = Object.keys(stops[j].routes).some((r) => routesI.has(r));
      if (!sharesRoute) continue;
      const distI = haversineKm(userLat, userLon, stops[i].lat, stops[i].lon);
      const distJ = haversineKm(userLat, userLon, stops[j].lat, stops[j].lon);
      const fartherIdx = distI >= distJ ? i : j;
      if (!isNearGroceryStore(stops[fartherIdx].lat, stops[fartherIdx].lon)) {
        toRemove.add(fartherIdx);
      }
    }
  }

  return stops.filter((_, idx) => !toRemove.has(idx));
}

function getStopStoreKey(stopLat, stopLon) {
  return groceryStoreLocations
    .map((store, i) =>
      haversineKm(stopLat, stopLon, store.lat, store.lon) <= secondaryPingRadius / 1000 ? i : null
    )
    .filter((i) => i !== null)
    .join(",");
}

function deduplicateByStoreOverlap(stops, userLat, userLon) {
  const toRemove = new Set();

  for (let i = 0; i < stops.length; i++) {
    if (toRemove.has(i)) continue;
    const keyI = getStopStoreKey(stops[i].lat, stops[i].lon);
    if (keyI === "") continue;

    for (let j = i + 1; j < stops.length; j++) {
      if (toRemove.has(j)) continue;
      const routesI = new Set(Object.keys(stops[i].routes));
      const sharesRoute = Object.keys(stops[j].routes).some((r) => routesI.has(r));
      if (!sharesRoute) continue;
      const keyJ = getStopStoreKey(stops[j].lat, stops[j].lon);
      if (keyI !== keyJ) continue;
      const distI = haversineKm(userLat, userLon, stops[i].lat, stops[i].lon);
      const distJ = haversineKm(userLat, userLon, stops[j].lat, stops[j].lon);
      toRemove.add(distI >= distJ ? i : j);
    }
  }

  return stops.filter((_, idx) => !toRemove.has(idx));
}

function fetchBusStops(lon, lat) {
  clearBusMarkers();
  fetch("/data/busStops.json")
    .then((res) => res.json())
    .then((stops) => {
      const pingedRoutes = new Set();
      stops.forEach((stop) => {
        if (haversineKm(lat, lon, stop.lat, stop.lon) <= pingRadius / 1000) {
          Object.keys(stop.routes).forEach((r) => pingedRoutes.add(r));
        }
      });

      if (pingedRoutes.size === 0) return;

      const expanded = stops.filter((stop) => {
        const onPingedRoute = Object.keys(stop.routes).some((r) => pingedRoutes.has(r));
        const withinExpansion = haversineKm(lat, lon, stop.lat, stop.lon) <= transitExpansion;
        return onPingedRoute && withinExpansion;
      });

      const deduped50m = deduplicateStops(expanded, lat, lon);
      const stopsToShow = deduplicateByStoreOverlap(deduped50m, lat, lon).filter((stop) =>
        haversineKm(lat, lon, stop.lat, stop.lon) <= pingRadius / 1000 ||
        isNearGroceryStore(stop.lat, stop.lon)
      );

      stopsToShow.forEach((stop) => {
        const visibleRoutes = Object.entries(stop.routes).filter(([r]) => pingedRoutes.has(r));
        const routeLines = visibleRoutes
          .map(([routeName, schedule]) => `
            <div class="transit-route">
              <strong>Route ${routeName}</strong><br>${schedule.join("<br>")}
            </div>`).join("");

        const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "280px" }).setHTML(`
          <div class="transit-popup-body">
            <strong class="map-popup-name">${stop.name}</strong>${routeLines}
          </div>`);

        busMarkers.push(
          new mapboxgl.Marker({ color: "blue" })
            .setLngLat([stop.lon, stop.lat])
            .setPopup(popup)
            .addTo(map),
        );
      });
    });
}

function fetchSkytrainStops(lon, lat) {
  clearSkytrainMarkers();
  fetch("/data/skytrainStops.json")
    .then((res) => res.json())
    .then((stops) => {
      const pingedRoutes = new Set();
      stops.forEach((stop) => {
        if (haversineKm(lat, lon, stop.lat, stop.lon) <= pingRadius / 1000) {
          Object.keys(stop.routes).forEach((r) => pingedRoutes.add(r));
        }
      });

      if (pingedRoutes.size === 0) return;

      const expanded = stops.filter((stop) => {
        const onPingedRoute = Object.keys(stop.routes).some((r) => pingedRoutes.has(r));
        const withinExpansion = haversineKm(lat, lon, stop.lat, stop.lon) <= transitExpansion;
        return onPingedRoute && withinExpansion;
      });

      const deduped50m = deduplicateStops(expanded, lat, lon);
      const stopsToShow = deduplicateByStoreOverlap(deduped50m, lat, lon).filter((stop) =>
        haversineKm(lat, lon, stop.lat, stop.lon) <= pingRadius / 1000 ||
        isNearGroceryStore(stop.lat, stop.lon)
      );

      stopsToShow.forEach((stop) => {
        const visibleRoutes = Object.entries(stop.routes).filter(([r]) => pingedRoutes.has(r));
        const routeLines = visibleRoutes
          .map(([routeName, schedule]) => `
            <div class="transit-route">
              <strong>Route ${routeName}</strong><br>${schedule.join("<br>")}
            </div>`).join("");

        const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "280px" }).setHTML(`
          <div class="transit-popup-body">
            <strong class="map-popup-name">${stop.name}</strong>${routeLines}
          </div>`);

        skytrainMarkers.push(
          new mapboxgl.Marker({ color: "#FF6B00" })
            .setLngLat([stop.lon, stop.lat])
            .setPopup(popup)
            .addTo(map),
        );
      });
    });
}

// ─── Food Banks ───────────────────────────────────────────────────────────────
let foodBankMarkers = [];
let foodBanksEnabled = false;
let foodBankData = [];

function renderFoodBanks() {
  foodBankData.forEach((fb) => {
    const emailLine = fb.email
      ? `<a class="map-popup-link" href="mailto:${fb.email}">${fb.email}</a>`
      : "";
    const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "300px" }).setHTML(`
      <div class="map-popup-body foodbank-popup">
        <div class="map-popup-header">
          <strong class="map-popup-name">${fb.name}</strong>
        </div>
        <p class="map-popup-address">${fb.address}</p>
        <a class="map-popup-link" href="tel:${fb.phone.replace(/-/g, "")}">${fb.phone}</a>
        ${emailLine}
        <a class="map-popup-link" href="${fb.website}" target="_blank" rel="noopener">Visit Website</a>
      </div>
    `);

    const marker = new mapboxgl.Marker({ color: "#FF8C00" })
      .setLngLat([fb.lon, fb.lat])
      .setPopup(popup)
      .addTo(map);

    foodBankMarkers.push(marker);
  });
}

function clearFoodBankMarkers() {
  foodBankMarkers.forEach((m) => m.remove());
  foodBankMarkers = [];
}

// ─── Custom scan-location marker ──────────────────────────────────────────────
let customMarker = null;
let customScanLon = null;
let customScanLat = null;

const customBtn  = document.getElementById("custom-location-btn");
const customIcon = document.getElementById("custom-location-icon");

function enterCustomMode() {
  if (lastKnownLon === null || lastKnownLat === null) return;

  customScanLon = lastKnownLon;
  customScanLat = lastKnownLat;

  customMarker = new mapboxgl.Marker({ color: "#e53935", draggable: true })
    .setLngLat([customScanLon, customScanLat])
    .addTo(map);

  customMarker.on("drag", () => {
    const lngLat = customMarker.getLngLat();
    customScanLon = lngLat.lng;
    customScanLat = lngLat.lat;
    updateCustomScanCircle();
  });

  customMarker.on("dragend", () => {
    const lngLat = customMarker.getLngLat();
    customScanLon = lngLat.lng;
    customScanLat = lngLat.lat;
    fetchGroceryStores(customScanLon, customScanLat);
  });

  customIcon.src = "/images/xPing.png";
  customBtn.classList.add("active");

  updateCustomScanCircle();
  map.setLayoutProperty("scan-circle-user-fill", "visibility", "none");
  map.setLayoutProperty("scan-circle-user-border", "visibility", "none");

  fetchGroceryStores(customScanLon, customScanLat);
}

function exitCustomMode() {
  if (customMarker) {
    customMarker.remove();
    customMarker = null;
  }
  customScanLon = null;
  customScanLat = null;

  customIcon.src = "/images/locationPing.png";
  customBtn.classList.remove("active");

  updateCustomScanCircle();
  map.setLayoutProperty("scan-circle-user-fill", "visibility", "visible");
  map.setLayoutProperty("scan-circle-user-border", "visibility", "visible");

  if (lastKnownLon !== null && lastKnownLat !== null) {
    fetchGroceryStores(lastKnownLon, lastKnownLat);
  }
}

customBtn.addEventListener("click", () => {
  if (customMarker) {
    exitCustomMode();
  } else {
    enterCustomMode();
  }
});