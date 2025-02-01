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

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
        const response = await fetch(`${SERVER_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        console.log("Ответ сервера при логине:", response.status, data);

        if (response.ok) {
            // **Сохраняем токен и пользователя**
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('currentUser', JSON.stringify(data));

            alert('Login successful');
            window.location.href = 'index.html'; 
        } else if (response.status === 403) {
            alert('Ваш email не подтвержден! Проверьте почту.');
        } else {
            alert(`Login failed: ${data.message || 'Invalid credentials'}`);
        }
    } catch (error) {
        console.error('Ошибка при логине:', error);
        alert('Ошибка при логине');
    }
});


registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();

    console.log("Отправка регистрации с:", { name, email, phone, password });

    if (!email || !name) {
        alert("Email и имя не могут быть пустыми.");
        return;
    }

    if (password !== confirmPassword) {
        alert('Пароли не совпадают');
        return;
    }

    try {
        const response = await fetch(`${SERVER_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password }),
        });

        const textResponse = await response.text();
        console.log("Ответ сервера (text):", textResponse);

        if (!textResponse.trim()) {
            console.error("Ошибка: сервер вернул пустой ответ");
            alert("Ошибка регистрации: сервер не отвечает.");
            return;
        }

        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (jsonError) {
            console.error("Ошибка парсинга JSON:", jsonError);
            alert("Ошибка регистрации: сервер вернул некорректный ответ.");
            return;
        }

        console.log("Ответ сервера (JSON):", data);

        if (response.ok) {
            alert('Регистрация успешна. Проверьте email.');
            window.location.href = 'auth.html';
        } else {
            alert(`Ошибка регистрации: ${data.error || 'Неизвестная ошибка'}`);
        }
    } catch (error) {
        console.error('Ошибка при регистрации:', error);
        alert('Ошибка при регистрации');
    }
});

