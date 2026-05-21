async function loadShoppingList() {
  const container = document.getElementById("shopping-list-container");
  const response = await fetch("/api/shoppingList");
  const items = await response.json();

  if (items.length === 0) {
    container.innerHTML = "<p>Your shopping list is empty.</p>";
    return;
  }

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

async function clearCompleted() {
  document
    .querySelectorAll('.ingredient-item input[type="checkbox"]:checked')
    .forEach((cb) => cb.closest(".ingredient-item").remove());

  // For each recipe group, sync its remaining ingredients back to MongoDB
  const groups = document.querySelectorAll(".recipe-group");
  const savePromises = [];

  groups.forEach((group) => {
    const id = group.dataset.id;
    const remaining = [...group.querySelectorAll(".ingredient-item label")].map(
      (label) => label.textContent,
    );

    if (remaining.length === 0) {
      // No ingredients left — delete this recipe group from MongoDB
      group.remove();
      savePromises.push(fetch(`/api/shoppingList/${id}`, { method: "DELETE" }));
    } else {
      // Some ingredients remain — update MongoDB with only the survivors
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

  await Promise.all(savePromises);

  // Now check if the whole list is empty
  if (document.querySelectorAll(".recipe-group").length === 0) {
    document.getElementById("shopping-list-container").innerHTML =
      "<p>Your shopping list is empty.</p>";
  }
}

loadShoppingList();

function findNearbyStores() {
  // Collect all visible ingredient labels from the shopping list
  const labels = Array.from(
    document.querySelectorAll(".ingredient-item label")
  ).map((el) => el.textContent.trim()).filter(Boolean);

  if (labels.length === 0) {
    alert("Your shopping list is empty — add some recipes first!");
    return;
  }

  // Stash ingredients for the map page to pick up
  sessionStorage.setItem("aiShoppingIngredients", JSON.stringify(labels));

  // Head to map with flag
  window.location.href = "/map?aiShopping=1";
}