// --- First-Time Visitor Popup Logic ---
// Waits for the HTML document to fully load before running the script
document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById('firstTimePopup');
    const closeBtn = document.getElementById('closePopup');

    // Check localStorage to see if the user has been to this profile page before
    const hasVisitedProfile = localStorage.getItem('hasVisitedProfile');

    // If the flag doesn't exist in localStorage, it's their first time, so show the popup
    if (!hasVisitedProfile){
        popup.style.display = 'flex';
    }

    // When the user closes the popup, hide it and save the flag so it won't show next time
    closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        localStorage.setItem('hasVisitedProfile', 'true');
    });
});

// --- Dynamic Profile Editing Modal ---
/**
 * Opens a modal to edit a specific profile field (e.g., username, email, password)
 * @param {string} field - The name of the profile field being updated
 */
function openEditModal(field) {
    const modal = document.getElementById('editModal');
    const targetInput = document.getElementById('modalFieldTarget');
    const inputField = document.getElementById('modalInputValue');
    const hint = document.getElementById('modalHint');

    // Keep track of which field is being edited by storing it in a hidden input value
    targetInput.value = field; 

    // Update the modal text dynamically to match the selected field
    document.getElementById('modalTitle').innerText = `Change your ${field}`;
    document.getElementById('fieldLabel').innerText = field;
    document.getElementById('inputLabel').innerText = field;

    // Configure the input type and placeholder based on whether it's a password field
    const isPassword = (field === 'password');
    inputField.type = isPassword ? 'password' : 'text';
    inputField.placeholder = isPassword ? 'Enter new password' : `Enter new ${field}`;
    
    // Only show the formatting hint if the user is changing their username
    hint.style.display = (field === 'username') ? 'block' : 'none';

    // Make the modal visible using flexbox centering
    modal.style.display = 'flex';
}

/**
 * Closes the profile edit modal
 */
function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}