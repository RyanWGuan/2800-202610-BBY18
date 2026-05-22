// Fetches the user's shopping list from MongoDB and renders it on the page
async function loadShoppingList() {
  const container = document.getElementById("shopping-list-container");
  const response = await fetch("/api/shoppingList");
  const items = await response.json();

  // Show empty state if no items found
  if (items.length === 0) {
    container.innerHTML = "<p>Your shopping list is empty.</p>";
    return;
  }

  // Render each recipe group with its ingredients as checkboxes
  container.innerHTML = items
    .map(
      (group, groupIndex) => `
        <div class="recipe-group" data-id="${group._id}">
          <div class="recipe-label">For: ${group.recipeName}</div>
          ${group.ingredients
            .map(
              (ing, i) => `
                <div class="ingredient-item">
                  <input type="checkbox" id="g${groupIndex}-i${i}" />
                  <label for="g${groupIndex}-i${i}">${ing}</label>
                </div>
              `,
            )
            .join("")}
        </div>
      `,
    )
    .join("");
}

// Removes checked ingredients from the DOM and syncs changes back to MongoDB
async function clearCompleted() {
  // Remove all checked ingredient rows from the DOM
  document
    .querySelectorAll('.ingredient-item input[type="checkbox"]:checked')
    .forEach((cb) => cb.closest(".ingredient-item").remove());

  // Loop through each recipe group and sync remaining ingredients to MongoDB
  const groups = document.querySelectorAll(".recipe-group");
  const savePromises = [];

  groups.forEach((group) => {
    const id = group.dataset.id;

    // Collect remaining unchecked ingredients
    const remaining = [...group.querySelectorAll(".ingredient-item label")].map(
      (label) => label.textContent,
    );

    if (remaining.length === 0) {
      // No ingredients left -- delete this recipe group from MongoDB and DOM
      group.remove();
      savePromises.push(fetch(`/api/shoppingList/${id}`, { method: "DELETE" }));
    } else {
      // Some ingredients remain -- update MongoDB with only the survivors
      const recipeName = group
        .querySelector(".recipe-label")
        .textContent.replace("For: ", "");

      savePromises.push(
        fetch(`/api/shoppingList/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ingredients: remaining, recipeName }),
        }),
      );
    }
  });

  // Wait for all MongoDB sync operations to complete
  await Promise.all(savePromises);

  // Show empty state if all recipe groups have been removed
  if (document.querySelectorAll(".recipe-group").length === 0) {
    document.getElementById("shopping-list-container").innerHTML =
      "<p>Your shopping list is empty.</p>";
  }
}

// Load shopping list on page load
loadShoppingList();

// Collects all visible ingredients and redirects to the map page for nearby store search
function findNearbyStores() {
  // Collect all visible ingredient labels from the shopping list
  const labels = Array.from(document.querySelectorAll(".ingredient-item label"))
    .map((el) => el.textContent.trim())
    .filter(Boolean);

  // Warn user if shopping list is empty
  if (labels.length === 0) {
    alert("Your shopping list is empty — add some recipes first!");
    return;
  }

  // Save ingredients to session storage for the map page to pick up
  sessionStorage.setItem("aiShoppingIngredients", JSON.stringify(labels));

  // Redirect to map page with AI shopping flag
  window.location.href = "/map?aiShopping=1";
}
