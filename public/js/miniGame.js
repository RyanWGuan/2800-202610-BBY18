const bowl = document.getElementById('bowl');
const gameContainer = document.getElementById('game-container');
const scoreDisplay = document.getElementById('score-display');
const timeDisplay = document.getElementById('time-display');

let score = 0;
let timeLeft = 30; 
let gameInterval;  
let spawnInterval; 

const fallingSpeed = 8; 
const spawnRate = 1500; 

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

let isDragging = false;
let startX = 0;
let currentX = 0; 

let isPaused = false;

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

function resetGame() {
    clearInterval(gameInterval);
    clearInterval(spawnInterval);

    document.querySelectorAll('.falling-item').forEach(item => item.remove());

    isPaused = false;
    currentX = 0;
    bowl.style.transform = `translateX(0px)`;

    startGame();
}

function startDrag(event) {
    if (isPaused) return;
    isDragging = true;
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    startX = clientX - currentX;
}

function onDrag(event) {
    if (!isDragging) return;
    if (isPaused) return;
    
    event.preventDefault(); 
    
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    currentX = clientX - startX;

    const maxBoundary = window.innerWidth / 2 - 50; 
    if (currentX < -maxBoundary) currentX = -maxBoundary;
    if (currentX > maxBoundary) currentX = maxBoundary;

    bowl.style.transform = `translateX(${currentX}px)`;
}

function stopDrag() { 
    isDragging = false; 
}

bowl.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', onDrag);
window.addEventListener('mouseup', stopDrag);

bowl.addEventListener('touchstart', startDrag);
window.addEventListener('touchmove', onDrag, { passive: false });
window.addEventListener('touchend', stopDrag);

function createFallingItem() {
    const item = document.createElement('img');
    const randomImg = itemImages[Math.floor(Math.random() * itemImages.length)];
    
    item.src = randomImg;
    item.classList.add('falling-item');
    item.style.position = 'absolute';
    item.style.width = '60px'; 
    item.style.top = '-60px';  
    
    const randomX = Math.random() * (window.innerWidth - 60);
    item.style.left = `${randomX}px`;
    
    gameContainer.appendChild(item);
    
    function fall() {
        if (isPaused) {
            requestAnimationFrame(fall);
            return;
        }


        let currentTop = parseFloat(item.style.top);
        currentTop += fallingSpeed;
        item.style.top = `${currentTop}px`;
        
        if (checkCollision(item, bowl)) {
            score++;
            scoreDisplay.innerText = score; 
            item.remove();                  
            return;                         
        }
        
        if (currentTop > window.innerHeight) {
            item.remove(); 
            return;        
        }
        
        requestAnimationFrame(fall);
    }
    
    requestAnimationFrame(fall);
}

function checkCollision(item, bowl) {
    const itemRect = item.getBoundingClientRect();
    const bowlRect = bowl.getBoundingClientRect();
    
    return !(
        itemRect.top > bowlRect.bottom ||
        itemRect.bottom < bowlRect.top ||
        itemRect.right < bowlRect.left ||
        itemRect.left > bowlRect.right
    );
}

function startGameTimer() {
    gameInterval = setInterval(() => {
        timeLeft--;
        timeDisplay.innerText = timeLeft; 

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function endGame() {
    clearInterval(gameInterval);
    clearInterval(spawnInterval); 
    
    document.querySelectorAll('.falling-item').forEach(item => item.remove());
    
    alert(`Game Over! You caught ${score} items!`);
}

function startGame() {
    score = 0;
    timeLeft = 30;
    scoreDisplay.innerText = score;
    timeDisplay.innerText = timeLeft;
    
    startGameTimer();
    spawnInterval = setInterval(createFallingItem, spawnRate);
}

document.getElementById('pause-button-id').addEventListener('click', togglePause);
document.getElementById('reset-button-id').addEventListener('click', resetGame);

startGame();