// Open/close filter
function toggleDropdown() {
    document.getElementById('filterBtn').classList.toggle('open');
    document.getElementById('dropdown').classList.toggle('open');
}

// Show price field when toggled
function togglePriceField() {
    const on = document.getElementById('priceToggle').checked;
    document.getElementById('priceRow').style.display = on ? 'flex' : 'none';
    applyFilters();
}

// Main filter function
function applyFilters() {
 

}

// popup challenge
document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById('firstTimePopupRecipe');
    const closeBtn = document.getElementById('closePopup');

    const hasVisited = localStorage.getItem('hasVisited');

    if (!hasVisited){
        popup.style.display = 'flex';
    }

    closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        localStorage.setItem('hasVisited', 'true');
    });
});
 

