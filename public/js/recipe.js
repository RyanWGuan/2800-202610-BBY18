const MEALDB_LOOKUP = "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";
const FIRST_MEAL_ID = 52772;

// ─── Session cache keys ───────────────────────────────────────────────────────
const CACHE_KEY_MEALS  = "cachedMeals";
const CACHE_KEY_CURSOR = "mealCursor";

// ─── In-memory state ──────────────────────────────────────────────────────────
let allMeals = [];
let current  = FIRST_MEAL_ID;
let loading  = false;

// ─── BC price throttle queue ──────────────────────────────────────────────────
// One Groq call per card, throttled so we don't hammer the API.
// Each entry: { mealId, mealName, cardId }
const bcQueue      = [];
let   bcRunning    = false;
const BC_DELAY_MS  = 400;

function enqueueBCEstimate(mealId, mealName, cardId) {
  bcQueue.push({ mealId, mealName, cardId });
  if (!bcRunning) runBCQueue();
}

async function runBCQueue() {
  bcRunning = true;
  while (bcQueue.length > 0) {
    const { mealId, mealName, cardId } = bcQueue.shift();
    await fetchAndDisplayBCPrice(mealId, mealName, cardId);
    if (bcQueue.length > 0) {
      await new Promise((r) => setTimeout(r, BC_DELAY_MS));
    }
  }
  bcRunning = false;
}

// ─── BC price fetch (automatic, per card) ────────────────────────────────────
// Pulls ingredients from MealDB then asks Groq for a BC cost estimate.
// Result is cached in sessionStorage and stored on the meal object in allMeals
// so the price filter can use it without re-fetching.
async function fetchAndDisplayBCPrice(mealId, mealName, cardId) {
  const priceEl = document.getElementById(`${cardId}-price`);

  // Check sessionStorage cache first
  const cacheKey = `bc-price:${mealId}`;
  const cached   = sessionStorage.getItem(cacheKey);
  if (cached) {
    const { price } = JSON.parse(cached);
    if (priceEl) priceEl.textContent = `🍁 ~$${price.toFixed(2)}`;
    storePriceOnMeal(mealId, price);
    return;
  }

  try {
    // Step 1: get ingredients from MealDB
    const mealRes  = await fetch(`/api/meal/${mealId}`);
    const mealData = await mealRes.json();
    const meal     = mealData.meals?.[0];

    const ingredients = [];
    if (meal) {
      for (let i = 1; i <= 20; i++) {
        const ing     = meal[`strIngredient${i}`];
        const measure = meal[`strMeasure${i}`];
        if (ing && ing.trim()) {
          ingredients.push(`${measure ? measure.trim() + " " : ""}${ing.trim()}`);
        }
      }
    }

    // Step 2: ask Groq for a BC price breakdown
    const res  = await fetch("/api/bc-price-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealName, ingredients }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server error");

    const price = Number(data.estimatedCostPerServing);

    // Cache and store
    sessionStorage.setItem(cacheKey, JSON.stringify({ price }));
    storePriceOnMeal(mealId, price);

    if (priceEl) priceEl.textContent = `🍁 ~$${price.toFixed(2)}`;
  } catch {
    if (priceEl) priceEl.textContent = "Price unavailable";
  }
}

// Store the fetched BC price back onto the meal object in allMeals
// so applyFilters can compare it without any extra API calls.
function storePriceOnMeal(mealId, price) {
  const meal = allMeals.find((m) => String(m.idMeal) === String(mealId));
  if (meal) {
    meal._bcPrice = price;
    saveMealsToSession(); // persist the price for the session
  }
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function fetchMealById(id) {
  const response = await fetch(`${MEALDB_LOOKUP}${id}`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.meals ? data.meals[0] : null;
}

// ─── Session-storage helpers ──────────────────────────────────────────────────
function saveMealsToSession() {
  try {
    sessionStorage.setItem(CACHE_KEY_MEALS,  JSON.stringify(allMeals));
    sessionStorage.setItem(CACHE_KEY_CURSOR, String(current));
  } catch { /* storage full — silently ignore */ }
}

function loadMealsFromSession() {
  try {
    const raw    = sessionStorage.getItem(CACHE_KEY_MEALS);
    const cursor = sessionStorage.getItem(CACHE_KEY_CURSOR);
    if (raw && cursor) {
      allMeals = JSON.parse(raw);
      current  = parseInt(cursor, 10);
      return true;
    }
  } catch { /* corrupted — start fresh */ }
  return false;
}

// ─── Card builder ─────────────────────────────────────────────────────────────
function buildCard(meal) {
  const cardId      = `meal-${meal.idMeal}`;
  // If we already have a BC price cached on the meal object, show it immediately
  const priceText   = meal._bcPrice != null
    ? `🍁 ~$${meal._bcPrice.toFixed(2)}`
    : "Loading BC price…";

  return `
    <a href="/recipeDetails?id=${meal.idMeal}" class="card-link">
      <div class="card">
        <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="card-img"/>
        <div class="card-meta">
          <h3 class="card-title">${meal.strMeal}</h3>
          <span class="price-label" id="${cardId}-price">${priceText}</span>
        </div>
      </div>
    </a>`;
}

// ─── Render a list of meals into #results ─────────────────────────────────────
function renderMeals(meals) {
  const results  = document.getElementById("results");
  const aiOutput = document.getElementById("aiOutput");

  results.innerHTML = "";
  if (aiOutput) results.appendChild(aiOutput);

  for (const meal of meals) {
    results.insertAdjacentHTML("beforeend", buildCard(meal));
    // Only enqueue if we don't already have the price
    if (meal._bcPrice == null) {
      enqueueBCEstimate(meal.idMeal, meal.strMeal, `meal-${meal.idMeal}`);
    }
  }
}

// ─── Load next batch from MealDB ─────────────────────────────────────────────
async function loadMeals() {
  if (loading) return;
  loading = true;

  const newMeals = [];
  for (let i = current; i < current + 10; i++) {
    try {
      const meal = await fetchMealById(i);
      if (meal) newMeals.push(meal);
    } catch { /* skip bad IDs */ }
  }

  current  += 10;
  allMeals  = [...allMeals, ...newMeals];
  saveMealsToSession();

  // If no active search, append new cards directly
  const searchTerm = document.getElementById("searchInput")?.value.trim() || "";
  if (!searchTerm) {
    const results = document.getElementById("results");
    for (const meal of newMeals) {
      results.insertAdjacentHTML("beforeend", buildCard(meal));
      enqueueBCEstimate(meal.idMeal, meal.strMeal, `meal-${meal.idMeal}`);
    }
  }

  loading = false;
}

// ─── Wishlist helper ──────────────────────────────────────────────────────────
function getSavedRecipeIds() {
  try {
    const raw = localStorage.getItem("savedRecipeIds");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

// ─── Filter & search ──────────────────────────────────────────────────────────
async function applyFilters() {
  const searchTerm   = document.getElementById("searchInput")?.value.trim() || "";
  const wishlistOnly = document.getElementById("wishlistToggle")?.checked || false;
  const priceEnabled = document.getElementById("priceToggle")?.checked || false;
  const maxPrice     = priceEnabled
    ? parseFloat(document.getElementById("priceInput")?.value) || Infinity
    : Infinity;

  const savedIds = getSavedRecipeIds();
  let pool;

  if (searchTerm) {
    try {
      const res  = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      pool = data.meals || [];

      const existingIds = new Set(allMeals.map((m) => m.idMeal));
      const newOnes     = pool.filter((m) => !existingIds.has(m.idMeal));
      if (newOnes.length) {
        allMeals = [...allMeals, ...newOnes];
        saveMealsToSession();
      }
    } catch {
      pool = allMeals.filter((m) =>
        m.strMeal.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  } else {
    pool = allMeals;
  }

  const filtered = pool.filter((meal) => {
    if (wishlistOnly && !savedIds.has(String(meal.idMeal))) return false;

    // Price filter uses the BC Groq estimate stored on the meal object.
    // Meals without a price yet are kept visible (they're still loading).
    if (priceEnabled && meal._bcPrice != null && meal._bcPrice > maxPrice) {
      return false;
    }

    return true;
  });

  renderMeals(filtered);

  if (filtered.length === 0) {
    document.getElementById("results").insertAdjacentHTML(
      "beforeend",
      `<p style="color:#aaa;padding:20px;">No recipes match your search.</p>`
    );
  }
}

// ─── Filter UI helpers ────────────────────────────────────────────────────────
function toggleDropdown() {
  document.getElementById("filterBtn").classList.toggle("open");
  document.getElementById("dropdown").classList.toggle("open");
}

function togglePriceField() {
  const on = document.getElementById("priceToggle").checked;
  document.getElementById("priceRow").style.display = on ? "flex" : "none";
  applyFilters();
}

// ─── AI suggest ───────────────────────────────────────────────────────────────
async function suggestRecipe() {
  const btn    = document.getElementById("aiSuggestBtn");
  const output = document.getElementById("aiOutput");
  const search = document.getElementById("searchInput")?.value || "";

  btn.disabled    = true;
  btn.textContent = "Thinking…";
  output.style.display = "block";
  output.innerHTML = '<span style="color:#888">Generating suggestion…</span>';

  try {
    const response = await fetch("/api/recipe-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Server error");

    if (data.found) {
      output.innerHTML = `
        <a href="/recipeDetails?id=${data.id}" class="card-link">
          <div class="card">
            <img src="${data.image}" alt="${data.name}" class="card-img"/>
            <div class="card-meta">
              <h3 class="card-title">${data.name}</h3>
              <span class="price-label">${data.area || ""} · ${data.category || ""}</span>
            </div>
            <div class="ai-card-badge-wrap">
              <span class="ai-card-badge">✦ AI Suggestion</span>
            </div>
          </div>
        </a>`;
    } else {
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

  btn.disabled    = false;
  btn.textContent = "✦ Suggest a recipe";
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const hasCached = loadMealsFromSession();

  if (hasCached && allMeals.length > 0) {
    renderMeals(allMeals);
  } else {
    loadMeals();
  }

  // Infinite scroll
  document.querySelector(".main").addEventListener("scroll", function () {
    if (this.scrollTop + this.clientHeight + 5 >= this.scrollHeight) {
      loadMeals();
    }
  });

  // Search input (debounced 300ms)
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => applyFilters(), 300);
    });
  }

  // Time slider label update
  const timeSlider = document.getElementById("timeSlider");
  const timeVal    = document.getElementById("timeVal");
  if (timeSlider && timeVal) {
    timeSlider.addEventListener("input", () => {
      timeVal.textContent = `${timeSlider.value} min`;
      applyFilters();
    });
  }

  // AI suggest button
  const aiBtn = document.getElementById("aiSuggestBtn");
  if (aiBtn) aiBtn.addEventListener("click", suggestRecipe);

  // First-visit popup
  const popup    = document.getElementById("firstTimePopupRecipe");
  const closeBtn = document.getElementById("closePopup");
  if (popup && closeBtn) {
    if (!localStorage.getItem("hasVisited")) popup.style.display = "flex";
    closeBtn.addEventListener("click", () => {
      popup.style.display = "none";
      localStorage.setItem("hasVisited", "true");
    });
  }
});