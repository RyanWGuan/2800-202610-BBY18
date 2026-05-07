const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');

// Middleware to serve static files from the 'public' directory
app.use(express.static('public'));

// Index
app.get('/', (req, res) => {
    res.render('recipes', {
        cssFiles: ['style']
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