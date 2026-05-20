require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const port = process.env.PORT || 3000;
const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
const saltRounds = 12;

const app = express();

const Joi = require("joi");

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

const { MongoClient } = require("mongodb");

const atlasURI = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/`;
const database = new MongoClient(atlasURI, {});
<<<<<<< HEAD

const userCollection = database.db(mongodb_database).collection('users');
const savedRecipesCollection = database.db(mongodb_database).collection("savedRecipes");

=======
const userCollection = database.db(mongodb_database).collection("users");
const savedRecipesCollection = database
  .db(mongodb_database)
  .collection("savedRecipes");
>>>>>>> d9c5a0c13a221ffe618c046c0e24d1fa4f7d0ed4

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(__dirname + "/public"));

// Shared Gemini fetch helper — no package needed, works in any Node version
async function callGemini(prompt) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
      }),
    },
  );
  const data = await response.json();
  console.log("Groq raw response:", JSON.stringify(data));
  if (!response.ok) throw new Error(data.error?.message || "Groq error");
  return data.choices?.[0]?.message?.content || "No response.";
}

// AI nutrition facts
app.post("/api/nutrition", async (req, res) => {
  console.log("Route hit, body:", req.body);
  const { mealName, ingredients } = req.body;

  const prompt = `Give concise nutritional facts for the recipe "${mealName}" 
                  with these ingredients: ${ingredients}. 
                  Include estimated calories, protein, carbs, fat, and 2-3 health notes. 
                  Keep it brief and friendly.`;
  try {
    const result = await callGemini(prompt);
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recipe suggestion — searches MealDB directly, no AI needed
app.post("/api/recipe-suggest", async (req, res) => {
  const { search } = req.body;

  try {
    // Search MealDB by name if provided, otherwise fetch a random one
    let meal = null;

    if (search && search.trim()) {
      const searchRes = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(search.trim())}`,
      );
      const searchData = await searchRes.json();
      if (searchData.meals && searchData.meals.length > 0) {
        // Pick a random result from the matches so it's not always the same
        const randomIndex = Math.floor(
          Math.random() * Math.min(searchData.meals.length, 5),
        );
        meal = searchData.meals[randomIndex];
      }
    }

    // If no search term or no results, get a random meal from MealDB
    if (!meal) {
      const randomRes = await fetch(
        "https://www.themealdb.com/api/json/v1/1/random.php",
      );
      const randomData = await randomRes.json();
      meal = randomData.meals?.[0];
    }

    if (!meal) {
      return res.status(404).json({ error: "No recipe found." });
    }

    res.json({
      found: true,
      id: meal.idMeal,
      name: meal.strMeal,
      image: meal.strMealThumb,
      category: meal.strCategory,
      area: meal.strArea,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.set("view engine", "ejs");

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`,
  crypto: {
    secret: mongodb_session_secret,
  },
});

app.use(
  session({
    secret: node_session_secret,
    store: mongoStore,
    saveUninitialized: false,
    resave: false,
    cookie: {
      maxAge: 86400000,
    },
  }),
);

app.use(express.static("public"));

function sessionValidation(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.redirect("/login");
  }
}

// Index
app.get("/", (req, res) => {
  res.render("recipes", {
    cssFiles: ["style", "recipe"],
    jsFiles: ["recipe", "easterEgg"],
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

app.get("/api/recipe-price", async (req, res) => {
  const { name } = req.query;
  try {
    const response = await fetch(
      `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(name)}&number=1&addRecipeInformation=true&apiKey=${process.env.SPOONACULAR_KEY}`,
    );
    const data = await response.json();
    const recipe = data.results?.[0];
    const price = recipe?.pricePerServing
      ? ((recipe.pricePerServing / 100) * 1.3704).toFixed(2)
      : null;
    res.json({ price });
  } catch (err) {
    res.json({ price: null });
  }
});
app.get("/login", (req, res) => {
  res.render("login", {
    cssFiles: ["style", "login"],
    jsFiles: ["login", "easterEgg"],
  });
});

app.post("/loginSubmit", async (req, res) => {
  const { email, password } = req.body;

  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().max(20).required(),
  });

  const validationResult = schema.validate({ email, password });
  if (validationResult.error != null) {
    res.render("loginSubmit", { cssFiles: ["login"], jsFiles: [] });
    return;
  }

  const result = await userCollection
    .find({ email })
    .project({ name: 1, email: 1, password: 1, user_type: 1, _id: 1 })
    .toArray();

  if (result.length !== 1) {
    res.render("loginSubmit", { cssFiles: ["login"], jsFiles: [] });
    return;
  }

  if (await bcrypt.compare(password, result[0].password)) {
    req.session.authenticated = true;
    req.session.name = result[0].name;
    req.session.email = result[0].email;
    req.session.phone = result[0].phone || null;
    res.redirect("/profile");
  } else {
    res.render("loginSubmit", { cssFiles: ["login"], jsFiles: [] });
  }
});

app.post("/signupSubmit", async (req, res) => {
  const { name, email, password } = req.body;

  const schema = Joi.object({
    name: Joi.string().max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().max(20).required(),
  });

  const validationResult = schema.validate({ name, email, password });
  if (validationResult.error != null) {
    const message = validationResult.error.details[0].message;
    res.render("signupSubmit", { message, cssFiles: ["login"], jsFiles: ["easterEgg"] });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, saltRounds);
  await userCollection.insertOne({ name, email, password: hashedPassword });

  req.session.authenticated = true;
  req.session.name = name;
  req.session.email = email;
  req.session.phone = null;

  res.redirect("/");
});

app.get("/profile", sessionValidation, (req, res) => {
  res.render("profile", {
    user: {
      name: req.session.name,
      email: req.session.email,
      phone: req.session.phone,
    },

    cssFiles: ["style", "profile"],
    jsFiles: ["profile", "easterEgg"],
  });
});

app.get("/miniGame", (req, res) => {
  res.render("miniGame", {
    cssFiles: ["style", "miniGame"],
    jsFiles: ["miniGame"],
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("ERROR DESTROYING SESSION:", err);
      return res.redirect("/profile");
    }
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

app.post("/updateUser", sessionValidation, async (req, res) => {
  const { field, value, currentPassword } = req.body;
  const oldEmail = req.session.email;

  const user = await userCollection.findOne({ email: oldEmail });

  const passwordsMatch = await bcrypt.compare(currentPassword, user.password);
  if (!passwordsMatch) {
    return res.send("Incorrect current password. Update Failed");
  }

  let updateValue = value;

  if (field === "password") {
    if (value.length < 8) {
      return res.send("New password must be at least 8 characters.");
    }
    updateValue = await bcrypt.hash(value, saltRounds);
  }

  const updateData = {};
  updateData[field] = value;

  try {
    await userCollection.updateOne({ email: oldEmail }, { $set: updateData });

    if (field === "name") req.session.name = value;
    if (field === "email") req.session.email = value;
    if (field === "phone") req.session.phone = value;

    res.redirect("/");
  } catch (err) {
    res.status(500).send("Error updating profile.");
  }
});

app.get("/map", (req, res) => {
  res.render("map", {
    cssFiles: ["style"],
    jsFiles: ["map", "easterEgg"],
    mapboxToken: process.env.MAPBOX_TOKEN,
  });
});

app.get("/shoppingList", (req, res) => {
  res.render("shoppingList", {
    title: "Ingredients",
    cssFiles: ["shoppingList", "style"],
    jsFiles: ["easterEgg"],
  });
});

app.get("/savedLocations", (req, res) => {
  res.render("savedLocations", {
    cssFiles: ["style"],
    jsFiles: ["savedLocations", "easterEgg"],
  });
});

app.get("/savedRecipes", async (req, res) => {
  const savedRecipes = await savedRecipesCollection.find().toArray();

  res.render("savedRecipes", {
    cssFiles: ["style", "recipe"],
    jsFiles: ["easterEgg"],
    savedRecipes: savedRecipes,
  });
});

app.get("/recipeDetails", (req, res) => {
  res.render("recipeDetails", {
    cssFiles: ["style", "recipeDetails"],
    jsFiles: ["recipeDetails", "easterEgg"],
  });
});

app.post("/saveRecipe", async (req, res) => {
  const { id, name, image } = req.body;

  const existingRecipe = await savedRecipesCollection.findOne({ id });

  if (existingRecipe) {
    return res.json({
      message: "Recipe already saved!",
    });
  }

  await savedRecipesCollection.insertOne({
    id,
    name,
    image,
  });

  res.json({
    message: "Recipe saved successfully!",
  });
});

app.delete("/deleteSavedRecipe/:id", async (req, res) => {
  const recipeId = req.params.id;

  await savedRecipesCollection.deleteOne({
    _id: new ObjectId(recipeId),
  });

  res.json({
    message: "Recipe deleted successfully!",
  });
});

//AI generated for AI challenge
app.get("/api/meal/:id", async (req, res) => {
  try {
    const response = await fetch(
      `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${req.params.id}`,
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
