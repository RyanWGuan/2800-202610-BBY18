require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');

// Middleware to serve static files from the 'public' directory
app.use(express.static('public'));

// Index
app.get('/', (req, res) => {
    res.render('recipes', {
        cssFiles: ['style', 'recipe'],
        jsFiles: ['recipe']
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        cssFiles: ['login'],
        jsFiles: ['login']
    });
});

app.get('/profile', (req,res) => {
    const user = {
        username: "Jobless John",
        email: "jobless987@gmail.com",
        phone: "604-729-6767"
    };


    res.render('profile', {
        user: user,
        cssFiles: ['profile'],
        jsFiles: ['profile']
    });
});

app.get('/map', (req,res) => {
    res.render('map', {
        cssFiles: ['style'],
        jsFiles: ['map'],
        mapboxToken: process.env.MAPBOX_TOKEN
    });
});

app.get('/ingredients', (req,res) => {
    res.render('ingredients');
});

app.get("/savedLocations", (req, res) => {
    res.render("savedLocations", { 
        cssFiles: ["style"],
        jsFiles: []
    });
});

app.get("/savedRecipes", (req, res) => {
    res.render("savedRecipes", { 
        cssFiles: ["style"],
        jsFiles: []
    });
});

// 404
app.use((req,res) => {
	res.status(404);
	res.send("Page not found - 404");
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});