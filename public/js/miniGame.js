/* DOM Element References for Core Game Components */
const bowl = document.getElementById('bowl');
const gameContainer = document.getElementById('game-container');
const scoreDisplay = document.getElementById('score-display'); 
const timeDisplay = document.getElementById('time-display');

/* DOM Element References for Post-Game Overlay Displays */
const recipeOverlay = document.getElementById('recipe-screen-overlay');
const totalSpendSummary = document.getElementById('total-spend-summary');
const recipeCardTarget = document.getElementById('suggested-recipe-card-target');

/* Game State Tracking Variables */
let totalMoney = 0.00; 
let timeLeft = 30; 
/* Holds the background timer countdown interval block */
let gameInterval;  
/* Holds the element generation spawning interval block */
let spawnInterval; 

/* Engine Balancing Properties */
/* Pixel downward offset translation added per frame redraw */
const fallingSpeed = 8; 
/* Spawning speed constraint tracked in milliseconds */
const spawnRate = 1500; 

/* Resource Pool Staging Array for Drop Item Assets */
const itemImages = [
    './images/apple.png', './images/blueberry.png', './images/chicken.png',
    './images/corn.png', './images/e.png', './images/grape.png',
    './images/ham.png', './images/steak.png', './images/strawberry.png', './images/tomato.png'
];

/* Drag and Drop Calculation Coordinate Flags */
let isDragging = false;
/* Initial horizontal selection alignment offset variable */
let startX = 0;
/* Track active paddle translation layout values across the view field */
let currentX = 0; 
let isPaused = false;

/* Capture spatial starting points when user clicks or touches the interaction item */
function startDrag(event) {
    if (isPaused || timeLeft <= 0) return; 
    isDragging = true;
    /* Unify mobile screen touch tracking dimensions with standard mouse event coordinates */
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    startX = clientX - currentX;
}

/* Slide the target capture platform left or right inside set view bounds boundaries */
function onDrag(event) {
    if (!isDragging || isPaused || timeLeft <= 0) return;
    /* Terminate native smart scroll interactions during active touch events */
    event.preventDefault(); 
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    currentX = clientX - startX;

    /* Enforce layout boundary guard clipping properties on right/left edges */
    const maxBoundary = window.innerWidth / 2 - 50; 
    if (currentX < -maxBoundary) currentX = -maxBoundary;
    if (currentX > maxBoundary) currentX = maxBoundary;

    bowl.style.transform = `translateX(${currentX}px)`;
}

/* Detach movement state listeners once mouse clicks or contact layers are broken */
function stopDrag() { isDragging = false; }

/* Desktop Event Wire-up Registrations */
bowl.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', onDrag);
window.addEventListener('mouseup', stopDrag);

/* Mobile Event Wire-up Registrations */
bowl.addEventListener('touchstart', startDrag);
window.addEventListener('touchmove', onDrag, { passive: false });
window.addEventListener('touchend', stopDrag);

/* Factory Engine Component Assembling and Spawning New Falling Elements */
function createFallingItem() {
    if (timeLeft <= 0 || isPaused) return;

    /* Construct wrapper display nodes for the item block containing text descriptions */
    const container = document.createElement('div');
    container.classList.add('falling-item');
    container.style.position = 'absolute';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.top = '-90px'; 
    
    /* Distribute horizontal spawn points evenly across viewport configurations */
    const randomX = Math.random() * (window.innerWidth - 60);
    container.style.left = `${randomX}px`;

    /* Calculate dynamic arcade currency metrics assigned onto each dropped asset instance */
    const randomSteps = Math.floor(Math.random() * 20) + 1; 
    const itemValue = randomSteps * 0.05; 
    container.dataset.value = itemValue;

    /* Construct matching price tag text overlay bubbles styling properties */
    const priceTag = document.createElement('span');
    priceTag.innerText = `$${itemValue.toFixed(2)}`;
    priceTag.style.background = 'rgba(0, 0, 0, 0.6)';
    priceTag.style.color = '#fff';
    priceTag.style.fontSize = '12px';
    priceTag.style.fontWeight = 'bold';
    priceTag.style.padding = '2px 6px';
    priceTag.style.borderRadius = '10px';
    priceTag.style.marginBottom = '4px';

    /* Assign food illustrations randomly from pre-defined image source maps */
    const itemImg = document.createElement('img');
    itemImg.src = itemImages[Math.floor(Math.random() * itemImages.length)];
    itemImg.style.width = '60px'; 
    
    container.appendChild(priceTag);
    container.appendChild(itemImg);
    gameContainer.appendChild(container);
    
    /* Frame-by-frame rendering loop tracking individual physics translation steps */
    function fall() {
        /* Suspend frame step operations safely if game state freeze parameters trigger */
        if (isPaused) {
            requestAnimationFrame(fall);
            return;
        }
        /* Flush active array item stacks if the level clock expires mid-flight */
        if (timeLeft <= 0) {
            container.remove();
            return;
        }

        let currentTop = parseFloat(container.style.top);
        currentTop += fallingSpeed;
        container.style.top = `${currentTop}px`;
        
        /* Evaluate item boundary interception overlaps matching platform layout locations */
        if (checkCollision(itemImg, bowl)) {
            totalMoney += parseFloat(container.dataset.value);
            scoreDisplay.innerText = `$${totalMoney.toFixed(2)}`; 
            container.remove();                  
            return;                         
        }
        
        /* Clean up drifting objects that completely fall past floor thresholds */
        if (currentTop > window.innerHeight) {
            container.remove(); 
            return;        
        }
        
        requestAnimationFrame(fall);
    }
    requestAnimationFrame(fall);
}

/* Axis-Aligned Bounding Box Intersection Calculation Checking Helpers */
function checkCollision(item, bowl) {
    const itemRect = item.getBoundingClientRect();
    const bowlRect = bowl.getBoundingClientRect();
    return !(
        itemRect.top > bowlRect.bottom || itemRect.bottom < bowlRect.top ||
        itemRect.right < bowlRect.left || itemRect.left > bowlRect.right
    );
}

/* Background Timing Configuration Counter Loops */
function startGameTimer() {
    gameInterval = setInterval(() => {
        timeLeft--;
        timeDisplay.innerText = timeLeft; 

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

/* Level Warm-Up Initialization Operations Pipeline */
function startGame() {
    totalMoney = 0.00;
    timeLeft = 30;
    scoreDisplay.innerText = `$${totalMoney.toFixed(2)}`;
    timeDisplay.innerText = timeLeft;
    recipeOverlay.style.display = "none";
    
    startGameTimer();
    spawnInterval = setInterval(createFallingItem, spawnRate);
}

/* Freeze or Resume Time-Dependent Game Mechanics Rules */
function togglePause() {
    if (timeLeft <= 0) return;
    if (isPaused) {
        isPaused = false;
        startGameTimer();
        spawnInterval = setInterval(createFallingItem, spawnRate); 
    } else {
        isPaused = true;
        clearInterval(gameInterval);
        clearInterval(spawnInterval);
    }
}

/* Clean State Flush Procedure Wiping Active Elements Off Field */
function resetGame() {
    clearInterval(gameInterval);
    clearInterval(spawnInterval);
    document.querySelectorAll('.falling-item').forEach(item => item.remove());
    isPaused = false;
    currentX = 0;
    bowl.style.transform = `translateX(0px)`;
    startGame();
}

/* Game Over Terminal Stage: Displays Score and Matches Recipes to Captured Budget */
function endGame() {
    clearInterval(gameInterval);
    clearInterval(spawnInterval); 
    
    document.querySelectorAll('.falling-item').forEach(item => item.remove());

    /* Initialize target card screen template components messages */
    totalSpendSummary.innerText = `You collected a market basket total of $${totalMoney.toFixed(2)}!`;
    recipeCardTarget.innerHTML = `<p style="color: #aaa; text-align:center;">Analyzing ingredients within budget...</p>`;
    recipeOverlay.style.display = "flex";

    /* Retrieve active database arrays cached inside Session Storage profiles */
    let cachedMealsArray = [];
    try {
        const rawCache = sessionStorage.getItem("cachedMeals");
        if (rawCache) cachedMealsArray = JSON.parse(rawCache);
    } catch (e) {
        console.error("Cache parsing error", e);
    }

    /* Filter down target objects to recipes that fit within player budget limits */
    let affordableRecipes = cachedMealsArray.filter(meal => {
        return meal._bcPrice != null && meal._bcPrice <= totalMoney;
    });

    /* Fallback Safety Rule: If everything is out of budget, find the next cheapest option */
    if (affordableRecipes.length === 0 && cachedMealsArray.length > 0) {
        affordableRecipes = [...cachedMealsArray].sort((a, b) => (a._bcPrice || 0) - (b._bcPrice || 0));
    }

    /* Extract a random recipe element node out of valid matched list returns */
    const targetedMeal = affordableRecipes[Math.floor(Math.random() * affordableRecipes.length)];

    if (targetedMeal) {
        const finalPriceDisplay = targetedMeal._bcPrice 
            ? `🍁 ~$${targetedMeal._bcPrice.toFixed(2)}` 
            : `Estimated near your target budget`;

        /* Inject interactive target interface cards elements layout blocks dynamically */
        recipeCardTarget.innerHTML = `
            <a href="/recipeDetails?id=${targetedMeal.idMeal}" style="text-decoration: none; display: block; color: inherit;">
                <div style="background: #4a8cee; border: 2px solid #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
                    <img src="${targetedMeal.strMealThumb}" alt="${targetedMeal.strMeal}" style="width: 100%; height: 180px; object-fit: cover;" />
                    <div style="padding: 15px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 18px; color: #fff;">${targetedMeal.strMeal}</h4>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: white; font-weight: bold; font-size: 14px;">${finalPriceDisplay}</span>
                            <span style="background: #2f6bc6; padding: 2px 8px; border-radius: 4px; font-size: 11px; color: #cbd5e1;">View Details →</span>
                        </div>
                    </div>
                </div>
            </a>
            <button id="play-again-overlay-btn" style="margin-top: 15px; width: 100%; padding: 10px; background: #8cc63f; color: rgb(255, 255, 255); font-weight: bold; border: none; border-radius: 6px; cursor: pointer;">Play Again</button>
        `;

        /* Attach target game initialization loops directly to overlay display buttons */
        document.getElementById('play-again-overlay-btn').addEventListener('click', resetGame);
    } else {
        /* Ultimate Fallback Template Structure displayed if storage cache structures are clean */
        recipeCardTarget.innerHTML = `
            <div style="background: #1e293b; padding: 20px; border-radius: 12px; text-align: center; border: 1px dashed #475569;">
                <p style="margin: 0 0 10px 0; color: #cbd5e1;">No cached matches active.</p>
                <a href="/recipes" style="color: #ffca28; font-size: 14px; font-weight: bold;">Browse Recipe Catalogue</a>
            </div>
            <button id="play-again-overlay-btn" style="margin-top: 15px; width: 100%; padding: 10px; background: #ffca28; color: #000; font-weight: bold; border: none; border-radius: 6px; cursor: pointer;">Play Again</button>
        `;
        document.getElementById('play-again-overlay-btn').addEventListener('click', resetGame);
    }
}

/* Control Dashboard Interface Event Handler Bindings */
document.getElementById('pause-button-id')?.addEventListener('click', togglePause);
document.getElementById('reset-button-id')?.addEventListener('click', resetGame);

/* Kickoff Engine Loop */
startGame();