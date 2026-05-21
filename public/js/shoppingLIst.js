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
    <div class="recipe-group">
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

function clearCompleted() {
  document
    .querySelectorAll('.ingredient-item input[type="checkbox"]:checked')
    .forEach(function (cb) {
      cb.closest(".ingredient-item").remove();
    });

  // Check if any ingredients remain
  const remaining = document.querySelectorAll(".ingredient-item");
  if (remaining.length === 0) {
    document.getElementById("shopping-list-container").innerHTML =
      "<p>Your shopping list is empty.</p>";
  }
}

loadShoppingList();
