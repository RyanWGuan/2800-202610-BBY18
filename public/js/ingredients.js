/* This code was given by claude.ai to help me understand using API keys */
require("dotenv").config();

const apiKey = process.env.SPOONACULAR_KEY;

async function searchRecipes(query) {
  // First call - get a random recipe
  const url = `https://api.spoonacular.com/recipes/complexSearch?query=${query}&apiKey=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  const recipe = data.results[0];
  console.log("Recipe:", recipe.title);

  // Second call - get price breakdown using that id
  const priceUrl = `https://api.spoonacular.com/recipes/${recipe.id}/priceBreakdownWidget.json?apiKey=${apiKey}`;

  const priceResponse = await fetch(priceUrl);
  const priceData = await priceResponse.json();

  // Print each ingredient with its price
  priceData.ingredients.forEach((ingredient) => {
    const price = (ingredient.price / 100).toFixed(2); // converts cents to dollars to CAD
    console.log(`${ingredient.name}: $${price}`);
  });

  // Print total
  const total = (priceData.totalCost / 100).toFixed(2);
  console.log(`\nTotal estimated cost: $${total}`);
}

searchRecipes("Chicken Sausage, White Bean and Cabbage Soup");
