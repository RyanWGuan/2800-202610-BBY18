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
const savedRecipesCollection = database.db(mongodb_database).collection("savedRecipes");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(__dirname + '/public'));

// AI generated AI nutrition facts server side
app.post("/api/nutrition", async (req, res) => {
  console.log("Route hit, body:", req.body); // check if request arrives
  const { mealName, ingredients } = req.body;

  // Dynamic import works inside CommonJS
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `Give concise nutritional facts for the recipe "${mealName}" 
                  with these ingredients: ${ingredients}. 
                  Include estimated calories, protein, carbs, fat, and 2-3 health notes. 
                  Keep it brief and friendly.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash-8b",
      contents: prompt,
    });
    res.json({ result: response.text });
  } catch (err) {
    let message = err.message;
    try {
      const parsed = JSON.parse(err.message);
      if (parsed.error?.status === "RESOURCE_EXHAUSTED") {
        message = "Gemini API quota exceeded. Please try again later.";
      } else {
        message = parsed.error?.message ?? message;
      }
    } catch (_) {
      // err.message wasn't JSON, use as-is
    }
    res.status(500).json({ error: message });
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
    cssFiles: ["style", "login"],
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
        req.session.email = result[0].email;
        req.session.phone = result[0].phone || null;
        res.redirect('/profile');
    } else {
        res.render("loginSubmit", 
          { cssFiles: ['login'], 
            jsFiles: []  
          });
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
    req.session.email = email;
    req.session.phone = null;

    res.redirect('/');
});

app.get("/profile", sessionValidation, (req, res) => {
  res.render("profile", {
    user: {
      name: req.session.name,
      email: req.session.email,
      phone: req.session.phone
    },

    cssFiles: ["style", "profile"],
    jsFiles: ["profile"],
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log("ERROR DESTROYING SESSION:", err);
      return res.redirect('/profile');
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

app.post("/updateUser", sessionValidation, async (req, res) => {
  const {field, value, currentPassword} = req.body;
  const oldEmail = req.session.email;

  const user = await userCollection.findOne({email: oldEmail});

  const passwordsMatch = await bcrypt.compare(currentPassword, user.password);
  if (!passwordsMatch) {
    return res.send("Incorrect current password. Update Failed");
  }

  let updateValue = value;

  if (field === 'password') {
        if (value.length < 8) {
            return res.send("New password must be at least 8 characters.");
        }
        updateValue = await bcrypt.hash(value, saltRounds);
    }

  const updateData = {};
  updateData[field] = value;

  try {
    await userCollection.updateOne({ email: oldEmail}, {$set: updateData});

    if (field === 'name') req.session.name = value;
    if (field === 'email') req.session.email = value;
    if (field === 'phone') req.session.phone = value;

    res.redirect('/');
  } catch (err) {
    res.status(500).send("Error updating profile.");
  }
});

app.get("/map", (req, res) => {
  res.render("map", {
    cssFiles: ["style", "map"],
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

app.get("/savedRecipes", async (req, res) => {
  const savedRecipes = await savedRecipesCollection.find({}).toArray();

  res.render("savedRecipes", {
    cssFiles: ["style"],
    jsFiles: ["savedRecipes"],
    savedRecipes: savedRecipes,
  });
});

app.get("/recipeDetails", (req, res) => {
  res.render("recipeDetails", {
    cssFiles: ["style", "recipeDetails"],
    jsFiles: ["recipeDetails"],
  });
});


app.post("/saveRecipe", async (req, res) => {
  const { id, name, image } = req.body;

  const alreadySaved = await savedRecipesCollection.findOne({ id: id });

  if (alreadySaved) {
    return res.json({
      success: false,
      message: "Recipe already saved!"
    });
  }

  await savedRecipesCollection.insertOne({
    id: id,
    name: name,
    image: image,
    createdAt: new Date()
  });

  res.json({
    success: true,
    message: "Recipe saved!"
  });
});

app.delete("/deleteSavedRecipe/:id", async (req, res) => {
  const recipeId = req.params.id;

  await savedRecipesCollection.deleteOne({
    _id: new ObjectId(recipeId)
  });

  res.json({ success: true });
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