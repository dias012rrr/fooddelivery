
const SERVER_URL = 'http://localhost:8080';

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authTabs = document.querySelectorAll('.auth-tab');

authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        loginForm.classList.toggle('hidden', tabName !== 'login');
        registerForm.classList.toggle('hidden', tabName !== 'register');
    });
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${SERVER_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
            const user = await response.json();
            localStorage.setItem('currentUser', JSON.stringify(user)); 
            alert('Login successful');
            window.location.href = 'index.html'; 
        } else {
            const error = await response.json();
            alert(`Login failed: ${error.message}`);
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('An error occurred while logging in');
    }
});


registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const response = await fetch(`${SERVER_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password }),
        });

        if (response.ok) {
            alert('Registration successful');
            window.location.href = 'auth.html'; 
        } else {
            const error = await response.json();
            alert(`Registration failed: ${error.message}`);
        }
    } catch (error) {
        console.error('Error during registration:', error);
        alert('An error occurred while registering');
    }
});
