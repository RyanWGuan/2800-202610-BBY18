//Delete saved recipe from database
async function deleteSavedRecipe(recipeId) {

    const response = await fetch(`/deleteSavedRecipe/${recipeId}`, {
        method: "DELETE"
    });

    const result = await response.json();

    alert(result.message);

    //Reload page after deleting recipe
    location.reload();
}