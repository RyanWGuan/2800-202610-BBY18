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
  res.render("recipes", {
    cssFiles: ["style", "recipeDetails"],
    jsFiles: ["recipeDetails"],
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