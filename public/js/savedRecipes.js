document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById("savedRecipesPopup");
    const closeBtn = document.getElementById("closeSavedRecipesPopup");

    const hasVisitedSavedRecipes = localStorage.getItem("hasVisitedSavedRecipes");

    if (!hasVisitedSavedRecipes) {
        popup.style.display = "flex";
    }

    closeBtn.addEventListener("click", () => {
        popup.style.display = "none";
        localStorage.setItem("hasVisitedSavedRecipes", "true");
    });
});

async function deleteSavedRecipe(event, recipeId) {
    event.preventDefault();
    event.stopPropagation();

    await fetch(`/deleteSavedRecipe/${recipeId}`, {
        method: "DELETE"
    });

    location.reload();
}