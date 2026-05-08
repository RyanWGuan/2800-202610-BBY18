mapboxgl.accessToken = MAPBOX_TOKEN;

const map = new mapboxgl.Map({
<<<<<<< HEAD
  container: "map",
  style: "mapbox://styles/mapbox/streets-v12",
  center: [0, 0],
  zoom: 2,
=======
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [0, 0],
    zoom: 2
>>>>>>> RyanGuan_SignUp
});

map.addControl(new mapboxgl.NavigationControl());

const geolocate = new mapboxgl.GeolocateControl({
<<<<<<< HEAD
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true,
  showUserHeading: true,
=======
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true
>>>>>>> RyanGuan_SignUp
});

map.addControl(geolocate);

<<<<<<< HEAD
map.on("load", () => {
  geolocate.trigger();
});

// --- Radius panel state ---
let pingRadius = 5; // km (default)
let currentMarkers = [];
let lastKnownLon = null;
let lastKnownLat = null;

function clearMarkers() {
  currentMarkers.forEach((m) => m.remove());
  currentMarkers = [];
}

// Returns distance in km between two lat/lon points
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
=======
map.on('load', () => {
    geolocate.trigger();
});

geolocate.on('geolocate', (e) => {
    const lon = e.coords.longitude;
    const lat = e.coords.latitude;

    fetch(`https://api.mapbox.com/search/searchbox/v1/category/grocery?proximity=${lon},${lat}&limit=5&access_token=${MAPBOX_TOKEN}`)
        .then(res => res.json())
        .then(data => {
            data.features.forEach(store => {
                const [storeLon, storeLat] = store.geometry.coordinates;
                const name = store.properties.name || 'Grocery Store';
                const address = store.properties.full_address || store.properties.place_formatted || 'Address unavailable';

                const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
>>>>>>> RyanGuan_SignUp
                    <div style="font-family: sans-serif; padding: 4px;">
                        <strong style="font-size: 14px;">${name}</strong>
                        <p style="font-size: 12px; margin: 4px 0 0 0; color: gray;">${address}</p>
                    </div>
                `);

<<<<<<< HEAD
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

// --- Radius panel UI logic ---
const panel = document.getElementById("radius-panel");
const toggleBtn = document.getElementById("radius-toggle");
const applyBtn = document.getElementById("radius-apply");
const radiusInput = document.getElementById("radius-input");

toggleBtn.addEventListener("click", () => {
  panel.classList.toggle("open");
  toggleBtn.textContent = panel.classList.contains("open") ? "›" : "‹";
});

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

// --- First-time popup ---
const mapPopup = document.getElementById("mapFirstTimePopup");
const closeBtn = document.getElementById("closeMapPopup");

if (!localStorage.getItem("hasVisitedMap")) {
  mapPopup.style.display = "flex";
}

closeBtn.addEventListener("click", () => {
  mapPopup.style.display = "none";
  localStorage.setItem("hasVisitedMap", "true");
});
=======
                new mapboxgl.Marker({ color: 'green' })
                    .setLngLat([storeLon, storeLat])
                    .setPopup(popup)
                    .addTo(map);
            });
        });
});
>>>>>>> RyanGuan_SignUp
