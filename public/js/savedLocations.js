document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById("savedLocationsPopup");
    const closeBtn = document.getElementById("closeSavedLocationsPopup");

    popup.style.display = "flex";

    closeBtn.addEventListener("click", () => {
        popup.style.display = "none";
    });
});