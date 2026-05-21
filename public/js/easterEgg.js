const logo = document.getElementById('logo-shake');
let clickCount = 0;

console.log("loaded");

logo.addEventListener('click', () => {
    clickCount++;
    
    logo.classList.remove('shake');
    void logo.offsetWidth; 
    logo.classList.add('shake');

    if (clickCount === 3) {
        window.location.href = '/miniGame'; 
    }
});