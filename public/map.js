mapboxgl.accessToken = MAPBOX_TOKEN;

const radiusCalc = 180;
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
let pingRadius = 5;
let currentMarkers = [];
let lastKnownLon = null;
let lastKnownLat = null;

function clearMarkers() {
  currentMarkers.forEach((m) => m.remove());
  currentMarkers = [];
}

// Returns distance in km between two lat/lon points AI assisted.
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / radiusCalc;
  const dLon = ((lon2 - lon1) * Math.PI) / radiusCalc;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / radiusCalc) *
      Math.cos((lat2 * Math.PI) / radiusCalc) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// AI assisted to get store fetching logic working with new Mapbox Search API endpoint.
function fetchGroceryStores(lon, lat) {
  clearMarkers();

  fetch(
    `https://api.mapbox.com/search/searchbox/v1/category/grocery?proximity=${lon},${lat}&limit=25&access_token=${MAPBOX_TOKEN}`,
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
                        <strong style="font-size: 14px;">${name}</strong>
                        <p style="font-size: 12px; margin: 4px 0 0 0; color: gray;">${address}</p>
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

geolocate.on("geolocate", (e) => {
  lastKnownLon = e.coords.longitude;
  lastKnownLat = e.coords.latitude;
  fetchGroceryStores(lastKnownLon, lastKnownLat);
});

// radius panel toggle and logic ussing buttons.
const panel = document.getElementById("radius-panel");
const toggleBtn = document.getElementById("radius-toggle");
const applyBtn = document.getElementById("radius-apply");
const radiusInput = document.getElementById("radius-input");

toggleBtn.addEventListener("click", () => {
  panel.classList.toggle("open");
  toggleBtn.textContent = panel.classList.contains("open") ? "›" : "‹";
});

// field validation and applying new radius value.
applyBtn.addEventListener("click", () => {
  const val = parseFloat(radiusInput.value);
  if (!isNaN(val) && val > 0) {
    pingRadius = val;
    if (lastKnownLon !== null && lastKnownLat !== null) {
      fetchGroceryStores(lastKnownLon, lastKnownLat);
    }
    panel.classList.remove("open");
    toggleBtn.textContent = "‹";
  }
});
