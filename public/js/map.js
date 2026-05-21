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
// Approximates a geodesic circle as a GeoJSON polygon (64-point).
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
  // ── User GPS scan circle (blue) ──
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

  // ── Custom (rescan) marker circle (blue) ──
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
let pingRadius = 500;       // meters, max 1000
let transitExpansion = 1;   // km, max 5
let secondaryPingRadius = 100; // meters, max 300
let currentMarkers = [];
let relayMarkers = [];
let relayTimeouts = [];
let relayStoreLocations = [];
let addedStoreIds = new Set();
let groceryStoreLocations = []; // cached store coords for stop dedup priority check
let lastKnownLon = null;
let lastKnownLat = null;
let stopsEnabled = false;
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
}

// Returns distance in km between two
// lat/lon points AI assited to write this function's formula.
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

// AI assited to figure the logic of this function.
// This function fetches grocery stores from Mapbox API based on the user's location
// and the specified radius, then adds markers for those stores on the map.
function fetchGroceryStores(lon, lat) {
  clearMarkers();
  clearRelayMarkers();
  addedStoreIds.clear();

  fetch(
    `https://api.mapbox.com/search/searchbox/v1/category/grocery?proximity=${lon},${lat}&limit=10&language=en&access_token=${MAPBOX_TOKEN}`
  )
    .then((res) => {
      if (!res.ok) throw new Error(`Mapbox category error: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      if (!data.features || data.features.length === 0) {
        console.warn("No grocery stores found.", data);
        return;
      }

      data.features
        .filter((store) => {
          const [storeLon, storeLat] = store.geometry.coordinates;
          return haversineKm(lat, lon, storeLat, storeLon) <= pingRadius / 1000;
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

          const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "280px" }).setHTML(`
            <div class="map-popup-body">
              <div class="map-popup-header">
                <strong class="map-popup-name">${name}</strong>
                ${IS_LOGGED_IN ? `
                  <button class="map-popup-save-btn" onclick='saveLocation(${JSON.stringify(name)}, ${JSON.stringify(address)})'>
                    Save
                  </button>
                  ` : ""}
              </div>
              <p class="map-popup-address">${address}</p>
            </div>
          `);

          const marker = new mapboxgl.Marker({ color: "green" })
            .setLngLat([storeLon, storeLat])
            .setPopup(popup)
            .addTo(map);

          currentMarkers.push(marker);
        });

      // After green stores are established, run relay and/or transit stops if enabled.
      // Transit stops are fired HERE (not in parallel) so groceryStoreLocations is
      // already populated when the dedup and store-filter logic runs.
      if (relayEnabled) {
        runRelay(lon, lat);
      }
      if (stopsEnabled) {
        fetchBusStops(lon, lat);
        fetchSkytrainStops(lon, lat);
      }
    })
    .catch((err) => {
      console.error("Failed to fetch grocery stores:", err);
    });
}

// Fetches all transit stops within radius and pings grocery stores from each
function fetchRelayStores(lon, lat, onComplete) {
  fetch(
    `https://api.mapbox.com/search/searchbox/v1/category/grocery?proximity=${lon},${lat}&limit=10&language=en&access_token=${MAPBOX_TOKEN}`
  )
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      if (!data?.features || !relayEnabled) {
        if (onComplete) onComplete();
        return;
      }

      data.features
        .filter((store) => {
          const [storeLon, storeLat] = store.geometry.coordinates;
          return (
            haversineKm(lat, lon, storeLat, storeLon) <= secondaryPingRadius / 1000 &&
            !addedStoreIds.has(store.properties.mapbox_id)
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
          relayStoreLocations.push({ lat: storeLat, lon: storeLon });

          const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "280px" }).setHTML(`
            <div class="map-popup-body">
              <div class="map-popup-header">
                <strong class="map-popup-name">${name}</strong>
                <button class="map-popup-save-btn" onclick='saveLocation(${JSON.stringify(name)}, ${JSON.stringify(address)})'>Save</button>
              </div>
              <p class="map-popup-address">${address}</p>
            </div>
          `);

          const marker = new mapboxgl.Marker({ color: "yellow" })
            .setLngLat([storeLon, storeLat])
            .setPopup(popup)
            .addTo(map);

          relayMarkers.push(marker);
        });

      if (onComplete) onComplete();
    })
    .catch(() => {
      if (onComplete) onComplete();
    });
}

function runRelay(lon, lat) {
  clearRelayMarkers();

  Promise.all([
    fetch("/data/busStops.json").then((r) => r.json()),
    fetch("/data/skytrainStops.json").then((r) => r.json()),
  ]).then(([busStops, skytrainStops]) => {
    const allStops = [...busStops, ...skytrainStops];

    const nearbyStops = allStops.filter(
      (stop) => haversineKm(lat, lon, stop.lat, stop.lon) <= pingRadius / 1000
    );

    const nearbyRoutes = new Set();
    nearbyStops.forEach((stop) => {
      Object.keys(stop.routes).forEach((route) => nearbyRoutes.add(route));
    });

    const seen = new Set();
    const expanded = [];

    allStops.forEach((stop) => {
      const onNearbyRoute = Object.keys(stop.routes).some((route) => nearbyRoutes.has(route));
      const withinExpansion = haversineKm(lat, lon, stop.lat, stop.lon) <= transitExpansion;
      if (onNearbyRoute && withinExpansion && !seen.has(stop.id)) {
        seen.add(stop.id);
        expanded.push(stop);
      }
    });

    const deduped50m = deduplicateStops(expanded, lat, lon);
    const stopsToFetch = deduplicateByStoreOverlap(deduped50m, lat, lon);

    console.log("Nearby routes:", [...nearbyRoutes]);
    console.log("Stops to fetch after dedup:", stopsToFetch.length);

    if (stopsToFetch.length === 0) return;

    // Track completion — refresh bus/skytrain stops after all relay calls finish
    let completed = 0;
    const onRelayComplete = () => {
      completed++;
      if (completed === stopsToFetch.length && stopsEnabled) {
        fetchBusStops(lon, lat);
        fetchSkytrainStops(lon, lat);
      }
    };

    stopsToFetch.forEach((stop, index) => {
      const t = setTimeout(() => fetchRelayStores(stop.lon, stop.lat, onRelayComplete), index * 150);
      relayTimeouts.push(t);
    });

  }).catch((err) => {
    console.error("Failed to load transit stops for relay:", err);
  });
}

// Function to save location
async function saveLocation(name, address) {
  const response = await fetch("/saveLocation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, address }),
  });

  const result = await response.json();
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

// the arrow pop up for radius selection logic
const panel = document.getElementById("radius-panel");
const toggleBtn = document.getElementById("radius-toggle");
const applyBtn = document.getElementById("radius-apply");
const stopsToggle = document.getElementById("stops-toggle");
const relayToggle = document.getElementById("relay-toggle");
const radiusInput = document.getElementById("radius-input");

stopsToggle.addEventListener("change", () => {
  stopsEnabled = stopsToggle.checked;
  if (!stopsEnabled) {
    clearBusMarkers();
    clearSkytrainMarkers();
  } else if (lastKnownLon !== null) {
    fetchBusStops(lastKnownLon, lastKnownLat);
    fetchSkytrainStops(lastKnownLon, lastKnownLat);
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

applyBtn.addEventListener("click", () => {
  console.log("relay enabled:", relayEnabled, "| stops enabled:", stopsEnabled);
  const val = parseFloat(radiusInput.value);
  const expansionVal = parseFloat(document.getElementById("expansion-input").value);
  const secondaryVal = parseFloat(document.getElementById("secondary-input").value);

  if (!isNaN(val) && val > 0) pingRadius = val;
  if (!isNaN(expansionVal) && expansionVal > 0) transitExpansion = Math.min(expansionVal, 5);
  if (!isNaN(secondaryVal) && secondaryVal > 0) secondaryPingRadius = Math.min(secondaryVal, 300);

  if (lastKnownLon !== null && lastKnownLat !== null) {
    fetchGroceryStores(lastKnownLon, lastKnownLat);
  }
  updateUserScanCircle();
  updateCustomScanCircle();
  panel.classList.remove("open");
  toggleBtn.textContent = "‹";
});

// First time popup logic
const mapPopup = document.getElementById("mapFirstTimePopup");
const closeBtn = document.getElementById("closeMapPopup");

if (!localStorage.getItem("hasVisitedMap")) {
  mapPopup.style.display = "flex";
}

closeBtn.addEventListener("click", () => {
  mapPopup.style.display = "none";
  localStorage.setItem("hasVisitedMap", "true");
});

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

// Returns true if a stop is within secondaryPingRadius of any known grocery store
function isNearGroceryStore(stopLat, stopLon) {
  const allStores = [...groceryStoreLocations, ...relayStoreLocations];
  return allStores.some(
    (store) => haversineKm(stopLat, stopLon, store.lat, store.lon) <= secondaryPingRadius / 1000
  );
}

// Dedup: if two stops share a pinged route and are within 50m of each other,
// remove the one farther from the user — UNLESS it's near a grocery store (keep both then).
function deduplicateStops(stops, userLat, userLon) {
  const DEDUP_KM = 0.05; // 50 metres
  const toRemove = new Set();

  for (let i = 0; i < stops.length; i++) {
    if (toRemove.has(i)) continue;
    for (let j = i + 1; j < stops.length; j++) {
      if (toRemove.has(j)) continue;

      if (haversineKm(stops[i].lat, stops[i].lon, stops[j].lat, stops[j].lon) > DEDUP_KM) continue;

      // Must share at least one route to be considered duplicates
      const routesI = new Set(Object.keys(stops[i].routes));
      const sharesRoute = Object.keys(stops[j].routes).some((r) => routesI.has(r));
      if (!sharesRoute) continue;

      // Pick which one is farther from the user
      const distI = haversineKm(userLat, userLon, stops[i].lat, stops[i].lon);
      const distJ = haversineKm(userLat, userLon, stops[j].lat, stops[j].lon);
      const fartherIdx = distI >= distJ ? i : j;

      // Only drop it if it's not near a grocery store
      if (!isNearGroceryStore(stops[fartherIdx].lat, stops[fartherIdx].lon)) {
        toRemove.add(fartherIdx);
      }
    }
  }

  return stops.filter((_, idx) => !toRemove.has(idx));
}

// Returns a string key representing exactly which grocery stores a stop pings.
// Two stops with the same key ping the identical set of stores.
function getStopStoreKey(stopLat, stopLon) {
  return groceryStoreLocations
    .map((store, i) =>
      haversineKm(stopLat, stopLon, store.lat, store.lon) <= secondaryPingRadius / 1000 ? i : null
    )
    .filter((i) => i !== null)
    .join(",");
}

// Dedup: if two stops share a route AND ping the exact same set of stores,
// keep the closer one to the user and drop the farther one.
// Stops on different routes are never eliminated by each other (335 vs 337 both stay).
function deduplicateByStoreOverlap(stops, userLat, userLon) {
  const toRemove = new Set();

  for (let i = 0; i < stops.length; i++) {
    if (toRemove.has(i)) continue;
    const keyI = getStopStoreKey(stops[i].lat, stops[i].lon);
    if (keyI === "") continue; // doesn't ping any store — not eligible for this dedup

    for (let j = i + 1; j < stops.length; j++) {
      if (toRemove.has(j)) continue;

      // Must share at least one route
      const routesI = new Set(Object.keys(stops[i].routes));
      const sharesRoute = Object.keys(stops[j].routes).some((r) => routesI.has(r));
      if (!sharesRoute) continue;

      // Must ping the exact same store set
      const keyJ = getStopStoreKey(stops[j].lat, stops[j].lon);
      if (keyI !== keyJ) continue;

      // Same route, same stores → drop the farther one
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
          new mapboxgl.Marker({ color: "blue" })
            .setLngLat([stop.lon, stop.lat])
            .setPopup(popup)
            .addTo(map),
        );
      });
    });
}

// ─── Food Banks ──────────────────────────────────────────────────────────────
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

    const el = document.createElement("div");
    el.className = "foodbank-marker";

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
// ─────────────────────────────────────────────────────────────────────────────

// ─── Custom scan-location marker ────────────────────────────────────────────
// Tracks whether the user has dropped a custom red marker.
// While active:  scans use the marker's position (not the GPS dot)
// While inactive: scans use lastKnownLon / lastKnownLat as before

let customMarker = null;      // mapboxgl.Marker | null
let customScanLon = null;     // lon of the draggable red marker
let customScanLat = null;     // lat of the draggable red marker

const customBtn  = document.getElementById("custom-location-btn");
const customIcon = document.getElementById("custom-location-icon");

function enterCustomMode() {
  // Need a GPS fix before we can drop a marker
  if (lastKnownLon === null || lastKnownLat === null) return;

  customScanLon = lastKnownLon;
  customScanLat = lastKnownLat;

  customMarker = new mapboxgl.Marker({ color: "#e53935", draggable: true })
    .setLngLat([customScanLon, customScanLat])
    .addTo(map);

  // Update circle in real-time as the marker is dragged
  customMarker.on("drag", () => {
    const lngLat = customMarker.getLngLat();
    customScanLon = lngLat.lng;
    customScanLat = lngLat.lat;
    updateCustomScanCircle();
  });

  // Re-scan each time the marker is dropped in a new spot
  customMarker.on("dragend", () => {
    const lngLat = customMarker.getLngLat();
    customScanLon = lngLat.lng;
    customScanLat = lngLat.lat;
    fetchGroceryStores(customScanLon, customScanLat);
  });

  // Swap icon and tint the button
  customIcon.src = "/images/xPing.png";
  customBtn.classList.add("active");

  updateCustomScanCircle();
  map.setLayoutProperty("scan-circle-user-fill", "visibility", "none");
  map.setLayoutProperty("scan-circle-user-border", "visibility", "none");

  // Trigger an initial scan from the dropped position
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

  // Return to GPS-based scan
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

// ─── Patch applyBtn to respect custom marker position ───────────────────────
// The original applyBtn listener always uses lastKnownLon/Lat.
// We add a second listener here that fires afterward and uses the custom
// position when the marker is active.  The original listener's fetchGroceryStores
// call fires first but is immediately superseded by ours.
applyBtn.addEventListener("click", () => {
  const scanLon = customScanLon !== null ? customScanLon : lastKnownLon;
  const scanLat = customScanLat !== null ? customScanLat : lastKnownLat;
  if (scanLon !== null && scanLat !== null) {
    fetchGroceryStores(scanLon, scanLat);
  }
});
// ─────────────────────────────────────────────────────────────────────────────