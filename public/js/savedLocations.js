//Listener to check if user visited saved locations page before
document.addEventListener("DOMContentLoaded", () => {

    const popup = document.getElementById("savedLocationsPopup");
    const closeBtn = document.getElementById("closeSavedLocationsPopup");

    //Show popup only for first time visitors
    if (!localStorage.getItem("hasVisitedSavedLocations")) {
        popup.style.display = "flex";
    } else {
        popup.style.display = "none";
    }

    //Close popup and save visit status
    closeBtn.addEventListener("click", () => {
        popup.style.display = "none";
        localStorage.setItem("hasVisitedSavedLocations", "true");
    });
});

//Delete saved location from database
async function deleteLocation(locationId) {

    const response = await fetch(`/deleteSavedLocation/${locationId}`, {
        method: "DELETE",
    });

    const result = await response.json();

    alert(result.message);

    //Reload page after deleting location
    location.reload();
}