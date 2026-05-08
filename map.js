mapboxgl.accessToken = MAPBOX_TOKEN;

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [0, 0],
    zoom: 2
});

map.addControl(new mapboxgl.NavigationControl());

const geolocate = new mapboxgl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true
});

map.addControl(geolocate);

// Automatically go to user location once the map loads
map.on('load', () => {
    geolocate.trigger();
});