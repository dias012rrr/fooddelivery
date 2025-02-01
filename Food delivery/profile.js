var SERVER_URL = 'http://localhost:8080'; 

let currentPage = 1;
const ordersPerPage = 4;



async function checkAuthentication() {
    const token = localStorage.getItem('authToken');

    if (!token) {
        console.warn("⚠️ Нет токена, пользователь не авторизован.");
        currentUser = null;
        updateAuthUI();
        return;
    }

    // ✅ Проверяем, есть ли пользователь в localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        console.log("✅ Используем данные из localStorage:", currentUser);
        updateAuthUI();
        return;
    }

    try {
        const response = await fetch(`${SERVER_URL}/auth/check`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
            throw new Error(`Ошибка авторизации: ${response.status}`);
        }

        const user = await response.json();
        console.log("✅ Авторизованный пользователь:", user);

        if (!user || !user.email) {
            throw new Error('❌ Неверный ответ от сервера');
        }

        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        updateAuthUI();
    } catch (error) {
        console.error("❌ Ошибка авторизации:", error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        currentUser = null;
        updateAuthUI();
    }
}


async function checkAdminRole() {
    if (!currentUser || !currentUser.email) {
        return;
    }

    try {
        const response = await fetch(`${SERVER_URL}/users/by-email?email=${currentUser.email}`);
        if (!response.ok) {
            throw new Error('Failed to check admin role');
        }

        const user = await response.json();
        if (user.role === 'admin') {
            document.getElementById('adminPanel').style.display = 'block';
        }
    } catch (error) {
        console.error("❌ Ошибка проверки роли администратора:", error);
    }
}

async function loadUserProfile() {
    if (!currentUser || !currentUser.email) {
        console.error('❌ No user found or email is missing');
        return;
    }

    try {
        const response = await fetch(`${SERVER_URL}/users/by-email?email=${currentUser.email}`);
        if (!response.ok) {
            throw new Error(`❌ Ошибка запроса профиля: ${response.statusText}`);
        }

        const user = await response.json();
        console.log("✅ Данные пользователя загружены:", user);

        // Найти элементы в DOM
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profilePhone = document.getElementById('profilePhone');

        if (!profileName || !profileEmail || !profilePhone) {
            console.error("❌ Ошибка: Элементы профиля не найдены на странице.");
            return;
        }

        profileName.textContent = `Name: ${user.name}`;
        profileEmail.textContent = `Email: ${user.email}`;
        profilePhone.textContent = `Phone: ${user.phone}`;

        console.log("✅ Профиль успешно обновлён!");

        const orders = await fetchUserOrders(user.id);
        displayOrderHistory(orders);
    } catch (error) {
        console.error('❌ Ошибка загрузки профиля:', error);
    }
}

async function fetchUserOrders(userId) {
    try {
        console.log(`🔍 Загружаем заказы для пользователя ID: ${userId}`);
        const response = await fetch(`${SERVER_URL}/orders/by-user?userId=${userId}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch orders: ${response.statusText}`);
        }

        const orders = await response.json();
        console.log(`✅ Заказы загружены для пользователя ID: ${userId}`, orders);
        return orders;
    } catch (error) {
        console.error('❌ Ошибка загрузки заказов:', error);
        return [];
    }
}

function displayOrderHistory(orders) {
    const orderHistoryContainer = document.getElementById('orderHistoryContainer');
    
    if (!orderHistoryContainer) {
        console.error('❌ Order history container not found.');
        return;
    }

    if (!orders || orders.length === 0) {
        orderHistoryContainer.innerHTML = '<p>No orders found.</p>';
        return;
    }

    orderHistoryContainer.innerHTML = orders.map(order => `
        <div class="order-item">
            <h4>Order #${order.id}</h4>
            <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
            <p><strong>Address:</strong> ${order.address}</p>
            <p><strong>Items:</strong></p>
            <ul>
                ${order.food_items.map(item => `<li>${item.name} - $${item.price.toFixed(2)}</li>`).join('')}
            </ul>
        </div>
    `).join('');
}
function updateAuthUI() {
    const authLink = document.getElementById('authLink');
    const authLinkText = document.getElementById('authLinkText');
    const logoutButton = document.getElementById('logoutButton');

    if (!authLink || !authLinkText || !logoutButton) {
        console.error("❌ Ошибка: Один из элементов UI не найден.");
        return;
    }

    if (currentUser) {
        authLinkText.textContent = 'Profile';
        authLink.href = 'profile.html';
        logoutButton.classList.remove('hidden');
        logoutButton.onclick = handleLogout;
    } else {
        authLinkText.textContent = 'Sign In';
        authLink.href = 'auth.html';
        logoutButton.classList.add('hidden');
    }
}


function handleLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    currentUser = null;
    window.location.href = 'auth.html';
}


if (document.getElementById('supportForm')) {
    document.getElementById('supportForm').onsubmit = async (e) => {
        e.preventDefault();
    
        const formData = new FormData();
        formData.append('email', document.getElementById('supportEmail').value);
        formData.append('message', document.getElementById('supportMessage').value);
        const attachments = document.getElementById('supportAttachment').files;
        for (const file of attachments) {
            formData.append('attachments', file);
        }
    
        try {
            const response = await fetch(`${SERVER_URL}/support`, {
                method: 'POST',
                body: formData,
            });
    
            if (response.ok) {
                document.getElementById('supportStatus').textContent = 'Message sent successfully!';
                document.getElementById('supportForm').reset();
            } else {
                document.getElementById('supportStatus').textContent = 'Failed to send message.';
            }
        } catch (error) {
            console.error('❌ Ошибка отправки сообщения в поддержку:', error);
        }
    };
}
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Страница загружена, проверяем аутентификацию...");
    
    await checkAuthentication();

    if (!currentUser) {
        console.warn("⚠️ Пользователь не найден, редирект на страницу входа");
        return;
    }

    console.log("✅ Пользователь найден, загружаем профиль...");
    await checkAdminRole();
    await loadUserProfile();
});