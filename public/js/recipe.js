// const MEALDB_LOOKUP = "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";

// const FIRST_MEAL_ID = 52772;
// const LOAD_SIZE = 20;

// // get meal from API
// async function fetchMealById(id) {
//   const response = await fetch(`${MEALDB_LOOKUP}${id}`);

//   if (!response.ok) {
//     throw new Error(`API error: ${response.status}`);
//   }

//   const data = await response.json();
//   return data.meals ? data.meals[0] : null;
// }

// // loadMeals based on Lab03
// var offset = 0;
// var loading = false;
// var current = FIRST_MEAL_ID;

// // load 10 meals
// async function loadMeals() {
//   loading = true;

//   for (i = current; i < current + 10; i++) {
//     let meal = await fetchMealById(i);
//     if (!meal) continue;

//     results.innerHTML += `
//                     <a href="/recipeDetails?id=${meal.idMeal}" class="card-link">
//                         <div class="card">
//                             <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="card-img"/>
//                             <div class="card-meta">
//                                 <h3 class="card-title">${meal.strMeal}</h3>
//                                 <span class="price-label">$10.49</span>
//                             </div>
//                         </div>
//                     </a>`;

//     current++;
//   }
//   loading = false;
// }
// loadMeals();

// // Open/close filter
// function toggleDropdown() {
//   document.getElementById("filterBtn").classList.toggle("open");
//   document.getElementById("dropdown").classList.toggle("open");
// }

// // Show price field when toggled
// function togglePriceField() {
//   const on = document.getElementById("priceToggle").checked;
//   document.getElementById("priceRow").style.display = on ? "flex" : "none";
//   applyFilters();
// }

// // Main filter function
// function applyFilters() {}

// // Displaying card functionality learnt in COMP 2537
// // let offset = 0;
// // const limit = 10;
// // let isLoading = false;

// // async function loadRecipes() {
// //   if (isLoading) return;
// //   isLoading = true;

// //   const response = await fetch(`/api/recipes?offset=${offset}`);
// //   const recipes = await response.json();

// //   for (let recipe of recipes) {
// //     const price = recipe.pricePerServing
// //       ? ((recipe.pricePerServing / 100) * 1.3704).toFixed(2)
// //       : "0.00";

// //     // AI assisted grid
// //     const card = `
// //       <div class="card" data-name="${recipe.title.toLowerCase()}" data-price="${price}">
// //         <img src="${recipe.image}" alt="${recipe.title}" style="width:100%; border-radius:8px;">
// //         ${recipe.title}
// //         <div class="card-meta">
// //           <span class="price-label">$${price}</span>
// //         </div>
// //       </div>
// //     `;

// //     document.getElementById("results").innerHTML += card;
// //   }

// //   offset += limit;
// //   isLoading = false;
// // }

// // Load first 10 on page load
// // loadRecipes();

// // Infinite scroll -- uses your .main div since that's what scrolls, not the window
// document.querySelector(".main").addEventListener("scroll", function () {
//   const scrollTop = this.scrollTop;
//   const scrollHeight = this.scrollHeight;
//   const clientHeight = this.clientHeight;
//   const scrollBuffer = 5;

//   if (scrollTop + clientHeight + scrollBuffer >= scrollHeight) {
//     loadRecipes();
//   }
// });
// const maxTime = document.getElementById("timeSlider")?.value || 60;
// const search = document.getElementById("searchInput")?.value || "";

// btn.disabled = true;
// btn.textContent = "Thinking…";
// output.style.display = "block";
// output.innerHTML = '<span style="color:#888">Generating suggestion…</span>';

// try {
//   const response = await fetch("/api/recipe-suggest", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ search }),
//   });

//   const data = await response.json();

//   if (!response.ok) throw new Error(data.error || "Server error");

//   if (data.found) {
//     // Render a card linking to the real recipe page
//     output.innerHTML = `
//                 <a href="/recipeDetails?id=${data.id}" class="card-link">
//                     <div class="card">
//                         <img src="${data.image}" alt="${data.name}" class="card-img"/>
//                         <div class="card-meta">
//                             <h3 class="card-title">${data.name}</h3>
//                             <span class="price-label">${data.area || ""} · ${data.category || ""}</span>
//                         </div>
//                         <div class="ai-card-badge-wrap">
//                             <span class="ai-card-badge">✦ AI Suggestion</span>
//                         </div>
//                     </div>
//                 </a>`;
//   } else {
//     // Fallback if MealDB didn't find a match
//     output.innerHTML = `
//                 <div class="card">
//                     <div class="card-meta" style="padding: 10px 14px;">
//                         <h3 class="card-title">${data.name}</h3>
//                         <span class="price-label">Not found in database</span>
//                     </div>
//                     <div class="ai-card-badge-wrap">
//                         <span class="ai-card-badge">✦ AI Suggestion</span>
//                     </div>
//                 </div>`;
//   }
// } catch (err) {
//   output.innerHTML = `<span style="color:red">Failed to get suggestion: ${err.message}</span>`;
//   console.error(err);
// }

// btn.disabled = false;
// btn.textContent = "✦ Suggest a recipe";

// Load first 10 on page load
// loadRecipes();

// Infinite scroll -- uses your .main div since that's what scrolls, not the window
// document.querySelector(".main").addEventListener("scroll", function () {
//   const scrollTop = this.scrollTop;
//   const scrollHeight = this.scrollHeight;
//   const clientHeight = this.clientHeight;
//   const scrollBuffer = 5;

//   if (scrollTop + clientHeight + scrollBuffer >= scrollHeight) {
//     loadRecipes();
//   }
// });

// // popup challenge
// document.addEventListener("DOMContentLoaded", () => {
//   const popup = document.getElementById("firstTimePopupRecipe");
//   const closeBtn = document.getElementById("closePopup");

//   const hasVisited = localStorage.getItem("hasVisited");

//   if (!hasVisited) {
//     popup.style.display = "flex";
//   }

//   closeBtn.addEventListener("click", () => {
//     popup.style.display = "none";
//     localStorage.setItem("hasVisited", "true");
//   });
// });
// const MEALDB_LOOKUP = "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";
// const FIRST_MEAL_ID = 52772;

// // Get meal from API
// async function fetchMealById(id) {
//   const response = await fetch(`${MEALDB_LOOKUP}${id}`);
//   if (!response.ok) throw new Error(`API error: ${response.status}`);
//   const data = await response.json();
//   return data.meals ? data.meals[0] : null;
// }

// var loading = false;
// var current = FIRST_MEAL_ID;

// // Load 10 meals at a time
// async function loadMeals() {
//   if (loading) return;
//   loading = true;

//   const results = document.getElementById("results");

//   for (let i = current; i < current + 10; i++) {
//     let meal = await fetchMealById(i);
//     if (!meal) continue;

//     results.innerHTML += `
//       <a href="/recipeDetails?id=${meal.idMeal}" class="card-link">
//         <div class="card">
//           <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="card-img"/>
//           <div class="card-meta">
//             <h3 class="card-title">${meal.strMeal}</h3>
//             <span class="price-label">$10.49</span>
//           </div>
//         </div>
//       </a>`;

//     current++;
//   }
//   loading = false;
// }

// // AI suggest button handler
// async function suggestRecipe() {
//   const btn = document.getElementById("aiSuggestBtn");
//   const output = document.getElementById("aiOutput");
//   const search = document.getElementById("searchInput")?.value || "";

//   btn.disabled = true;
//   btn.textContent = "Thinking…";
//   output.style.display = "block";
//   output.innerHTML = '<span style="color:#888">Generating suggestion…</span>';

//   try {
//     const response = await fetch("/api/recipe-suggest", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ search }),
//     });

//     const data = await response.json();
//     if (!response.ok) throw new Error(data.error || "Server error");

//     if (data.found) {
//       output.innerHTML = `
//         <a href="/recipeDetails?id=${data.id}" class="card-link">
//           <div class="card">
//             <img src="${data.image}" alt="${data.name}" class="card-img"/>
//             <div class="card-meta">
//               <h3 class="card-title">${data.name}</h3>
//               <span class="price-label">${data.area || ""} · ${data.category || ""}</span>
//             </div>
//             <div class="ai-card-badge-wrap">
//               <span class="ai-card-badge">✦ AI Suggestion</span>
//             </div>
//           </div>
//         </a>`;
//     } else {
//       output.innerHTML = `
//         <div class="card">
//           <div class="card-meta" style="padding: 10px 14px;">
//             <h3 class="card-title">${data.name}</h3>
//             <span class="price-label">Not found in database</span>
//           </div>
//           <div class="ai-card-badge-wrap">
//             <span class="ai-card-badge">✦ AI Suggestion</span>
//           </div>
//         </div>`;
//     }
//   } catch (err) {
//     output.innerHTML = `<span style="color:red">Failed to get suggestion: ${err.message}</span>`;
//     console.error(err);
//   }

//   btn.disabled = false;
//   btn.textContent = "✦ Suggest a recipe";
// }

// // Open/close filter
// function toggleDropdown() {
//   document.getElementById("filterBtn").classList.toggle("open");
//   document.getElementById("dropdown").classList.toggle("open");
// }

// // Show price field when toggled
// function togglePriceField() {
//   const on = document.getElementById("priceToggle").checked;
//   document.getElementById("priceRow").style.display = on ? "flex" : "none";
//   applyFilters();
// }

// // Main filter function
// function applyFilters() {}

// // Init on DOM ready
// document.addEventListener("DOMContentLoaded", () => {
//   // Load first batch of meals
//   loadMeals();

//   // Infinite scroll
//   document.querySelector(".main").addEventListener("scroll", function () {
//     const scrollTop = this.scrollTop;
//     const scrollHeight = this.scrollHeight;
//     const clientHeight = this.clientHeight;
//     if (scrollTop + clientHeight + 5 >= scrollHeight) {
//       loadMeals();
//     }
//   });

//   // AI suggest button
//   const aiBtn = document.getElementById("aiSuggestBtn");
//   if (aiBtn) aiBtn.addEventListener("click", suggestRecipe);

//   // Popup
//   const popup = document.getElementById("firstTimePopupRecipe");
//   const closeBtn = document.getElementById("closePopup");
//   if (popup && closeBtn) {
//     if (!localStorage.getItem("hasVisited")) {
//       popup.style.display = "flex";
//     }
//     closeBtn.addEventListener("click", () => {
//       popup.style.display = "none";
//       localStorage.setItem("hasVisited", "true");
//     });
//   }
// });

const MEALDB_LOOKUP = "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";
const FIRST_MEAL_ID = 52772;
 
// Flip to false when deploying for real Spoonacular prices.
const DEV_MOCK_PRICES = true;
 
// ─── Session cache keys ───────────────────────────────────────────────────────
const CACHE_KEY_MEALS  = "cachedMeals";
const CACHE_KEY_CURSOR = "mealCursor";
 
// ─── In-memory state ──────────────────────────────────────────────────────────
let allMeals = [];
let current  = FIRST_MEAL_ID;
let loading  = false;
 
// ─── Price throttle queue ─────────────────────────────────────────────────────
const priceQueue     = [];
let   queueRunning   = false;
const PRICE_DELAY_MS = 500;
 
async function enqueuePriceFetch(mealName, cardId) {
  priceQueue.push({ mealName, cardId });
  if (!queueRunning) runPriceQueue();
}
 
async function runPriceQueue() {
  queueRunning = true;
  while (priceQueue.length > 0) {
    const { mealName, cardId } = priceQueue.shift();
    await fetchPrice(mealName, cardId);
    if (priceQueue.length > 0) {
      await new Promise((r) => setTimeout(r, PRICE_DELAY_MS));
    }
  }
  queueRunning = false;
}
 
// ─── API helpers ──────────────────────────────────────────────────────────────
async function fetchMealById(id) {
  const response = await fetch(`${MEALDB_LOOKUP}${id}`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.meals ? data.meals[0] : null;
}
 
async function fetchPrice(mealName, cardId) {
  const priceEl = document.getElementById(`${cardId}-price`);
 
  if (DEV_MOCK_PRICES) {
    if (priceEl) priceEl.textContent = `~$${(Math.random() * 15 + 3).toFixed(2)}`;
    return;
  }
 
  const cacheKey = `price:${mealName}`;
  const cached   = localStorage.getItem(cacheKey);
  if (cached) {
    if (priceEl) priceEl.textContent = cached;
    return;
  }
 
  try {
    const res     = await fetch(`/api/recipe-price?name=${encodeURIComponent(mealName)}`);
    const data    = await res.json();
    const display = data.price ? `~$${data.price}` : "Price unavailable";
    localStorage.setItem(cacheKey, display);
    if (priceEl) priceEl.textContent = display;
  } catch {
    if (priceEl) priceEl.textContent = "Price unavailable";
  }
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
  } catch { /* corrupted cache — start fresh */ }
  return false;
}
 
// ─── Card builder ─────────────────────────────────────────────────────────────
function buildCard(meal) {
  const cardId = `meal-${meal.idMeal}`;
  return `
    <a href="/recipeDetails?id=${meal.idMeal}" class="card-link">
      <div class="card">
        <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="card-img"/>
        <div class="card-meta">
          <h3 class="card-title">${meal.strMeal}</h3>
          <span class="price-label" id="${cardId}-price">Loading price...</span>
        </div>
      </div>
    </a>`;
}
 
// ─── Render a list of meals into #results ─────────────────────────────────────
function renderMeals(meals) {
  const results  = document.getElementById("results");
  const aiOutput = document.getElementById("aiOutput");
 
  // Clear everything except the AI output div
  results.innerHTML = "";
  if (aiOutput) results.appendChild(aiOutput);
 
  for (const meal of meals) {
    results.insertAdjacentHTML("beforeend", buildCard(meal));
    enqueuePriceFetch(meal.strMeal, `meal-${meal.idMeal}`);
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
 
  // If no active search, append new cards directly (avoids full re-render)
  const searchTerm = document.getElementById("searchInput")?.value.trim() || "";
  if (!searchTerm) {
    const results = document.getElementById("results");
    for (const meal of newMeals) {
      results.insertAdjacentHTML("beforeend", buildCard(meal));
      enqueuePriceFetch(meal.strMeal, `meal-${meal.idMeal}`);
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
// With a search term: hits MealDB's full-database search endpoint.
// Without: filters the local cache client-side (zero network calls).
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
 
      // Merge any new results into the local cache
      const existingIds = new Set(allMeals.map((m) => m.idMeal));
      const newOnes     = pool.filter((m) => !existingIds.has(m.idMeal));
      if (newOnes.length) {
        allMeals = [...allMeals, ...newOnes];
        saveMealsToSession();
      }
    } catch {
      // Network error — fall back to local cache
      pool = allMeals.filter((m) =>
        m.strMeal.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  } else {
    pool = allMeals;
  }
 
  // Apply wishlist & price filters on top of search results
  const filtered = pool.filter((meal) => {
    if (wishlistOnly && !savedIds.has(String(meal.idMeal))) return false;
 
    if (priceEnabled && !DEV_MOCK_PRICES) {
      const cached = localStorage.getItem(`price:${meal.strMeal}`);
      if (cached) {
        const num = parseFloat(cached.replace(/[^0-9.]/g, ""));
        if (!isNaN(num) && num > maxPrice) return false;
      }
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
    // Fetch the user's saved recipes to inform the suggestion
    let savedRecipeNames = [];
    try {
      const savedRes  = await fetch("/savedRecipes", { headers: { Accept: "application/json" } });
      // savedRecipes returns an EJS page, so use the API collection directly
      const apiRes    = await fetch("/api/savedRecipes");
      const apiData   = await apiRes.json();
      savedRecipeNames = apiData.map((r) => r.name).filter(Boolean);
    } catch { /* not logged in or endpoint missing — silently skip */ }

    const response = await fetch("/api/recipe-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search, savedRecipeNames }),
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
    // Returning visit this session — render instantly from cache
    renderMeals(allMeals);
  } else {
    // First visit — fetch from MealDB
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
