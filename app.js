require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const port = process.env.PORT || 3000;
const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
const nodemailer = require("nodemailer");
const saltRounds = 12;


const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const app = express();

const Joi = require("joi");

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_USER_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

const { MongoClient } = require("mongodb");

const atlasURI = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`;
const database = new MongoClient(atlasURI, {});
const userCollection = database.db(mongodb_database).collection("users");
const shoppingListCollection = database
  .db(mongodb_database)
  .collection("shoppingList");
const savedRecipesCollection = database
  .db(mongodb_database)
  .collection("savedRecipes");

const savedLocationsCollection = database
  .db(mongodb_database)
  .collection("savedLocations");

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

// Merge Local Session into account you log into.
async function mergeSessionShoppingList(req) {
  const sessionList = req.session.shoppingList || [];
  if (sessionList.length === 0) return;

  for (const item of sessionList) {
    const { recipeName, ingredients } = item;
    await shoppingListCollection.deleteMany({ recipeName, userEmail: req.session.email });
    await shoppingListCollection.insertOne({ recipeName, ingredients, userEmail: req.session.email });
  }

  req.session.shoppingList = [];
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


// Recipe suggestion — Uses AI to curate based on saved recipes, if user doesn't, uses MealDB's random query
app.post("/api/recipe-suggest", async (req, res) => {
  const { search, savedRecipeNames } = req.body;

  try {
    let searchTerm = search?.trim() || "";

    // If user has saved recipes, ask AI to suggest something based on them
    if (!searchTerm && savedRecipeNames?.length > 0) {
      const prompt = `A user enjoys these recipes: ${savedRecipeNames.join(", ")}.
Suggest ONE recipe name they would likely enjoy that is different from those listed.
Reply with ONLY the recipe name, nothing else.`;
      searchTerm = (await callGemini(prompt)).trim();
    }

    let meal = null;

    if (searchTerm) {
      const searchRes = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchTerm)}`
      );
      const searchData = await searchRes.json();
      if (searchData.meals?.length > 0) {
        const randomIndex = Math.floor(Math.random() * Math.min(searchData.meals.length, 5));
        meal = searchData.meals[randomIndex];
      }
    }

    // Fallback to random
    if (!meal) {
      const randomRes = await fetch("https://www.themealdb.com/api/json/v1/1/random.php");
      const randomData = await randomRes.json();
      meal = randomData.meals?.[0];
    }

    if (!meal) return res.status(404).json({ error: "No recipe found." });

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
  res.render("logIn", {
    cssFiles: ["style", "login"],
    jsFiles: ["easterEgg"],
  });
});

app.get("/verifyMFA", (req, res) => {

  if (!req.session.pendingMFA) {
    return res.redirect("/login");
  }

  res.render("verifyMFA", {
    cssFiles: ["style", "login"],
    jsFiles: [],
  });
});

app.post("/verifyMFA", async (req, res) => {

  const { code } = req.body;

  if (code === req.session.mfaCode) {

    req.session.authenticated = true;

    req.session.name = req.session.mfaName;
    req.session.email = req.session.mfaEmail;
    req.session.phone = req.session.mfaPhone;

    delete req.session.pendingMFA;
    delete req.session.mfaCode;
    delete req.session.mfaName;
    delete req.session.mfaEmail;
    delete req.session.mfaPhone;

    return res.redirect("/profile");
  }

  res.send("Invalid verification code.");
});

app.post("/loginSubmit", async (req, res) => {
  const { email, password } = req.body;

  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().max(20).required(),
  });

  const validationResult = schema.validate({ email, password });
  if (validationResult.error != null) {
    res.render("loginSubmit", { 
      cssFiles: ["login", "style"], 
      jsFiles: [],
     });
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
    const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();

      req.session.pendingMFA = true;
      req.session.mfaCode = mfaCode;

      req.session.mfaName = result[0].name;
      req.session.mfaEmail = result[0].email;
      req.session.mfaPhone = result[0].phone || null;
      await mergeSessionShoppingList(req);

      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: result[0].email,
          subject: "RecipeQuest Verification Code",
          text: `Your verification code is: ${mfaCode}`,
        });
      
        res.redirect("/verifyMFA");
      
      } catch (error) {
        console.log("MFA EMAIL ERROR:", error);
        res.send("Could not send verification email. Please try again.");
      }

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
    res.render("signupSubmit", {
      message,
      cssFiles: ["login"],
      jsFiles: ["easterEgg"],
    });
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
    isLoggedIn: req.session.authenticated || false,
  });
});

app.post("/api/shoppingList/add", async (req, res) => {
  const { recipeName, ingredients } = req.body;

  if (req.session.authenticated) {
    const userEmail = req.session.email;
    await shoppingListCollection.deleteMany({ recipeName, userEmail });
    await shoppingListCollection.insertOne({ recipeName, ingredients, userEmail });
  }

  if (!req.session.shoppingList) req.session.shoppingList = [];
  req.session.shoppingList = req.session.shoppingList.filter(i => i.recipeName !== recipeName);
  req.session.shoppingList.push({ recipeName, ingredients });

  await new Promise((resolve, reject) =>
    req.session.save(err => err ? reject(err) : resolve())
  );

  res.json({ message: "Added to shopping list!" });
});

app.get("/api/shoppingList", async (req, res) => {
  if (req.session.authenticated) {
    const items = await shoppingListCollection.find({ userEmail: req.session.email }).toArray();
    return res.json(items);
  }
  res.json(req.session.shoppingList || []);
});

app.get("/shoppingList", (req, res) => {
  res.render("shoppingList", {
    title: "Ingredients",
    cssFiles: ["shoppingList", "style"],
    jsFiles: ["easterEgg"],
  });
});

app.get("/savedLocations", async (req, res) => {
  const savedLocations = await savedLocationsCollection
    .find({ userEmail: req.session.email })
    .toArray();

  res.render("savedLocations", {
    cssFiles: ["style"],
    jsFiles: ["savedLocations", "easterEgg"],
    savedLocations: savedLocations,
  });
});


app.get("/savedRecipes", async (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect("/login");
  }

  const savedRecipes = await savedRecipesCollection
    .find({ userEmail: req.session.email })
    .toArray();

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
    isLoggedIn: req.session.authenticated || false,
  });
});

app.post("/saveRecipe", async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  const { id, name, image } = req.body;

  const existingRecipe = await savedRecipesCollection.findOne({
    userEmail: req.session.email,
    id: id,
  });

  if (existingRecipe) {
    return res.json({
      message: "Recipe already saved!",
    });
  }

  await savedRecipesCollection.insertOne({
    userEmail: req.session.email,
    id,
    name,
    image,
  });

  res.json({
    message: "Recipe saved successfully!",
  });
});

app.post("/saveLocation", async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({ message: "Please log in first." });
  }

  const { name, address } = req.body;

  const existingLocation = await savedLocationsCollection.findOne({
    userEmail: req.session.email,
    name,
    address,
  });

  if (existingLocation) {
    return res.json({ message: "Location already saved!" });
  }

  await savedLocationsCollection.insertOne({
    userEmail: req.session.email,
    name,
    address,
  });

  res.json({ message: "Location saved successfully!" });
});

app.delete("/deleteSavedLocation/:id", async (req, res) => {
  await savedLocationsCollection.deleteOne({
    _id: new ObjectId(req.params.id),
    userEmail: req.session.email,
  });

  res.json({ message: "Location deleted successfully!" });
});

app.delete("/deleteSavedRecipe/:id", async (req, res) => {
  if (!req.session.authenticated) {
    return res.status(401).json({
      message: "Please log in first."
    });
  }

  await savedRecipesCollection.deleteOne({
    _id: new ObjectId(req.params.id),
    userEmail: req.session.email,
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

app.get("/api/savedRecipes", async (req, res) => {
  if (!req.session.authenticated) return res.json([]);
  const saved = await savedRecipesCollection
    .find({ userEmail: req.session.email })
    .toArray();
  res.json(saved);
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
