const MEALDB_LOOKUP = "/api/meal/";

// Pull meal ID from url
function getMealUrlID() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

// Extract ingredients and measures from meal object
function getIngredients(meal) {
  const items = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (name && name.trim()) {
      items.push({ name: name.trim(), measure: measure ? measure.trim() : "" });
    }
  }
  return items;
}

// Convert a YouTube watch URL to an embed URL
function toEmbedUrl(youtubeUrl) {
  if (!youtubeUrl) return null;
  const match = youtubeUrl.match(/[?&]v=([^&]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

// Split instructions into steps on newlines / double-newlines
function parseInstructions(text) {
  if (!text) return [];
  return text
    .split(/\r?\n\r?\n|\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Build tags from area, category, and strTags
function buildTags(meal) {
  const tags = [];
  if (meal.strArea) tags.push(meal.strArea);
  if (meal.strCategory) tags.push(meal.strCategory);
  if (meal.strTags) {
    meal.strTags.split(",").forEach((t) => {
      const trimmed = t.trim();
      if (trimmed) tags.push(trimmed);
    });
  }
  return [...new Set(tags)];
}

function renderRecipe(meal) {
  const page = document.getElementById("detail-page");
  const tags = buildTags(meal);
  const ingredients = getIngredients(meal);
  const steps = parseInstructions(meal.strInstructions);
  const embedUrl = toEmbedUrl(meal.strYoutube);

  const mealName = meal.strMeal;
  const ingredientList = ingredients.map((i) => i.name).join(", ");

  const tagHTML = tags
    .map((t) => `<span class="detail-tag">${t}</span>`)
    .join("");

  const ingredientHTML = ingredients
    .map(
      (ing) => `
        <li>
          <span class="ing-name">${ing.name}</span>
          <span class="ing-measure">${ing.measure}</span>
        </li>`,
    )
    .join("");

  const stepsHTML = steps.map((step) => `<li>${step}</li>`).join("");

  const videoSection = embedUrl
    ? `
      <section class="detail-section">
        <div class="detail-section-header">
          <h2>Video</h2>
        </div>
        <div class="detail-video">
          <iframe
            src="${embedUrl}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            title="${meal.strMeal} video">
          </iframe>
        </div>
      </section>`
    : "";

  const nutritionSection = `
      <section class="detail-section" id="nutrition-section">
        <div class="detail-section-header">
          <h2>Nutritional Facts</h2>
        </div>
        <div id="nutrition-content">
          <button
            id="btn-nutrition"
            data-meal="${mealName}"
            data-ingredients="${ingredientList}"
          >
            Generate Nutritional Facts
          </button>
        </div>
      </section>`;

  // AI Assisted for shoppingList button
  const shoppingListSection = `
      <div class="add-to-shopping-list-wrapper">
        <button class="add-to-shopping-list-btn" id="add-to-shopping-list">
          + Add to shopping list
        </button>
      </div>`;

  page.innerHTML = `
      <h1 class="detail-title">${meal.strMeal}</h1>

      <div class="detail-hero">
        <img
          class="detail-image"
          src="${meal.strMealThumb}"
          alt="${meal.strMeal}"
        />
        <div class="detail-tags">${tagHTML}</div>
      </div>

      <section class="detail-section">
        <div class="detail-section-header">
          <h2>Ingredients</h2>
          <div class="recipe-action-buttons">
            <button
              class="save_recipe_button"
              id="save_recipe_button"
            >
              Save
            </button>
          </div>
        </div>
        <ul class="ingredient-list">${ingredientHTML}</ul>
      </section>

      <section class="detail-section">
        <div class="detail-section-header">
          <h2>Instructions</h2>
        </div>
        <ol class="instructions-list">${stepsHTML}</ol>
      </section>

      ${videoSection}
      ${nutritionSection}

      ${shoppingListSection}
    `;

  // Nutrition button listener
  document.getElementById("btn-nutrition").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    loadNutrition(btn.dataset.meal, btn.dataset.ingredients);
  });

  // Save recipe button listener
  const saveRecipeBtn = document.getElementById("save_recipe_button");
  saveRecipeBtn.addEventListener("click", async () => {
    const response = await fetch("/saveRecipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: meal.idMeal,
        name: meal.strMeal,
        image: meal.strMealThumb,
      }),
    });
    const result = await response.json();
    alert(result.message);
  });

  //AI Assisted shopping list button event listener
  const addToShoppingListBtn = document.getElementById("add-to-shopping-list");
  addToShoppingListBtn.addEventListener("click", async () => {
    const ingredientNames = getIngredients(meal).map((i) => i.name);

    const response = await fetch("/api/shoppingList/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeName: meal.strMeal,
        ingredients: ingredientNames,
      }),
    });

    const result = await response.json();
    alert(result.message);
  });
}

async function loadRecipeDetail() {
  const page = document.getElementById("detail-page");
  const id = getMealUrlID();

  if (!id) {
    page.innerHTML = `<div class="detail-error">No meal ID provided in the URL.</div>`;
    return;
  }

  try {
    const response = await fetch(`${MEALDB_LOOKUP}${id}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();

    if (!data.meals) {
      page.innerHTML = `<div class="detail-error">Meal not found.</div>`;
      return;
    }

    renderRecipe(data.meals[0]);
  } catch (err) {
    console.error(err);
    page.innerHTML = `<div class="detail-error">Failed to load recipe. ${err.message}</div>`;
  }
}

// AI generated nutrition facts
async function loadNutrition(mealName, ingredients) {
  const content = document.getElementById("nutrition-content");
  content.innerHTML = "<p>Analysing recipe…</p>";

  try {
    const response = await fetch("/api/nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealName, ingredients }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      content.innerHTML = `<p class="detail-error">Failed to load nutrition info: ${data.error ?? "Unknown error"}</p>`;
      return;
    }

    content.innerHTML = `<div class="nutrition-result">${data.result.replace(/\n/g, "<br>")}</div>`;
  } catch (err) {
    console.error("Nutrition fetch error:", err);
    content.innerHTML = `<p class="detail-error">Failed to load nutrition info.</p>`;
  }
}

loadRecipeDetail();
