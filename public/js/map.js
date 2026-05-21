// Global State Variables 
let pingRadius = 500;            // Scan radius in metres (default 500 m)
let transitExpansion = 1;        // How far (km) along a bus/skytrain route to follow (default 1 km)
let secondaryPingRadius = 100;   // Radius (m) around a transit stop to search for stores

let currentMarkers = [];         // All green grocery store markers currently on the map
let relayMarkers = [];           // Relay mode markers (yellow/purple/split)
let relayTimeouts = [];          // setTimeout IDs used by relay — kept so they can be cancelled
let relayStoreLocations = [];    // Lat/lon of stores added by relay mode
let addedStoreIds = new Set();   // Mapbox IDs of every store already on the map (prevents duplicates)
let relayAddedStoreIds = new Set(); // Tracks which IDs relay specifically added (so clearing relay can undo just those)
let groceryStoreLocations = [];  // Lat/lon of stores added by the primary scan (not relay)
let relayGeneration = 0;         // Incremented each time runRelay() starts; lets stale async calls bail out early
let lastKnownLon = null;         // Most recent GPS longitude (null until first fix)
let lastKnownLat = null;         // Most recent GPS latitude

// Feature toggle flags  each is flipped by the panel checkboxes
let busEnabled = false;          // Whether to show bus stops
let skytrainEnabled = false;     // Whether to show SkyTrain stops
let relayEnabled = false;        // Whether "Transit Relay" mode is active


// so basically this read whether the user is logged in from a hidden HTML input field.
// it controls whether a "Save" button appears inside store popups.
const IS_LOGGED_IN = document.getElementById("isLoggedIn").value === "true";

// get the mapbox token from the env file
mapboxgl.accessToken = MAPBOX_TOKEN;

// create the interactive map inside the div with id of "map".
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [-122.75, 49.22],
  zoom: 11,
maxBounds: [
  [-124.0, 48.5],   
  [-121.5, 50.0],   
],
});
// add the zoom in and zoom-out buttons the + and − to the map.
map.addControl(new mapboxgl.NavigationControl());

// Set up GPS tracking so the map can show the user real location.
// enableHighAccuracy: true use GPS chip for better precision
// trackUserLocation: true keep following the user as they move
// showUserHeading: true show a direction arrow on the location dot
const geolocate = new mapboxgl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true,
  showUserHeading: true,
});

// Add the GPS aka the locate button to the map.
map.addControl(geolocate);

/**
 * Ai helped to make this calculation for the circle coordinates.
 * Builds a GeoJSON polygon that approximates a circle.
 * Mapbox doesn't have a built in "draw circle" feature, so we calculate
 * 64 points around the centre and connect them into a ring.
 *
 * lon Centre longitude
 * lat Centre latitude
 * radiusMeters How large the circle should be (in metres)
 * returns GeoJSON FeatureCollection containing one polygon (the circle)
 */
function createCircleGeoJSON(lon, lat, radiusMeters) {
  const points = 64;       
  const km = radiusMeters / 1000;  

  // Work out how many degrees of lat/lon equal 1 km at this location.
  // 111.32 km ≈ 1 degree of latitude everywhere.
  // Longitude degrees shrink as you move toward the poles (cos correction).
  const distLat = km / 111.32;
  const distLon = km / (111.32 * Math.cos((lat * Math.PI) / 180));

  const coords = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI; // Evenly space points around 360°
    coords.push([
      lon + distLon * Math.cos(angle), // X position (longitude)
      lat + distLat * Math.sin(angle), // Y position (latitude)
    ]);
  }

  // Wrap in the GeoJSON format Mapbox expects
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

// An empty GeoJSON collection used to "erase" a layer 
const emptyGeoJSON = { type: "FeatureCollection", features: [] };


 // Registers the two scan circle data sources and drawing layers with Mapbox.
 // Called once when the map finishes loading.
 // There is two circles:
 // "scan circle user" follows the user's GPS position
 // "scan circle custom" follows a draggable pin the user placed manually

function initScanCircleLayers() {
  // Register the data source 
  map.addSource("scan-circle-user", { type: "geojson", data: emptyGeoJSON });

  // Semi transparent blue fill inside the circle
  map.addLayer({
    id: "scan-circle-user-fill",
    type: "fill",
    source: "scan-circle-user",
    paint: { "fill-color": "#2196F3", "fill-opacity": 0.10 },
  });

  // Blue border around the circle
  map.addLayer({
    id: "scan-circle-user-border",
    type: "line",
    source: "scan-circle-user",
    paint: { "line-color": "#2196F3", "line-width": 2, "line-opacity": 0.65 },
  });

  // Custom pin circle 
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

/**
 * Redraws the user GPS scan circle using the most recent GPS coordinates.
 * Does nothing if GPS hasn't started yet.
 */
function updateUserScanCircle() {
  if (!map.getSource("scan-circle-user") || lastKnownLat === null) return;
  map.getSource("scan-circle-user").setData(
    createCircleGeoJSON(lastKnownLon, lastKnownLat, pingRadius)
  );
}

/**
 * Redraws or clears the custom pin scan circle.
 * If no custom pin exists (customScanLon === null) the circle is erased.
 */
function updateCustomScanCircle() {
  if (!map.getSource("scan-circle-custom")) return;
  if (customScanLon === null) {
    // No custom pin active remove the circle
    map.getSource("scan-circle-custom").setData(emptyGeoJSON);
  } else {
    map.getSource("scan-circle-custom").setData(
      createCircleGeoJSON(customScanLon, customScanLat, pingRadius)
    );
  }
}

// Once the map tiles have fully loaded set up layers and trigger GPS.
map.on("load", () => {
  initScanCircleLayers(); // Register the circle drawing layers
  geolocate.trigger();    // Ask the browser for the user location immediately
});





/**
 * Removes all primary grocery-store markers from the map and resets the list.
 * Also clears the lat/lon store for the primary scan area.
 */
function clearMarkers() {
  currentMarkers.forEach((m) => m.remove());
  currentMarkers = [];
  groceryStoreLocations = [];
}

/**
 * Removes all relay-mode markers from the map, cancels any pending relay
 * timeouts, and cleans up relay-specific ID tracking so the next relay
 * run can re-discover those stores fresh.
 */
function clearRelayMarkers() {
  relayMarkers.forEach((m) => m.remove());
  relayMarkers = [];
  relayTimeouts.forEach((t) => clearTimeout(t));
  relayTimeouts = [];
  relayStoreLocations = [];
  // Undo the IDs relay added so the next runRelay can re-classify them
  relayAddedStoreIds.forEach((id) => addedStoreIds.delete(id));
  relayAddedStoreIds = new Set();
}


 // Returns the straight-line distance in kilometres between two lat/lon points.
 // Uses the Haversine formula (accounts for Earth's curvature).
 // AI assisted to write this function's formula.
 // @param {number} lat1  Latitude of point 1
 // @param {number} lon1  Longitude of point 1
 // @param {number} lat2  Latitude of point 2
 // @param {number} lon2  Longitude of point 2
 // @returns {number} Distance in km

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// Mapbox Category API Cache 
// Caches API responses for 5 minutes to avoid hammering Mapbox and hitting
// rate limits (HTTP 429 Too Many Requests) during the relay loop.
// key → { ts: timestamp, data: features[] }
const _mapboxCache = new Map();    
// 5 minutes in milliseconds
const CACHE_TTL_MS = 5 * 60 * 1000; 

/**
 * Builds a stable cache key from the category name and approximate coordinates.
 * Rounding to 3 decimal places (~111 m) means nearby repeated calls hit the cache.
 */
function _cacheKey(cat, lon, lat) {
  const rLon = Math.round(lon * 1000) / 1000;
  const rLat = Math.round(lat * 1000) / 1000;
  return `${cat}|${rLon}|${rLat}`;
}

/**
 * Fetches a list of places in a given category near [lon, lat] from the
 * Mapbox Search API. Returns a cached result if one exists and is fresh.
 *
 * @param {string} cat  Mapbox category slug (e.g. "grocery", "supermarket")
 * @param {number} lon  Search centre longitude
 * @param {number} lat  Search centre latitude
 * @returns {Promise<Array>} Array of GeoJSON feature objects
 */
function fetchMapboxCategory(cat, lon, lat) {
  const key = _cacheKey(cat, lon, lat);
  const cached = _mapboxCache.get(key);

  // Return the cached value if it hasn't expired
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return Promise.resolve(cached.data);
  }

  return fetch(
    `https://api.mapbox.com/search/searchbox/v1/category/${cat}?proximity=${lon},${lat}&limit=10&language=en&access_token=${MAPBOX_TOKEN}`
  )
    .then((res) => (res.ok ? res.json() : { features: [] }))
    .then((data) => {
      const features = data.features || [];
      _mapboxCache.set(key, { ts: Date.now(), data: features }); // Save to cache
      return features;
    })
    .catch(() => []); // On network error, return empty array gracefully
}


// ─── OSM Store Details (Hours, Phone, Website) ───────────────────────────────

/**
 * Converts the raw OpenStreetMap opening_hours string into readable HTML.
 * Examples: "Mo-Fr 09:00-21:00; Sa 10:00-18:00" → "Mon – Fri: 9:00 AM – 9:00 PM<br>Sat: 10:00 AM – 6:00 PM"
 *
 * @param {string|null} raw  The raw OSM hours string
 * @returns {string}         Human-readable hours or "Unavailable"
 */
function parseOSMHours(raw) {
  if (!raw) return "Unavailable";
  if (raw.trim().toLowerCase() === "24/7") return "Open 24/7";

  // Short OSM day codes → full names
  const dayMap = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun" };
  const dayOrder = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  // Converts "14:30" to "2:30 PM"
  function formatTime(t) {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  }

  // Expands "Mo-Fr" into ["Mo", "Tu", "We", "Th", "Fr"]
  function expandDayRange(range) {
    if (range.includes("-")) {
      const [start, end] = range.split("-");
      const si = dayOrder.indexOf(start);
      const ei = dayOrder.indexOf(end);
      if (si === -1 || ei === -1) return [range]; // Unknown day code — return as-is
      if (ei < si) return [dayOrder[si], dayOrder[ei]]; // Wrap-around (e.g. Su-Mo)
      return dayOrder.slice(si, ei + 1);
    }
    return [range]; // Single day, no expansion needed
  }

  try {
    // Split on ";" to handle multiple day-range entries
    const segments = raw.split(";").map(s => s.trim()).filter(Boolean);
    const lines = segments.map(seg => {
      // Match "Mo-Fr 09:00-21:00" pattern
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
      // Match "09:00-21:00" with no day prefix
      const timeOnlyMatch = seg.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
      if (timeOnlyMatch) {
        const [, open, close] = timeOnlyMatch;
        return `${formatTime(open)} – ${formatTime(close)}`;
      }
      return seg; // Return the segment unchanged if it doesn't match either pattern
    });
    return lines.join("<br>");
  } catch (e) {
    return raw; // If anything fails, show the raw string rather than crashing
  }
}

/**
 * Queries the free OpenStreetMap Overpass API for extra store details
 * (hours, phone, website) within 120 m of the given coordinates.
 * Tries to match by name; falls back to the closest result.
 *
 * @param {string} name   Store name (for fuzzy matching)
 * @param {number} lat    Latitude
 * @param {number} lon    Longitude
 * @returns {Promise<{hours, phone, website}|null>}
 */
async function fetchOSMDetails(name, lat, lon) {
  // Overpass query: find shops tagged as supermarket/convenience/grocery/department_store
  // within 120 metres of the given point
  const query = `[out:json][timeout:10];(node["shop"~"supermarket|convenience|grocery|department_store"](around:120,${lat},${lon});way["shop"~"supermarket|convenience|grocery|department_store"](around:120,${lat},${lon}););out tags center;`;
  try {
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.elements || data.elements.length === 0) return null;

    const nameLower = name.toLowerCase();
    // Try to find a result whose name matches our store name (substring check both ways)
    const best = data.elements.find(el =>
      el.tags?.name && (
        el.tags.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(el.tags.name.toLowerCase())
      )
    ) || data.elements[0]; // Fall back to the first result if no name match

    return {
      hours: best.tags?.opening_hours || null,
      phone: best.tags?.phone || best.tags?.["contact:phone"] || null,
      website: best.tags?.website || best.tags?.["contact:website"] || null,
    };
  } catch (e) {
    return null; // Network/parsing error — return null silently
  }
}

/**
 * Builds the HTML block displayed inside a store popup for hours/phone/website.
 *
 * @param {Object|null} details  Result from fetchOSMDetails (or null)
 * @returns {string} HTML string
 */
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

/**
 * Creates a unique HTML element ID for a store's detail block,
 * based on its coordinates (special characters replaced with underscores).
 */
function storeDetailsId(lon, lat) {
  return `sd_${String(lon).replace(/[^0-9]/g, "_")}_${String(lat).replace(/[^0-9]/g, "_")}`;
}


// ─── Non-Grocery Filter ───────────────────────────────────────────────────────

// List of keywords that indicate a result is NOT a grocery store.
// Mapbox's "grocery" and "supermarket" categories sometimes return clothing
// stores, pharmacies, dollar stores, etc. We filter those out by name.
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

/**
 * Returns true if the store name contains any word from the blocklist.
 * The check is case-insensitive.
 */
function isNonGroceryName(name) {
  const lower = (name || "").toLowerCase();
  return NON_GROCERY_NAME_BLOCKLIST.some((word) => lower.includes(word));
}

// The Mapbox category slugs to query.
// Querying multiple categories increases coverage (some stores are only
// tagged as "supermarket", others as "warehouse_store", etc.).
const CATEGORIES = [
  "grocery",
  "supermarket",
  "big_box_retail",
  "department_store",
  "warehouse_store",
  "wholesale_club",
];


// ─── Primary Grocery Store Fetch ─────────────────────────────────────────────

/**
 * Main entry point: clears all existing markers then fetches all grocery stores
 * near the given coordinates across all category types.
 * AI assisted to figure the logic of this function.
 *
 * @param {number} lon  Search centre longitude
 * @param {number} lat  Search centre latitude
 */
function fetchGroceryStores(lon, lat) {
  clearMarkers();
  clearRelayMarkers();
  addedStoreIds.clear(); // Reset dedup tracking for this fresh scan

  // Fire all category searches in parallel, then combine results
  Promise.all(
    CATEGORIES.map((cat) => fetchMapboxCategory(cat, lon, lat))
  )
    .then((results) => {
      // Deduplicate across categories: a store in both "grocery" AND "supermarket"
      // should only be shown once (identified by its mapbox_id)
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

      // Filter to only stores within the scan radius that aren't on the blocklist
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

          // Mark this store as already placed to avoid re-adding it in relay mode
          addedStoreIds.add(store.properties.mapbox_id);
          groceryStoreLocations.push({ lat: storeLat, lon: storeLon });

          // Create a unique ID for the details div so we can replace its
          // "Loading…" placeholder once the OSM fetch completes
          const did = storeDetailsId(storeLon, storeLat);

          // Build the popup content (the box shown when a marker is clicked)
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

          // Once the popup is opened, lazily fetch extra details from OSM
          popup.on("open", () => {
            fetchOSMDetails(name, storeLat, storeLon).then(details => {
              const el = document.getElementById(did);
              if (el) el.outerHTML = buildStoreDetailsHTML(details);
            });
          });

          // Place a green pin on the map with the popup attached
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


// ─── Transit Relay Mode ───────────────────────────────────────────────────────
// Relay mode extends the scan along bus/skytrain routes:
// 1. Find all bus/skytrain routes that pass within pingRadius.
// 2. Follow those routes up to transitExpansion km away.
// 3. At each distant stop, search for grocery stores within secondaryPingRadius.
// 4. Show those extra stores with coloured markers (yellow = bus, purple = SkyTrain, split = both).

/**
 * For a single transit stop, fetches nearby grocery stores and adds them
 * to a shared collector map (keyed by mapbox_id) so duplicate stores
 * discovered via multiple stops are merged rather than doubled.
 *
 * @param {number}  lon         Transit stop longitude
 * @param {number}  lat         Transit stop latitude
 * @param {string}  transitType "bus" or "skytrain"
 * @param {Map}     collector   Shared results collector: id → { feature, transitTypes }
 * @param {Function} onComplete Called when this stop's fetch is done
 */
function collectRelayStoresNear(lon, lat, transitType, collector, onComplete) {
  Promise.all(
    CATEGORIES.map((cat) => fetchMapboxCategory(cat, lon, lat)) // Uses cache to avoid repeat calls
  )
    .then((results) => {
      if (!relayEnabled) { if (onComplete) onComplete(); return; } // Bail if user turned relay off mid-run

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
            !addedStoreIds.has(id) && // Skip stores already on the map
            !isNonGroceryName(name)
          );
        })
        .forEach((store) => {
          const id = store.properties.mapbox_id;
          if (collector.has(id)) {
            // Store already found via a different stop — just add the transit type
            collector.get(id).transitTypes.add(transitType);
          } else {
            collector.set(id, { feature: store, transitTypes: new Set([transitType]) });
          }
        });

      if (onComplete) onComplete();
    })
    .catch(() => { if (onComplete) onComplete(); });
}

/**
 * Creates the custom split-colour pin DOM element used for stores reachable
 * by BOTH bus and SkyTrain (left half yellow, right half purple).
 */
function createSplitMarkerElement() {
  const el = document.createElement("div");
  el.className = "split-relay-marker"; // Styled in map.css
  return el;
}

/**
 * Places all stores collected by the relay scan onto the map with
 * colour-coded pins indicating transit type(s).
 *
 * @param {Map} collector  Map of id → { feature, transitTypes }
 */
function renderRelayStores(collector) {
  collector.forEach(({ feature, transitTypes }) => {
    const [storeLon, storeLat] = feature.geometry.coordinates;
    const name = feature.properties.name || "Grocery Store";
    const address =
      feature.properties.full_address ||
      feature.properties.place_formatted ||
      "Address unavailable";

    // Track this store so it isn't added again by a subsequent scan
    addedStoreIds.add(feature.properties.mapbox_id);
    relayAddedStoreIds.add(feature.properties.mapbox_id);
    relayStoreLocations.push({ lat: storeLat, lon: storeLon });

    const did = storeDetailsId(storeLon, storeLat);
    const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "300px" }).setHTML(`
      <div class="map-popup-body">
        <div class="map-popup-header">
          <strong class="map-popup-name">${name}</strong>
          <button class="map-popup-save-btn" onclick='saveLocation(this, ${JSON.stringify(name)}, ${JSON.stringify(address)})'>Save</button>
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

    // Choose pin colour/style based on which transit types serve this store
    if (hasBus && hasTrain) {
      // Split yellow/purple pin — reachable by both bus and SkyTrain
      marker = new mapboxgl.Marker({ element: createSplitMarkerElement(), anchor: "bottom" })
        .setLngLat([storeLon, storeLat])
        .setPopup(popup)
        .addTo(map);
    } else if (hasTrain) {
      // Purple pin — SkyTrain only
      marker = new mapboxgl.Marker({ color: "#8B5CF6" })
        .setLngLat([storeLon, storeLat])
        .setPopup(popup)
        .addTo(map);
    } else {
      // Yellow pin — bus only
      marker = new mapboxgl.Marker({ color: "#FFD700" })
        .setLngLat([storeLon, storeLat])
        .setPopup(popup)
        .addTo(map);
    }

    relayMarkers.push(marker);
  });
}

/**
 * Orchestrates the full relay scan:
 *   1. Load bus/skytrain stop JSON files.
 *   2. Find all routes that cross the primary scan area.
 *   3. Follow those routes up to transitExpansion km.
 *   4. Deduplicate stop list.
 *   5. For each stop, fetch nearby stores (staggered by 150 ms to avoid rate limits).
 *   6. Once all stops are processed, render results and show transit stop markers.
 *
 * @param {number} lon  Centre longitude (where the user/custom pin is)
 * @param {number} lat  Centre latitude
 */
function runRelay(lon, lat) {
  clearRelayMarkers();
  const generation = ++relayGeneration; // Snapshot generation so stale async calls can self-cancel

  Promise.all([
    fetch("/data/busStops.json").then((r) => r.json()),
    fetch("/data/skytrainStops.json").then((r) => r.json()),
  ]).then(([busStopsRaw, skytrainStopsRaw]) => {
    // If a newer relay run has already started, discard this one
    if (generation !== relayGeneration) return;

    // Tag each stop with its transit type so we can tell them apart later
    busStopsRaw.forEach((s) => { s._transitType = "bus"; });
    skytrainStopsRaw.forEach((s) => { s._transitType = "skytrain"; });

    // Only include the transit types the user has toggled on
    const allStops = [
      ...(busEnabled ? busStopsRaw : []),
      ...(skytrainEnabled ? skytrainStopsRaw : []),
    ];

    // Helper: fired on any early exit so transit stop markers still appear
    const finishWithStops = () => {
      if (busEnabled) fetchBusStops(lon, lat);
      if (skytrainEnabled) fetchSkytrainStops(lon, lat);
    };

    if (allStops.length === 0) { finishWithStops(); return; }

    // Step 1: collect every route that has a stop inside the primary scan radius
    const nearbyRoutes = new Set();
    allStops.forEach((stop) => {
      if (haversineKm(lat, lon, stop.lat, stop.lon) <= pingRadius / 1000)
        Object.keys(stop.routes).forEach((r) => nearbyRoutes.add(r));
    });
    if (nearbyRoutes.size === 0) { finishWithStops(); return; }

    // Step 2: expand along those routes up to transitExpansion km
    const seen = new Set();
    const expanded = [];
    allStops.forEach((stop) => {
      const onNearbyRoute = Object.keys(stop.routes).some((r) => nearbyRoutes.has(r));
      const withinExpansion = haversineKm(lat, lon, stop.lat, stop.lon) <= transitExpansion;
      // Prefix with transit type to prevent bus stop #5 and skytrain stop #5 colliding
      const uid = `${stop._transitType}_${stop.id}`;
      if (onNearbyRoute && withinExpansion && !seen.has(uid)) {
        seen.add(uid);
        expanded.push(stop);
      }
    });

    // Step 3: deduplicate stops that are too close together or cover identical stores
    const deduped50m   = deduplicateStops(expanded, lat, lon);
    const stopsToFetch = deduplicateByStoreOverlap(deduped50m, lat, lon);

    if (stopsToFetch.length === 0) { finishWithStops(); return; }

    // Shared collector across all stop fetches: id → { feature, transitTypes }
    const collector = new Map();

    let completed = 0;
    const onStopComplete = () => {
      if (generation !== relayGeneration) return; // Stale run — discard
      completed++;
      if (completed < stopsToFetch.length) return; // Still waiting on other stops

      // All stops finished — render results and show transit stop markers
      renderRelayStores(collector);

      // BUG FIX: Transit stop markers are fired here (only once, after relay stores
      // have been added to relayStoreLocations) so isNearGroceryStore() works correctly.
      if (busEnabled) fetchBusStops(lon, lat);
      if (skytrainEnabled) fetchSkytrainStops(lon, lat);
    };

    // Stagger each stop fetch by 150 ms to avoid hammering the API simultaneously
    stopsToFetch.forEach((stop, i) => {
      const t = setTimeout(
        () => collectRelayStoresNear(stop.lon, stop.lat, stop._transitType, collector, onStopComplete),
        i * 150
      );
      relayTimeouts.push(t); // Keep the timeout ID so clearRelayMarkers() can cancel it
    });

  }).catch((err) => {
    console.error("Failed to load transit stops for relay:", err);
    if (busEnabled) fetchBusStops(lon, lat);
    if (skytrainEnabled) fetchSkytrainStops(lon, lat);
  });
}

/**
 * Sends a POST request to the server to save a grocery store to the
 * logged-in user's saved locations list.
 * The Save button is visually updated to "Saved" (red, disabled) on success.
 *
 * @param {HTMLButtonElement} button   The Save button element (to update its state)
 * @param {string}            name     Store name
 * @param {string}            address  Store address
 */
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
    button.disabled = true; // Prevent double-saving
  }

  alert(result.message); // Show server response message to the user
}


let initialLoadDone = false; // Guards against triggering a full scan on every GPS update

// Fires each time the browser provides a new GPS position
geolocate.on("geolocate", (e) => {
  lastKnownLon = e.coords.longitude;
  lastKnownLat = e.coords.latitude;

  updateUserScanCircle(); // Redraw the blue scan circle at the new position

  // Only do the first full scan once — after that, GPS position updates
  // don't automatically re-scan (the user must click "Apply and Rescan")
  if (!initialLoadDone) {
    initialLoadDone = true;
    fetchGroceryStores(lastKnownLon, lastKnownLat);
  }
});

// References to the side panel UI elements
const panel     = document.getElementById("radius-panel");
const toggleBtn = document.getElementById("radius-toggle");
const applyBtn  = document.getElementById("radius-apply");
const radiusInput = document.getElementById("radius-input");

// Checkbox elements for each transit/feature toggle
const busToggle      = document.getElementById("bus-toggle");
const skytrainToggle = document.getElementById("skytrain-toggle");
const relayToggle    = document.getElementById("relay-toggle");

// When the user ticks/unticks the "Show Bus Stops" checkbox:
busToggle.addEventListener("change", () => {
  busEnabled = busToggle.checked;
  if (!busEnabled) {
    clearBusMarkers(); // Remove all blue bus-stop pins
  } else if (lastKnownLon !== null) {
    fetchBusStops(lastKnownLon, lastKnownLat); // Show bus stops immediately
  }
  // Re-run relay so it uses the updated bus/skytrain selection
  if (relayEnabled && lastKnownLon !== null) {
    runRelay(lastKnownLon, lastKnownLat);
  }
});

// When the user ticks/unticks the "Show SkyTrain Stops" checkbox:
skytrainToggle.addEventListener("change", () => {
  skytrainEnabled = skytrainToggle.checked;
  if (!skytrainEnabled) {
    clearSkytrainMarkers(); // Remove all orange SkyTrain pins
  } else if (lastKnownLon !== null) {
    fetchSkytrainStops(lastKnownLon, lastKnownLat); // Show SkyTrain stops immediately
  }
  // Re-run relay with updated selection
  if (relayEnabled && lastKnownLon !== null) {
    runRelay(lastKnownLon, lastKnownLat);
  }
});

// When the user ticks/unticks the "Transit Relay Mode" checkbox:
relayToggle.addEventListener("change", () => {
  relayEnabled = relayToggle.checked;
  if (!relayEnabled) {
    clearRelayMarkers(); // Remove yellow/purple relay markers
  } else if (lastKnownLon !== null) {
    runRelay(lastKnownLon, lastKnownLat); // Start relay scan immediately
  }
});

// When the user ticks/unticks the "Show Food Banks" checkbox:
const foodBankToggle = document.getElementById("foodbank-toggle");
foodBankToggle.addEventListener("change", () => {
  foodBanksEnabled = foodBankToggle.checked;
  if (foodBanksEnabled) {
    if (foodBankData.length > 0) {
      renderFoodBanks(); // Data already loaded — just show the markers
    } else {
      // First time enabling — load the JSON file from the server
      fetch("/data/foodBanks.json")
        .then((res) => res.json())
        .then((data) => {
          foodBankData = data;
          renderFoodBanks();
        })
        .catch((err) => console.error("Failed to load food bank data:", err));
    }
  } else {
    clearFoodBankMarkers(); // Hide all food bank pins
  }
});

// Toggle the side panel open/closed when the arrow button is clicked
toggleBtn.addEventListener("click", () => {
  panel.classList.toggle("open");
  toggleBtn.textContent = panel.classList.contains("open") ? "›" : "‹";
});

// BUG FIX: Only one applyBtn listener exists here. The original code had two
// listeners which caused fetchGroceryStores to fire twice (once with wrong
// coordinates when a custom pin was active). Now one listener handles both cases.
applyBtn.addEventListener("click", () => {

  // Read the new values from the panel inputs
  const val          = parseFloat(radiusInput.value);
  const expansionVal = parseFloat(document.getElementById("expansion-input").value);
  const secondaryVal = parseFloat(document.getElementById("secondary-input").value);

  // Update state only if the input is a valid positive number
  if (!isNaN(val) && val > 0) pingRadius = val;
  if (!isNaN(expansionVal) && expansionVal > 0) transitExpansion = Math.min(expansionVal, 5);  // Cap at 5 km
  if (!isNaN(secondaryVal) && secondaryVal > 0) secondaryPingRadius = Math.min(secondaryVal, 300); // Cap at 300 m

  // Use the custom pin's location if active; otherwise use GPS
  const scanLon = customScanLon !== null ? customScanLon : lastKnownLon;
  const scanLat = customScanLat !== null ? customScanLat : lastKnownLat;

  if (scanLon !== null && scanLat !== null) {
    fetchGroceryStores(scanLon, scanLat); // Trigger a fresh scan with the new settings
  }

  // Redraw scan circles to reflect the potentially new radius
  updateUserScanCircle();
  updateCustomScanCircle();

  // Close the panel after applying
  panel.classList.remove("open");
  toggleBtn.textContent = "‹";
});


// First Time Welcome Popup 
const mapPopup = document.getElementById("mapFirstTimePopup");
const closeBtn = document.getElementById("closeMapPopup");

// Show the popup only if the user has never visited the map page before
// (stored in localStorage so it persists across sessions in the same browser)
if (!localStorage.getItem("hasVisitedMap")) {
  mapPopup.style.display = "flex";
}

closeBtn.addEventListener("click", () => {
  mapPopup.style.display = "none";
  localStorage.setItem("hasVisitedMap", "true"); // Don't show again
});

let busMarkers = [];       // All blue bus stop pins currently on the map
let skytrainMarkers = [];  // All orange SkyTrain stop pins currently on the map

/** Removes all bus-stop pins from the map and empties the array. */
function clearBusMarkers() {
  busMarkers.forEach((m) => m.remove());
  busMarkers = [];
}

/** Removes all SkyTrain stop pins from the map and empties the array. */
function clearSkytrainMarkers() {
  skytrainMarkers.forEach((m) => m.remove());
  skytrainMarkers = [];
}

/**
 * Returns true if a transit stop is within secondaryPingRadius metres of
 * any grocery store that was placed by either the primary scan or relay.
 * Used to decide whether a distant stop is "interesting" enough to show.
 *
 * @param {number} stopLat  Transit stop latitude
 * @param {number} stopLon  Transit stop longitude
 */
function isNearGroceryStore(stopLat, stopLon) {
  const allStores = [...groceryStoreLocations, ...relayStoreLocations];
  return allStores.some(
    (store) => haversineKm(stopLat, stopLon, store.lat, store.lon) <= secondaryPingRadius / 1000
  );
}

/**
 * Removes stops that are effectively duplicates:
 * two stops within 50 m that share at least one route only the closer one
 * to the user is kept unless the farther one sits next to a grocery store.
 *
 * @param {Array}  stops    Stop objects with lat/lon/routes
 * @param {number} userLat  User latitude (to measure "closer")
 * @param {number} userLon  User longitude
 * @returns {Array} Filtered stop list
 */
function deduplicateStops(stops, userLat, userLon) {
  const DEDUP_KM = 0.05; // 50 m threshold
  const toRemove = new Set();

  for (let i = 0; i < stops.length; i++) {
    if (toRemove.has(i)) continue;
    for (let j = i + 1; j < stops.length; j++) {
      if (toRemove.has(j)) continue;
      if (haversineKm(stops[i].lat, stops[i].lon, stops[j].lat, stops[j].lon) > DEDUP_KM) continue;

      // Only deduplicate if they share at least one route (same bus/train line)
      const routesI = new Set(Object.keys(stops[i].routes));
      const sharesRoute = Object.keys(stops[j].routes).some((r) => routesI.has(r));
      if (!sharesRoute) continue;

      // Remove the farther stop UNLESS it's near a grocery store
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


 // Builds a key string representing which grocery stores are within
 // secondaryPingRadius of a given stop.
 // Two stops with the same key cover exactly the same set of stores.

function getStopStoreKey(stopLat, stopLon) {
  return groceryStoreLocations
    .map((store, i) =>
      haversineKm(stopLat, stopLon, store.lat, store.lon) <= secondaryPingRadius / 1000 ? i : null
    )
    .filter((i) => i !== null)
    .join(",");
}

 // Further deduplicates stops that share a route AND cover the same grocery stores.
 // Keeps only the closer stop to the user.

function deduplicateByStoreOverlap(stops, userLat, userLon) {
  const toRemove = new Set();

  for (let i = 0; i < stops.length; i++) {
    if (toRemove.has(i)) continue;
    const keyI = getStopStoreKey(stops[i].lat, stops[i].lon);
    if (keyI === "") continue; // Stop doesn't cover any known store keep it

    for (let j = i + 1; j < stops.length; j++) {
      if (toRemove.has(j)) continue;
      const routesI = new Set(Object.keys(stops[i].routes));
      const sharesRoute = Object.keys(stops[j].routes).some((r) => routesI.has(r));
      if (!sharesRoute) continue;

      const keyJ = getStopStoreKey(stops[j].lat, stops[j].lon);
      if (keyI !== keyJ) continue; // Different store coverage keep both

      // Same route, same stores remove the farther stop
      const distI = haversineKm(userLat, userLon, stops[i].lat, stops[i].lon);
      const distJ = haversineKm(userLat, userLon, stops[j].lat, stops[j].lon);
      toRemove.add(distI >= distJ ? i : j);
    }
  }

  return stops.filter((_, idx) => !toRemove.has(idx));
}

 // Fetches bus stop data, finds routes near the user, then shows blue pins
 // for each relevant stop (within the expanded route corridor and near a store).
 // The popup for each pin lists the route numbers and their departure times.

function fetchBusStops(lon, lat) {
  clearBusMarkers();
  fetch("/data/busStops.json")
    .then((res) => res.json())
    .then((stops) => {
      // Step 1: find all route numbers that pass through the primary scan area
      const pingedRoutes = new Set();
      stops.forEach((stop) => {
        if (haversineKm(lat, lon, stop.lat, stop.lon) <= pingRadius / 1000) {
          Object.keys(stop.routes).forEach((r) => pingedRoutes.add(r));
        }
      });

      if (pingedRoutes.size === 0) return; // No bus routes nearby nothing to show

      // Step 2: expand along those routes up to transitExpansion km
      const expanded = stops.filter((stop) => {
        const onPingedRoute = Object.keys(stop.routes).some((r) => pingedRoutes.has(r));
        const withinExpansion = haversineKm(lat, lon, stop.lat, stop.lon) <= transitExpansion;
        return onPingedRoute && withinExpansion;
      });

      // Step 3: deduplicate and filter to only stops worth showing
      const deduped50m = deduplicateStops(expanded, lat, lon);
      const stopsToShow = deduplicateByStoreOverlap(deduped50m, lat, lon).filter((stop) =>
        haversineKm(lat, lon, stop.lat, stop.lon) <= pingRadius / 1000 ||
        isNearGroceryStore(stop.lat, stop.lon)
      );

      // Step 4: place a blue pin for each stop with route/schedule details
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


 // Same as fetchBusStops but for SkyTrain stops uses orange pins.
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
          new mapboxgl.Marker({ color: "#FF6B00" }) // Orange pins for SkyTrain
            .setLngLat([stop.lon, stop.lat])
            .setPopup(popup)
            .addTo(map),
        );
      });
    });
}

let foodBankMarkers = [];   // All dark orange food bank pins on the map
let foodBanksEnabled = false; // Whether the food bank toggle is on
let foodBankData = [];        // Cached food bank JSON (loaded once on first toggle)

/**
 * Places a dark orange pin for every food bank in foodBankData.
 * The popup shows name, address, phone, optional email, and a website link.
 */
function renderFoodBanks() {
  foodBankData.forEach((fb) => {
    // Email is optional only show the link if one exists in the data
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

    const marker = new mapboxgl.Marker({ color: "#FF8C00" }) // Dark orange
      .setLngLat([fb.lon, fb.lat])
      .setPopup(popup)
      .addTo(map);

    foodBankMarkers.push(marker);
  });
}

/** Removes all food bank pins from the map and empties the array. */
function clearFoodBankMarkers() {
  foodBankMarkers.forEach((m) => m.remove());
  foodBankMarkers = [];
}


// Allows the user to drag a red pin anywhere on the map to scan a custom
// location instead of their GPS position.

let customMarker = null;   // The draggable red Mapbox Marker (null when not active)
let customScanLon = null;  // Longitude of the custom scan pin (null when not active)
let customScanLat = null;  // Latitude of the custom scan pin

const customBtn  = document.getElementById("custom-location-btn");
const customIcon = document.getElementById("custom-location-icon");

 // Enters custom-pin mode:
 // Places a draggable red pin at the user's current GPS position.
 // Dragging the pin live-updates the custom-scan circle;
 // dropping it (dragend) triggers a full re-scan of the new location.
 // The user-GPS scan circle is hidden while a custom pin is active.
function enterCustomMode() {
  if (lastKnownLon === null || lastKnownLat === null) return; // Can't enter if GPS hasn't fired

  customScanLon = lastKnownLon;
  customScanLat = lastKnownLat;

  // Create a draggable red pin at the GPS position
  customMarker = new mapboxgl.Marker({ color: "#e53935", draggable: true })
    .setLngLat([customScanLon, customScanLat])
    .addTo(map);

  // While dragging: update the circle in real time
  customMarker.on("drag", () => {
    const lngLat = customMarker.getLngLat();
    customScanLon = lngLat.lng;
    customScanLat = lngLat.lat;
    updateCustomScanCircle();
  });

  // When the user releases the pin: trigger a scan at the new position
  customMarker.on("dragend", () => {
    const lngLat = customMarker.getLngLat();
    customScanLon = lngLat.lng;
    customScanLat = lngLat.lat;
    fetchGroceryStores(customScanLon, customScanLat);
  });

  // Swap the button icon to an "×" to indicate the mode can be exited
  customIcon.src = "/images/xPing.png";
  customBtn.classList.add("active");

  updateCustomScanCircle();

  // Hide the GPS scan circle while a custom pin is active
  map.setLayoutProperty("scan-circle-user-fill", "visibility", "none");
  map.setLayoutProperty("scan-circle-user-border", "visibility", "none");

  fetchGroceryStores(customScanLon, customScanLat); // Initial scan at pin position
}

/**
 * Exits custom pin mode:
 * Removes the draggable red pin, restores the GPS scan circle, and
 * re scans from the user's GPS position.
 */
function exitCustomMode() {
  if (customMarker) {
    customMarker.remove();
    customMarker = null;
  }
  customScanLon = null;
  customScanLat = null;

  // Restore the default pin icon
  customIcon.src = "/images/locationPing.png";
  customBtn.classList.remove("active");

  updateCustomScanCircle(); // Clears the custom circle (customScanLon is now null)

  // Show the GPS scan circle again
  map.setLayoutProperty("scan-circle-user-fill", "visibility", "visible");
  map.setLayoutProperty("scan-circle-user-border", "visibility", "visible");

  if (lastKnownLon !== null && lastKnownLat !== null) {
    fetchGroceryStores(lastKnownLon, lastKnownLat); // Re-scan from GPS
  }
}

// Toggle custom-pin mode on or off each time the button is clicked
customBtn.addEventListener("click", () => {
  if (customMarker) {
    exitCustomMode();  // Pin is active remove it
  } else {
    enterCustomMode(); // Pin is not active place it
  }
});