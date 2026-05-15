const MEALDB_LOOKUP = "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";

const FIRST_MEAL_ID = 52772;
const LOAD_SIZE = 20;

// get meal from API
async function fetchMealById(id) {
    const response = await fetch(`${MEALDB_LOOKUP}${id}`);
    
    if (!response.ok)
    {
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
    };
    loading = false;
}
loadMeals();

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
 

