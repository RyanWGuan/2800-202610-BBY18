const MEALDB_LOOKUP = "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";

const FIRST_MEAL_ID = 52772;
const LOAD_SIZE = 20;

// get meal from API
async function fetchMealById(id) {
  const response = await fetch(`${MEALDB_LOOKUP}${id}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.meals ? data.meals[0] : null;
}

// loadMeals based on Lab03
var offset = 0;
var loading = false;
var current = FIRST_MEAL_ID;

// load 10 meals
async function loadMeals() {
  loading = true;

  for (i = current; i < current + 10; i++) {
    let meal = await fetchMealById(i);
    if (!meal) continue;

    results.innerHTML += `
                    <a href="/recipeDetails?id=${meal.idMeal}" class="card-link">
                        <div class="card">
                            <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="card-img"/>
                            <div class="card-meta">
                                <h3 class="card-title">${meal.strMeal}</h3>
                                <span class="price-label">$10.49</span>
                            </div>
                        </div>
                    </a>`;

    current++;
  }
  loading = false;
}
loadMeals();

// Open/close filter
function toggleDropdown() {
  document.getElementById("filterBtn").classList.toggle("open");
  document.getElementById("dropdown").classList.toggle("open");
}

// Show price field when toggled
function togglePriceField() {
  const on = document.getElementById("priceToggle").checked;
  document.getElementById("priceRow").style.display = on ? "flex" : "none";
  applyFilters();
}

// Main filter function
function applyFilters() {}

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
    const maxTime = document.getElementById('timeSlider')?.value || 60;
    const search = document.getElementById('searchInput')?.value || '';

    btn.disabled = true;
    btn.textContent = 'Thinking…';
    output.style.display = 'block';
    output.innerHTML = '<span style="color:#888">Generating suggestion…</span>';

    try {
        const response = await fetch('/api/recipe-suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ search })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Server error');

        if (data.found) {
            // Render a card linking to the real recipe page
            output.innerHTML = `
                <a href="/recipeDetails?id=${data.id}" class="card-link">
                    <div class="card">
                        <img src="${data.image}" alt="${data.name}" class="card-img"/>
                        <div class="card-meta">
                            <h3 class="card-title">${data.name}</h3>
                            <span class="price-label">${data.area || ''} · ${data.category || ''}</span>
                        </div>
                        <div class="ai-card-badge-wrap">
                            <span class="ai-card-badge">✦ AI Suggestion</span>
                        </div>
                    </div>
                </a>`;
        } else {
            // Fallback if MealDB didn't find a match
            output.innerHTML = `
                <div class="card">
                    <div class="card-meta" style="padding: 10px 14px;">
                        <h3 class="card-title">${data.name}</h3>
                        <span class="price-label">Not found in database</span>
                    </div>
                    <div class="ai-card-badge-wrap">
                        <span class="ai-card-badge">✦ AI Suggestion</span>
                    </div>
                </div>`;
        }
    } catch (err) {
        output.innerHTML = `<span style="color:red">Failed to get suggestion: ${err.message}</span>`;
        console.error(err);
    }

    btn.disabled = false;
    btn.textContent = '✦ Suggest a recipe';
}

// popup challenge
document.addEventListener("DOMContentLoaded", () => {
  const popup = document.getElementById("firstTimePopupRecipe");
  const closeBtn = document.getElementById("closePopup");

  const hasVisited = localStorage.getItem("hasVisited");

  if (!hasVisited) {
    popup.style.display = "flex";
  }

  closeBtn.addEventListener("click", () => {
    popup.style.display = "none";
    localStorage.setItem("hasVisited", "true");
  });
});
