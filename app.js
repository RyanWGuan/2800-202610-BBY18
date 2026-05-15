require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const { database } = require("./databaseConnection");
const mongodb_database = process.env.MONGODB_USER_DATABASE;
const recipeCollection = database.db(mongodb_database).collection("recipes");

app.set("view engine", "ejs");

// Middleware to serve static files from the 'public' directory
app.use(express.static("public"));

// AI ASSISTED recipe route, fetching data from spoonacular API
app.get("/", (req, res) => {
  res.render("recipes", {
    cssFiles: ["style", "recipe"],
    jsFiles: ["recipe"],
  });
});

// AI ASSISTED for infinite scrolling
app.get("/api/recipes", async (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const number = 10;

  const response = await fetch(
    `https://api.spoonacular.com/recipes/complexSearch?number=${number}&offset=${offset}&addRecipeInformation=true&apiKey=${process.env.SPOONACULAR_KEY}`,
  );
  const data = await response.json();
  res.json(data.results);
});

app.get("/login", (req, res) => {
  res.render("login", {
    cssFiles: ["login"],
    jsFiles: ["login"],
  });
});

app.get("/profile", (req, res) => {
  const user = {
    username: "Jobless John",
    email: "jobless987@gmail.com",
    phone: "604-729-6767",
  };

  res.render("profile", {
    user: user,
    cssFiles: ["profile"],
    jsFiles: ["profile"],
  });
});

app.get("/map", (req, res) => {
  res.render("map", {
    cssFiles: ["style"],
    jsFiles: ["map"],
    mapboxToken: process.env.MAPBOX_TOKEN,
  });
});

app.get("/shoppingList", (req, res) => {
  res.render("shoppingList", {
    title: "Ingredients",
    cssFiles: ["shoppingList", "style"],
    jsFiles: [],
  });
});

app.get("/savedLocations", (req, res) => {
  res.render("savedLocations", {
    cssFiles: ["style"],
    jsFiles: [],
  });
});

app.get("/savedRecipes", (req, res) => {
  res.render("savedRecipes", {
    cssFiles: ["style"],
    jsFiles: [],
  });
});

// 404
app.use((req, res) => {
  res.status(404);
  res.send("Page not found - 404");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
