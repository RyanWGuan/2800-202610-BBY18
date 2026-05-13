document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById("savedLocationsPopup");
    const closeBtn = document.getElementById("closeSavedLocationsPopup");
    const container = document.getElementById("savedLocationsContainer");

    // Show popup every time the page opens
    popup.style.display = "flex";

    closeBtn.addEventListener("click", () => {
        popup.style.display = "none";
    });

    const savedLocations =
        JSON.parse(localStorage.getItem("savedLocations")) || [];

    if (savedLocations.length === 0) {
        container.innerHTML = "<p>No saved locations yet.</p>";
        return;
    }

    savedLocations.forEach((location, index) => {
        const card = document.createElement("div");
        card.classList.add("location_card");

        card.innerHTML = `
            <div class="location_text">
                <h2>${location.name}</h2>

                <p>${location.address}</p>

                <button
                    class="delete_button"
                    onclick="deleteLocation(${index})"
                >
                    Delete
                </button>
            </div>

            <div class="location_image">
                Image
            </div>
        `;

        container.appendChild(card);
    });
});

function deleteLocation(index)
{
    const savedLocations =
        JSON.parse(localStorage.getItem("savedLocations")) || [];

    savedLocations.splice(index, 1);

    localStorage.setItem(
        "savedLocations",
        JSON.stringify(savedLocations)
    );

    location.reload();
}