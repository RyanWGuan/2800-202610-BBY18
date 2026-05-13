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

map.on("load", () => {
  geolocate.trigger();
});

// Radius panel state
let pingRadius = 5; // km 
let currentMarkers = [];
let lastKnownLon = null;
let lastKnownLat = null;

function clearMarkers() {
  currentMarkers.forEach((m) => m.remove());
  currentMarkers = [];
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

  fetch(
    `https://api.mapbox.com/search/searchbox/v1/category/grocery?proximity=${lon},${lat}&limit=10&access_token=${MAPBOX_TOKEN}`,
  )
    .then((res) => res.json())
    .then((data) => {
      data.features
        .filter((store) => {
          const [storeLon, storeLat] = store.geometry.coordinates;
          return haversineKm(lat, lon, storeLat, storeLon) <= pingRadius;
        })
        .forEach((store) => {
          const [storeLon, storeLat] = store.geometry.coordinates;
          const name = store.properties.name || "Grocery Store";
          const address =
            store.properties.full_address ||
            store.properties.place_formatted ||
            "Address unavailable";

          const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="font-family: sans-serif; padding: 4px;">
              <strong style="font-size: 14px;">
                ${name}
              </strong>

              <p style="font-size: 12px; margin: 4px 0 0 0; color: black;">
                ${address}
              </p>
            </div>
          `);

          const marker = new mapboxgl.Marker({ color: "green" })
            .setLngLat([storeLon, storeLat])
            .setPopup(popup)
            .addTo(map);

          currentMarkers.push(marker);
        });
    });
}

// When the user's location is obtained or updated,
//  fetch nearby grocery stores and transit stops based on
//  their last known locations and the selected radius.
geolocate.on("geolocate", (e) => {
  lastKnownLon = e.coords.longitude;
  lastKnownLat = e.coords.latitude;
  fetchGroceryStores(lastKnownLon, lastKnownLat);
  if (transitEnabled) 
  {
    fetchBusStops(lastKnownLon, lastKnownLat);
    fetchSkytrainStops(lastKnownLon, lastKnownLat);
  }
});

// the arrow pop up for radius selection logic
const panel = document.getElementById("radius-panel");
const toggleBtn = document.getElementById("radius-toggle");
const applyBtn = document.getElementById("radius-apply");
const transitToggle = document.getElementById("transit-toggle");
const radiusInput = document.getElementById("radius-input");

let transitEnabled = true;

transitToggle.addEventListener("change", () => 
{
  transitEnabled = transitToggle.checked;
  if (!transitEnabled) {
    clearBusMarkers();
    clearSkytrainMarkers();
  } else if (lastKnownLon !== null) {
    fetchBusStops(lastKnownLon, lastKnownLat);
    fetchSkytrainStops(lastKnownLon, lastKnownLat);
  }
});

toggleBtn.addEventListener("click", () => 
{
  panel.classList.toggle("open");
  toggleBtn.textContent = panel.classList.contains("open") ? "›" : "‹";
});

// the logic to update the radius and refetch data when the user applies a new radius.
// also validates the input.
applyBtn.addEventListener("click", () => 
{
  const val = parseFloat(radiusInput.value);
  if (!isNaN(val) && val > 0) 
  {
    pingRadius = val;
    if (lastKnownLon !== null && lastKnownLat !== null) 
    {
      fetchGroceryStores(lastKnownLon, lastKnownLat);
      fetchBusStops(lastKnownLon, lastKnownLat);
      fetchSkytrainStops(lastKnownLon, lastKnownLat);
    }
    panel.classList.remove("open");
    toggleBtn.textContent = "‹";
  }
});

// First time popup logic
const mapPopup = document.getElementById("mapFirstTimePopup");
const closeBtn = document.getElementById("closeMapPopup");

if (!localStorage.getItem("hasVisitedMap")) 
{
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

function fetchBusStops(lon, lat) {
  clearBusMarkers();
  fetch("/data/busStops.json")
    .then((res) => res.json())
    .then((stops) => {
      stops
        .filter(
          (stop) => haversineKm(lat, lon, stop.lat, stop.lon) <= pingRadius,
        )
        .forEach((stop) => {
          const routeLines = Object.entries(stop.routes)
            .map(
              ([routeName, schedule]) => `
              <div style="margin-top: 6px;">
                <strong>Route ${routeName}</strong><br>${schedule.join("<br>")}
              </div>`,
            )
            .join("");
          const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "280px" })
            .setHTML(`
            <div style="font-family: sans-serif; padding: 4px; max-height: 200px; overflow-y: auto;">
              <strong style="font-size: 14px;">${stop.name}</strong>${routeLines}
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
      stops
        .filter(
          (stop) => haversineKm(lat, lon, stop.lat, stop.lon) <= pingRadius,
        )
        .forEach((stop) => {
          const routeLines = Object.entries(stop.routes)
            .map(
              ([routeName, schedule]) => `
              <div style="margin-top: 6px;">
                <strong>Route ${routeName}</strong><br>${schedule.join("<br>")}
              </div>`,
            )
            .join("");
          const popup = new mapboxgl.Popup({ offset: 25, maxWidth: "280px" })
            .setHTML(`
            <div style="font-family: sans-serif; padding: 4px; max-height: 200px; overflow-y: auto;">
              <strong style="font-size: 14px;">${stop.name}</strong>${routeLines}
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
