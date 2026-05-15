const MEALDB_LOOKUP = "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";
const FIRST_MEAL_ID = 52772;

async function fetchMealById(id) {
    const response = await fetch(`${MEALDB_LOOKUP}${id}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.meals ? data.meals[0] : null;
}

var current = FIRST_MEAL_ID;
var loading = false;
var allMeals = [];

async function loadMeals() {
    loading = true;
    const results = document.getElementById('results');

    for (let i = current; i < current + 10; i++) {
        let meal = await fetchMealById(i);
        if (!meal) continue;

        // Demo price and time derived from meal id — replace with real data if available
        const price = (5 + (meal.idMeal % 30)).toFixed(2);
        const time = 10 + (meal.idMeal % 50);

        allMeals.push({ meal, price: parseFloat(price), time });

        results.innerHTML += `
            <a href="/recipeDetails?id=${meal.idMeal}" class="card-link"
               data-title="${meal.strMeal.toLowerCase()}"
               data-price="${price}"
               data-time="${time}">
                <div class="card">
                    <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="card-img"/>
                    <div class="card-meta">
                        <h3 class="card-title">${meal.strMeal}</h3>
                        <span class="price-label">$${price} · ${time} min</span>
                    </div>
                </div>
            </a>`;

        current++;
    }
    loading = false;
    applyFilters();
}
loadMeals();

function toggleDropdown() {
    document.getElementById('filterBtn').classList.toggle('open');
    document.getElementById('dropdown').classList.toggle('open');
}

function togglePriceField() {
    const on = document.getElementById('priceToggle').checked;
    document.getElementById('priceRow').style.display = on ? 'flex' : 'none';
    applyFilters();
}

function applyFilters() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const priceEnabled = document.getElementById('priceToggle')?.checked;
    const maxPrice = parseFloat(document.getElementById('priceInput')?.value) || Infinity;
    const maxTime = parseInt(document.getElementById('timeSlider')?.value) || 999;

    document.querySelectorAll('#results .card-link').forEach(link => {
        const title = link.dataset.title || '';
        const price = parseFloat(link.dataset.price) || 0;
        const time = parseInt(link.dataset.time) || 0;

        const matchSearch = !search || title.includes(search);
        const matchPrice = !priceEnabled || price <= maxPrice;
        const matchTime = time <= maxTime;

        const visible = matchSearch && matchPrice && matchTime;
        link.querySelector('.card').classList.toggle('hidden', !visible);
        link.style.display = visible ? '' : 'none';
    });
}

function updateSliderDisplay(sliderId, displayId, suffix) {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    if (slider && display) {
        display.textContent = slider.value + suffix;
        slider.addEventListener('input', () => {
            display.textContent = slider.value + suffix;
            applyFilters();
        });
    }
}

async function getAISuggestion() {
    const btn = document.getElementById('aiSuggestBtn');
    const output = document.getElementById('aiOutput');

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
                    <div class="ai-card">
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
                <div class="ai-card">
                    <div class="ai-card-thumb">🍽️</div>
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

document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById('firstTimePopupRecipe');
    const closeBtn = document.getElementById('closePopup');
    if (!localStorage.getItem('hasVisited')) popup.style.display = 'flex';
    closeBtn?.addEventListener('click', () => {
        popup.style.display = 'none';
        localStorage.setItem('hasVisited', 'true');
    });

    updateSliderDisplay('timeSlider', 'timeVal', ' min');

    document.getElementById('aiSuggestBtn')?.addEventListener('click', getAISuggestion);
});