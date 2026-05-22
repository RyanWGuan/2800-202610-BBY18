/* Target element reference for the interactive logo component */
const logo = document.getElementById('logo-shake');
/* Track consecutive interactions to trigger the secret action route */
let clickCount = 0;

/* Debug anchor check to ensure script execution has finished initial parsing */
console.log("loaded");

/* Interaction listener loop waiting for users to click or tap on the logo element */
logo.addEventListener('click', () => {
    clickCount++;
    
    /* Remove the class first so the animation engine resets cleanly on repeat clicks */
    logo.classList.remove('shake');
    /* CSS Reflow Trigger: Reading offsetWidth forces the browser to instantly recalculate layout styles */
    void logo.offsetWidth; 
    /* Apply the animation class back to kick off the shaking visual sequence again */
    logo.classList.add('shake');

    /* Easter egg verification threshold check */
    if (clickCount === 3) {
        /* Route the user's active session window directly over to the hidden mini-game subpage */
        window.location.href = '/miniGame'; 
    }
});