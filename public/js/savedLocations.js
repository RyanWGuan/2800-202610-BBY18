document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById("savedLocationsPopup");
    const closeBtn = document.getElementById("closeSavedLocationsPopup");
  
    if (!localStorage.getItem("hasVisitedSavedLocations")) {
      popup.style.display = "flex";
    } else {
      popup.style.display = "none";
    }
  
    closeBtn.addEventListener("click", () => {
      popup.style.display = "none";
      localStorage.setItem("hasVisitedSavedLocations", "true");
    });
  });
  
  async function deleteLocation(locationId) {
    const response = await fetch(`/deleteSavedLocation/${locationId}`, {
      method: "DELETE",
    });
  
    const result = await response.json();
    alert(result.message);
  
    location.reload();
  }