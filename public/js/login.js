function showSignup() {
    document.getElementById('login_container').style.display = 'none';
    document.getElementById('signup_container').style.display = 'flex';
}

function showLogin() {
    document.getElementById('signup_container').style.display = 'none';
    document.getElementById('login_container').style.display = 'flex';
}

document.addEventListener("DOMContentLoaded", () => {
    const popup = document.getElementById('firstTimePopup');
    const closeBtn = document.getElementById('closePopup');

    const loginVisited = localStorage.getItem('loginVisited');

    if (!loginVisited) {
        popup.style.display = 'flex';
    }

    closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        localStorage.setItem('loginVisited', 'true');
    });
});

