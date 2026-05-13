require("dotenv").config();
const express = require("express");
const app = express();
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const port = process.env.PORT || 3000;

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
    cookie: true,
}));


// Middleware to serve static files from the 'public' directory
app.use(express.static("public"));

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

// 404
app.use((req, res) => {
  res.status(404);
  res.send("Page not found - 404");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
