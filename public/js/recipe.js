// Open/close filter
function toggleDropdown() {
    document.getElementById('filterBtn').classList.toggle('open');
    document.getElementById('dropdown').classList.toggle('open');
}

// Show price field when toggled
function togglePriceField() {
    const on = document.getElementById('priceToggle').checked;
    document.getElementById('priceRow').style.display = on ? 'flex' : 'none';
    applyFilters();
}

// Main filter function
function applyFilters() {

}


// Displaying card functionality learnt in COMP 2537
let offset = 0;
const limit = 10;
let isLoading = false;

async function loadRecipes() {
  if (isLoading) return;
  isLoading = true;

  const response = await fetch(`/api/recipes?offset=${offset}`);
  const recipes = await response.json();

  for (let recipe of recipes) {
    const price = recipe.pricePerServing
      ? ((recipe.pricePerServing / 100) * 1.3704).toFixed(2)
      : "0.00";

    // AI assisted grid
    const card = `
      <div class="card" data-name="${recipe.title.toLowerCase()}" data-price="${price}">
        <img src="${recipe.image}" alt="${recipe.title}" style="width:100%; border-radius:8px;">
        ${recipe.title}
        <div class="card-meta">
          <span class="price-label">$${price}</span>
        </div>
      </div>
    `;

    document.getElementById("results").innerHTML += card;
  }

  offset += limit;
  isLoading = false;
}

// Load first 10 on page load
loadRecipes();

// Infinite scroll -- uses your .main div since that's what scrolls, not the window
document.querySelector(".main").addEventListener("scroll", function () {
  const scrollTop = this.scrollTop;
  const scrollHeight = this.scrollHeight;
  const clientHeight = this.clientHeight;
  const scrollBuffer = 5;

  if (scrollTop + clientHeight + scrollBuffer >= scrollHeight) {
    loadRecipes();
  }
});

// popup challenge
document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById('firstTimePopupRecipe');
    const closeBtn = document.getElementById('closePopup');

    const hasVisited = localStorage.getItem('hasVisited');

    if (!hasVisited){
        popup.style.display = 'flex';
    }

    closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        localStorage.setItem('hasVisited', 'true');
    });
});
