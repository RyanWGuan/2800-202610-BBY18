/* DOM Element References */
const bowl = document.getElementById('bowl');
const gameContainer = document.getElementById('game-container');
const scoreDisplay = document.getElementById('score-display');
const timeDisplay = document.getElementById('time-display');

/* Game State Tracking */
let score = 0;
/* Holds the seconds remaining for the round */
let timeLeft = 30; 
/* Holds the background loop interval for the 30-second countdown timer */
let gameInterval;  
/* Holds the background loop interval for generating objects */
let spawnInterval; 

/* Physics Tuning Values */
/* Number of pixels an object moves downward during every animation frame */
const fallingSpeed = 8; 
/* Spawn timing for falling elements in milliseconds */
const spawnRate = 1500; 

/* Game Asset Paths */
const itemImages = [
    './images/apple.png',
    './images/blueberry.png',
    './images/chicken.png',
    './images/corn.png',
    './images/e.png',
    './images/grape.png',
    './images/ham.png',
    './images/steak.png',
    './images/strawberry.png',
    './images/tomato.png'
];

/* Drag and Drop Calculation Points */
let isDragging = false;
/* Initial horizontal target click point relative to the container tracking anchor */
let startX = 0;
/* Current pixel shift value from the middle point for the paddle element */
let currentX = 0; 

/* Controls the physics engine pause status tracking */
let isPaused = false;

/* Toggles game state suspension, freezing loops or spinning them up again */
function togglePause() {
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

/* Hard reset function that drops parameters, flushes the field, and restarts execution */
function resetGame() {
    clearInterval(gameInterval);
    clearInterval(spawnInterval);

    /* Safely target and clean remaining active objects out of the view frame */
    document.querySelectorAll('.falling-item').forEach(item => item.remove());

    isPaused = false;
    currentX = 0;
    bowl.style.transform = `translateX(0px)`;

    startGame();
}

/* Preps anchor measurements when click/touch actions land on the interaction paddle */
function startDrag(event) {
    if (isPaused) return;
    isDragging = true;
    /* Normalizes positions across mobile screen touches or desktop tracking points */
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    startX = clientX - currentX;
}

/* Moves the paddle along the horizontal tracking path when dragging conditions are met */
function onDrag(event) {
    if (!isDragging) return;
    if (isPaused) return;
    
    /* Halt traditional touch scrolling mechanics across mobile devices */
    event.preventDefault(); 
    
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    currentX = clientX - startX;

    /* Left and right screen edge clipping safeguards */
    const maxBoundary = window.innerWidth / 2 - 50; 
    if (currentX < -maxBoundary) currentX = -maxBoundary;
    if (currentX > maxBoundary) currentX = maxBoundary;

    bowl.style.transform = `translateX(${currentX}px)`;
}

/* Drops execution states for structural calculation tracking when user drops action hooks */
function stopDrag() { 
    isDragging = false; 
}

/* Desktop Mouse Event Wire-ups */
bowl.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', onDrag);
window.addEventListener('mouseup', stopDrag);

/* Mobile Touch Event Wire-ups */
bowl.addEventListener('touchstart', startDrag);
/* Ensure tracking works cleanly across browser view layer engines */
bowl.addEventListener('touchmove', onDrag, { passive: false });
window.addEventListener('touchend', stopDrag);

/* Dynamic Element Factory for Spawning and Processing Game Objects */
function createFallingItem() {
    const item = document.createElement('img');
    /* Select a target graphic component reference at random */
    const randomImg = itemImages[Math.floor(Math.random() * itemImages.length)];
    
    item.src = randomImg;
    item.classList.add('falling-item');
    item.style.position = 'absolute';
    item.style.width = '60px'; 
    /* Stage element just off-screen above the gameplay field */
    item.style.top = '-60px';  
    
    /* Distribute horizontal spawning point targets across modern screen formats */
    const randomX = Math.random() * (window.innerWidth - 60);
    item.style.left = `${randomX}px`;
    
    gameContainer.appendChild(item);
    
    /* Individual Element Frame-by-Frame Fall Animation Loop */
    function fall() {
        /* Suspend movement actions safely when global freeze rules take priority */
        if (isPaused) {
            requestAnimationFrame(fall);
            return;
        }

        let currentTop = parseFloat(item.style.top);
        currentTop += fallingSpeed;
        item.style.top = `${currentTop}px`;
        
        /* Match detection parameters against current layout bounds coordinates */
        if (checkCollision(item, bowl)) {
            score++;
            scoreDisplay.innerText = score; 
            item.remove();                  
            return;                         
        }
        
        /* Safe garbage-collection flush logic for items slipping past player reach */
        if (currentTop > window.innerHeight) {
            item.remove(); 
            return;        
        }
        
        requestAnimationFrame(fall);
    }
    
    requestAnimationFrame(fall);
}

/* Axis-Aligned Bounding Box Intersection Detection Calculations */
function checkCollision(item, bowl) {
    const itemRect = item.getBoundingClientRect();
    const bowlRect = bowl.getBoundingClientRect();
    
    /* Verify intersection parameters directly across 2D plane geometry tracking */
    return !(
        itemRect.top > bowlRect.bottom ||
        itemRect.bottom < bowlRect.top ||
        itemRect.right < bowlRect.left ||
        itemRect.left > bowlRect.right
    );
}

/* Active Level Timing Counter Framework */
function startGameTimer() {
    gameInterval = setInterval(() => {
        timeLeft--;
        timeDisplay.innerText = timeLeft; 

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

/* Terminal Game-Over Process Block */
function endGame() {
    clearInterval(gameInterval);
    clearInterval(spawnInterval); 
    
    document.querySelectorAll('.falling-item').forEach(item => item.remove());
    
    alert(`Game Over! You caught ${score} items!`);
}

/* Initialization Routine Setup */
function startGame() {
    score = 0;
    timeLeft = 30;
    scoreDisplay.innerText = score;
    timeDisplay.innerText = timeLeft;
    
    startGameTimer();
    spawnInterval = setInterval(createFallingItem, spawnRate);
}

/* Interface Menu Action Binding Registrations */
document.getElementById('pause-button-id').addEventListener('click', togglePause);
document.getElementById('reset-button-id').addEventListener('click', resetGame);

/* Start Game */
startGame();