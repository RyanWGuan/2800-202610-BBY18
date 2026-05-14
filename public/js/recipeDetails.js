const MEALDB_LOOKUP = "https://www.themealdb.com/api/json/v1/1/lookup.php?i=";
 
// Pull meal ID from url
function getMealUrlID() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}
 
// Extract ingredients and measures from meal object
function getIngredients(meal) {
    const items = [];
    for (let i = 1; i <= 20; i++) {
        const name    = meal[`strIngredient${i}`];
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
      .map(s => s.trim())
      .filter(Boolean);
  }
 
// Build tags from area, category, and strTags
function buildTags(meal) {
    const tags = [];
    if (meal.strArea)     tags.push(meal.strArea);
    if (meal.strCategory) tags.push(meal.strCategory);
    if (meal.strTags) {
        meal.strTags.split(",").forEach(t => {
            const trimmed = t.trim();
            if (trimmed) tags.push(trimmed);
      });
    }
    return [...new Set(tags)]; // deduplicate
}
 
 function renderRecipe(meal) {
    const page         = document.getElementById("detail-page");
    const tags         = buildTags(meal);
    const ingredients  = getIngredients(meal);
    const steps        = parseInstructions(meal.strInstructions);
    const embedUrl     = toEmbedUrl(meal.strYoutube);
 
    const tagHTML = tags
      .map(t => `<span class="detail-tag">${t}</span>`)
      .join("");
 
    const ingredientHTML = ingredients
      .map(ing => `
        <li>
          <span class="ing-name">${ing.name}</span>
          <span class="ing-measure">${ing.measure}</span>
        </li>`)
      .join("");
 
    const stepsHTML = steps
      .map(step => `<li>${step}</li>`)
      .join("");
 
    const videoSection = embedUrl ? `
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
      </section>` : "";
 
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
          <button class="btn-fav" id="btn-fav" title="Save to favourites" aria-label="Favourite">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.24 3 11.91 3.81 13 5.08C14.09 3.81 15.76 3 17.5 3C20.58 3 23 5.42 23 8.5C23 14.5 12 21 12 21Z"
                stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </button>
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
    `;
 
    // Favourite toggle
    const favBtn = document.getElementById("btn-fav");
    const favKey = `fav_${meal.idMeal}`;
    if (localStorage.getItem(favKey)) favBtn.classList.add("active");
    favBtn.addEventListener("click", () => {
      favBtn.classList.toggle("active");
      favBtn.classList.contains("active")
        ? localStorage.setItem(favKey, "1")
        : localStorage.removeItem(favKey);
    });
  }
 
  async function loadRecipeDetail() {
    const page = document.getElementById("detail-page");
    const id   = getMealUrlID();
 
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
 
  loadRecipeDetail();
