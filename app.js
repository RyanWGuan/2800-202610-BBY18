require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const port = process.env.PORT || 3000;
const bcrypt = require("bcrypt");
const { ObjectId } = require('mongodb');
const saltRounds = 12;

const app = express();

const Joi = require("joi");

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

const { MongoClient } = require('mongodb');

const atlasURI = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/`;
const database = new MongoClient(atlasURI, {});
const userCollection = database.db(mongodb_database).collection('users');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// Shared Gemini fetch helper — no package needed, works in any Node version
async function callGemini(prompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000
    })
  });
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
      const searchRes = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(search.trim())}`);
      const searchData = await searchRes.json();
      if (searchData.meals && searchData.meals.length > 0) {
        // Pick a random result from the matches so it's not always the same
        const randomIndex = Math.floor(Math.random() * Math.min(searchData.meals.length, 5));
        meal = searchData.meals[randomIndex];
      }
    }

    // If no search term or no results, get a random meal from MealDB
    if (!meal) {
      const randomRes = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
      const randomData = await randomRes.json();
      meal = randomData.meals?.[0];
    }

    if (!meal) {
      return res.status(404).json({ error: 'No recipe found.' });
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
        secret: mongodb_session_secret
    }
});

app.use(session({
    secret: node_session_secret,
    store: mongoStore,
    saveUninitialized: false,
    resave: false,
    cookie: {
      maxAge: 86400000
    }
}));

app.use(express.static("public"));

function sessionValidation(req, res, next) {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Index
app.get("/", (req, res) => {
  res.render("recipes", {
    cssFiles: ["style", "recipe"],
    jsFiles: ["recipe"],
  });
});

app.get("/login", (req, res) => {
  res.render("login", {
    cssFiles: ["login"],
    jsFiles: ["login"],
  });
});

app.post("/loginSubmit", async (req, res) => {
    const { email, password } = req.body;

    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().max(20).required()
    });

    const validationResult = schema.validate({ email, password });
    if (validationResult.error != null) {
        res.render("loginSubmit", { cssFiles: ['login'], jsFiles: [] });
        return;
    }

    const result = await userCollection
        .find({ email })
        .project({ name: 1, email: 1, password: 1, user_type: 1, _id: 1 })
        .toArray();

    if (result.length !== 1) {
       res.render("loginSubmit", { cssFiles: ['login'], jsFiles: [] });
        return;
    }

    if (await bcrypt.compare(password, result[0].password)) {
        req.session.authenticated = true;
        req.session.name = result[0].name;
        res.redirect('/profile');
    } else {
        res.render("loginSubmit", { cssFiles: ['login'], jsFiles: []  });
    }
});

app.post("/signupSubmit", async (req, res) => {
    const { name, email, password } = req.body;

    const schema = Joi.object({
        name: Joi.string().max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().max(20).required()
    });

    const validationResult = schema.validate({ name, email, password });
    if (validationResult.error != null) {
        const message = validationResult.error.details[0].message;
        res.render("signupSubmit", { message, cssFiles: ['login'], jsFiles: [] });
        return;
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await userCollection.insertOne({ name, email, password: hashedPassword});

    req.session.authenticated = true;
    req.session.name = name;

    res.redirect('/profile');
});

app.get("/profile", (req, res) => {
  res.render("profile", {
    cssFiles: ["style"],
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

app.get("/recipeDetails", (req, res) => {
  res.render("recipeDetails", {
    cssFiles: ["style", "recipeDetails"],
    jsFiles: ["recipeDetails"],
  });
});

// AI generated for AI challenge
app.get("/api/meal/:id", async (req, res) => {
  try {
    const response = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${req.params.id}`);
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