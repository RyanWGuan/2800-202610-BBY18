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

// Set to true during development to avoid burning Spoonacular quota.
// Prices will show as random realistic values so you can test the UI.
// Flip to false when deploying for real prices.
const DEV_MOCK_PRICES = true;

// --- Throttle queue ---
const priceQueue = [];
let queueRunning = false;
const PRICE_DELAY_MS = 500; // 1 request per 500ms — raise to 1500-3000ms if on Spoonacular free tier

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
      await new Promise((resolve) => setTimeout(resolve, PRICE_DELAY_MS));
    }
  }
  queueRunning = false;
}

// Get meal from MealDB by ID
async function fetchMealById(id) {
  const response = await fetch(`${MEALDB_LOOKUP}${id}`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.meals ? data.meals[0] : null;
}

// Fetch price from Spoonacular (called only by the queue, one at a time).
// Checks localStorage first — if cached, skips the API call entirely.
// In DEV_MOCK_PRICES mode, returns a random price with no API call at all.
async function fetchPrice(mealName, cardId) {
  const priceEl = document.getElementById(`${cardId}-price`);

  if (DEV_MOCK_PRICES) {
    if (priceEl)
      priceEl.textContent = `~$${(Math.random() * 15 + 3).toFixed(2)}`;
    return;
  }

  const cacheKey = `price:${mealName}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    if (priceEl) priceEl.textContent = cached;
    return;
  }

  try {
    const res = await fetch(
      `/api/recipe-price?name=${encodeURIComponent(mealName)}`,
    );
    const data = await res.json();
    const display = data.price ? `~$${data.price}` : "Price unavailable";

    localStorage.setItem(cacheKey, display);

    if (priceEl) priceEl.textContent = display;
  } catch {
    if (priceEl) priceEl.textContent = "Price unavailable";
  }
}

var loading = false;
var current = FIRST_MEAL_ID;

// Load 10 meals at a time
async function loadMeals() {
  if (loading) return;
  loading = true;

  const results = document.getElementById("results");

  for (let i = current; i < current + 10; i++) {
    let meal = await fetchMealById(i);
    if (!meal) continue;

    const cardId = `meal-${meal.idMeal}`;

    results.innerHTML += `
      <a href="/recipeDetails?id=${meal.idMeal}" class="card-link">
        <div class="card">
          <img src="${meal.strMealThumb}" alt="${meal.strMeal}" class="card-img"/>
          <div class="card-meta">
            <h3 class="card-title">${meal.strMeal}</h3>
            <span class="price-label" id="${cardId}-price">Loading price...</span>
          </div>
        </div>
      </a>`;

    current++;

    // Enqueue price fetch — processed one at a time with a delay between each
    enqueuePriceFetch(meal.strMeal, cardId);
  }
  loading = false;
}

// AI suggest button handler
async function suggestRecipe() {
  const btn = document.getElementById("aiSuggestBtn");
  const output = document.getElementById("aiOutput");
  const search = document.getElementById("searchInput")?.value || "";

  btn.disabled = true;
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

  btn.disabled = false;
  btn.textContent = "✦ Suggest a recipe";
}

// Open/close filter dropdown
function toggleDropdown() {
  document.getElementById("filterBtn").classList.toggle("open");
  document.getElementById("dropdown").classList.toggle("open");
}

// Show/hide price field when toggled
function togglePriceField() {
  const on = document.getElementById("priceToggle").checked;
  document.getElementById("priceRow").style.display = on ? "flex" : "none";
  applyFilters();
}

// Main filter function
function applyFilters() {}

<<<<<<< HEAD
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
=======
// Init on DOM ready
>>>>>>> d9c5a0c13a221ffe618c046c0e24d1fa4f7d0ed4
document.addEventListener("DOMContentLoaded", () => {
  // Load first batch of meals
  loadMeals();

  // Infinite scroll
  document.querySelector(".main").addEventListener("scroll", function () {
    const scrollTop = this.scrollTop;
    const scrollHeight = this.scrollHeight;
    const clientHeight = this.clientHeight;
    if (scrollTop + clientHeight + 5 >= scrollHeight) {
      loadMeals();
    }
  });

  // AI suggest button
  const aiBtn = document.getElementById("aiSuggestBtn");
  if (aiBtn) aiBtn.addEventListener("click", suggestRecipe);

  // Popup
  const popup = document.getElementById("firstTimePopupRecipe");
  const closeBtn = document.getElementById("closePopup");
  if (popup && closeBtn) {
    if (!localStorage.getItem("hasVisited")) {
      popup.style.display = "flex";
    }
    closeBtn.addEventListener("click", () => {
      popup.style.display = "none";
      localStorage.setItem("hasVisited", "true");
    });
  }
});
