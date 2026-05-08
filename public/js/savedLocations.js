document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById("savedLocationsPopup");
    const closeBtn = document.getElementById("closeSavedLocationsPopup");

    const hasVisitedSavedLocations = localStorage.getItem("hasVisitedSavedLocations");

    if (!hasVisitedSavedLocations) {
        popup.style.display = "flex";
    }

    closeBtn.addEventListener("click", () => {
        popup.style.display = "none";
        localStorage.setItem("hasVisitedSavedLocations", "true");
    });
});