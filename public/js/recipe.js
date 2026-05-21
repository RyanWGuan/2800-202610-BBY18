const MEALDB_LOOKUP = "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";
const FIRST_MEAL_ID = 52772;

// ─── Session cache keys ───────────────────────────────────────────────────────
const CACHE_KEY_MEALS  = "cachedMeals";
const CACHE_KEY_CURSOR = "mealCursor";

// ─── In-memory state ──────────────────────────────────────────────────────────
let allMeals = [];
let current  = FIRST_MEAL_ID;
let loading  = false;

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

// ─── Batch BC price fetch ─────────────────────────────────────────────────────
// Takes an array of meals that don't have a price yet, sends them all in one
// Groq call, then updates each card's price label and stores the price on the
// meal object so the filter can use it.
async function fetchBatchBCPrices(meals) {
  const uncached = meals.filter((m) => m._bcPrice == null);
  if (!uncached.length) return;

  try {
    const res  = await fetch("/api/bc-price-estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meals: uncached.map((m) => ({ id: String(m.idMeal), name: m.strMeal })),
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(`Server ${res.status}: ${data.error || "Unknown error"}`);

    const prices = data.prices || {};
    console.log("BC prices received:", prices);

    for (const meal of uncached) {
      const price = Number(prices[String(meal.idMeal)]);
      if (!isNaN(price)) {
        meal._bcPrice = price;
        const priceEl = document.getElementById(`meal-${meal.idMeal}-price`);
        if (priceEl) priceEl.textContent = `🍁 ~$${price.toFixed(2)}`;
      } else {
        const priceEl = document.getElementById(`meal-${meal.idMeal}-price`);
        if (priceEl) priceEl.textContent = "Price unavailable";
      }
    }

    // Persist updated prices to session cache
    saveMealsToSession();
  } catch (err) {
    // Log the full error so it's visible in devtools, not just "Price unavailable"
    console.error("Batch BC price fetch failed:", err.message, err);
    for (const meal of uncached) {
      const priceEl = document.getElementById(`meal-${meal.idMeal}-price`);
      if (priceEl) priceEl.textContent = "Price unavailable";
    }
  }
}

// ─── Card builder ─────────────────────────────────────────────────────────────
function buildCard(meal) {
  const priceText = meal._bcPrice != null
    ? `🍁 ~$${meal._bcPrice.toFixed(2)}`
    : "Loading BC price…";

  return `
    <a href="/recipeDetails?id=${meal.idMeal}" class="card-link">
      <div class="card">
        <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="card-img"/>
        <div class="card-meta">
          <h3 class="card-title">${meal.strMeal}</h3>
          <span class="price-label" id="meal-${meal.idMeal}-price">${priceText}</span>
        </div>
      </div>
    </a>`;
}

// ─── Render a list of meals into #results ─────────────────────────────────────
// After rendering, fires one batch Groq call for any cards missing prices.
function renderMeals(meals) {
  const results  = document.getElementById("results");
  const aiOutput = document.getElementById("aiOutput");

  results.innerHTML = "";
  if (aiOutput) results.appendChild(aiOutput);

  for (const meal of meals) {
    results.insertAdjacentHTML("beforeend", buildCard(meal));
  }

  // One Groq call for all visible meals that still need a price
  fetchBatchBCPrices(meals);
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

  const searchTerm = document.getElementById("searchInput")?.value.trim() || "";
  if (!searchTerm) {
    const results = document.getElementById("results");
    for (const meal of newMeals) {
      results.insertAdjacentHTML("beforeend", buildCard(meal));
    }
    // One batch call for the new batch of cards
    fetchBatchBCPrices(newMeals);
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

    // Only filter by price if we actually have one — meals still loading are kept visible
    if (priceEnabled && meal._bcPrice != null && meal._bcPrice > maxPrice) return false;

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