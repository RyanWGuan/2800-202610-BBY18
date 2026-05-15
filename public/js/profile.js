document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById('firstTimePopup');
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

function openEditModal(field) {
    const modal = document.getElementById('editModal');
    const targetInput = document.getElementById('modalFieldTarget');
    const inputField = document.getElementById('modalInputValue');
    const hint = document.getElementById('modalHint');

    targetInput.value = field; 

    document.getElementById('modalTitle').innerText = `Change your ${field}`;
    document.getElementById('fieldLabel').innerText = field;
    document.getElementById('inputLabel').innerText = field;

    const isPassword = (field === 'password');
    inputField.type = isPassword ? 'password' : 'text';
    inputField.placeholder = isPassword ? 'Enter new password' : '';
    
    hint.style.display = (field === 'username') ? 'block' : 'none';

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}