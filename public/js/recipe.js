// Open/close filter
function toggleDropdown() {
    document.getElementById('filterBtn').classList.toggle('open');
    document.getElementById('dropdown').classList.toggle('open');
}

// 
function togglePriceField() {
    const on = document.getElementById('priceToggle').checked;
    document.getElementById('priceRow').style.display = on ? 'flex' : 'none';
    applyFilters();
}

// Main filter function
function applyFilters() {
 

}
 

