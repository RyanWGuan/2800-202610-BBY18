document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById("savedRecipesPopup");
    const closeBtn = document.getElementById("closeSavedRecipesPopup");

    popup.style.display = "flex";

    closeBtn.addEventListener("click", () => {
        popup.style.display = "none";
    });
});