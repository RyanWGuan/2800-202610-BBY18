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
                    <div style="font-family: sans-serif; padding: 4px;">
                        <strong style="font-size: 14px;">${name}</strong>
                        <p style="font-size: 12px; margin: 4px 0 0 0; color: gray;">${address}</p>
                    </div>
                `);

                new mapboxgl.Marker({ color: 'green' })
                    .setLngLat([storeLon, storeLat])
                    .setPopup(popup)
                    .addTo(map);
            });
        });
});