let currentUser = null;
let cart = [];
let allMenuItems = []; // ������ ��� �������� ����
let recommendedItems = []; // ������ �������� ��� ������� "Recommended"
let recommendedPage = 1; // ���������� ��� ������� ��������

const itemsPerPage = 5;

async function checkAuthentication(retryCount = 0) {
    if (retryCount > 3) {
        console.error("Слишком много неудачных попыток авторизации. Остановка.");
        return;
    }

    const token = localStorage.getItem('authToken');

    if (!token) {
        console.log("Нет токена, пользователь не авторизован.");
        currentUser = null;
        updateAuthUI();
        return;
    }

    try {
        const response = await fetch(`${SERVER_URL}/auth/check`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.status === 429) { // Too Many Requests
            console.warn("Превышен лимит запросов. Повтор через 5 секунд...");
            setTimeout(() => checkAuthentication(retryCount + 1), 5000);
            return;
        }

        if (!response.ok) {
            throw new Error(`Ошибка авторизации: ${response.status}`);
        }

        const user = await response.json();
        console.log("Авторизованный пользователь:", user);

        localStorage.setItem('currentUser', JSON.stringify(user));
        currentUser = user;

        updateAuthUI();
    } catch (error) {
        console.error("Ошибка авторизации:", error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        currentUser = null;
        updateAuthUI();
    }
}



function updateAuthUI() {
    const authLink = document.getElementById('authLink');
    const authLinkText = document.getElementById('authLinkText');
    const logoutButton = document.getElementById('logoutButton');

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
    localStorage.removeItem('currentUser');
    currentUser = null;
    updateAuthUI();
    alert('You have been logged out.');
}
function updateCart() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const confirmOrderButton = document.getElementById('confirmOrderButton');

    if (!cartItems || !cartTotal || !confirmOrderButton) return;

    cartItems.innerHTML = '';
    let total = 0;

    cart.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.classList.add('cart-item');
        cartItem.innerHTML = `
            <div class="cart-item-content">
                <h4>${item.name}</h4>
                <p>$${item.price.toFixed(2)}</p>
            </div>
            <button class="btn btn-secondary remove-from-cart-btn" data-id="${item.id}">Remove</button>
        `;
        cartItems.appendChild(cartItem);
        total += item.price;
    });

    cartTotal.textContent = `$${total.toFixed(2)}`;
    confirmOrderButton.disabled = cart.length === 0;

    document.querySelectorAll('.remove-from-cart-btn').forEach(button => {
        button.addEventListener('click', e => {
            const itemId = parseInt(e.target.dataset.id, 10);
            removeFromCart(itemId);
        });
    });
}

function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    updateCart();
    alert('Item removed from cart.');
}

async function addToCart(itemId) {
    if (!currentUser) {
        alert('Please sign in to add items to your cart.');
        return;
    }

    try {
        const response = await fetch(`http://localhost:8080/menu/${itemId}`);
        if (!response.ok) throw new Error('Failed to fetch item.');

        const item = await response.json();
        if (cart.some(cartItem => cartItem.id === item.id)) {
            alert('Item is already in your cart.');
            return;
        }

        cart.push(item);
        updateCart();
        alert(`${item.name} added to your cart!`);
    } catch (error) {
        console.error('Error adding item to cart:', error);
    }
}
document.getElementById('confirmOrderButton').addEventListener('click', async () => {
    console.log('Confirm Order Button Clicked'); 
    if (!currentUser) {
        alert('Please sign in to place an order.');
        return;
    }

    const name = document.getElementById('customerName').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();

    if (!name || !address || !phone) {
        alert('Please fill in all required fields.');
        return;
    }

    if (cart.length === 0) {
        alert('Your cart is empty. Add items to your cart before checking out.');
        return;
    }

    const orderData = {
        customer: name,
        email: currentUser.email,
        phone: phone,
        address: address,
        total: cart.reduce((sum, item) => sum + item.price, 0),
        food_items: cart.map(item => item.id),
    };

    try {
        console.log('Sending order data:', orderData); 
        const response = await fetch('http://localhost:8080/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
        });

        if (!response.ok) {
            throw new Error('Failed to place order.');
        }

        alert('Order successfully placed!');
        cart = [];
        updateCart();
        document.getElementById('checkoutModal').style.display = 'none';
    } catch (error) {
        console.error('Error placing order:', error);
        alert('Failed to place order.');
    }
});

document.getElementById('checkoutButton').addEventListener('click', () => {
    const checkoutModal = document.getElementById('checkoutModal');
    if (checkoutModal) {
        checkoutModal.style.display = 'block';
    } else {
        console.error('Checkout Modal not found');
    }
});

function paginateRecommended(items, currentPage, limit, totalItems) {
    const recommendedGrid = document.getElementById('recommendedGrid');
    const recommendedPagination = document.getElementById('recommendedPagination');

    if (!recommendedGrid || !recommendedPagination) {
        console.error('Pagination elements not found in DOM');
        return;
    }

    // ������� �����������
    recommendedGrid.innerHTML = '';
    recommendedPagination.innerHTML = '';

    // ��������� ����
    items.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.classList.add('menu-item');
        menuItem.innerHTML = `
            <img src="${item.picture_url}" alt="${item.name}" class="menu-item-image">
            <h4>${item.name}</h4>
            <p>${item.description}</p>
            <p>Category: ${item.category}</p>
            <p>Price: $${item.price.toFixed(2)}</p>
            <button class="btn btn-primary add-to-cart-btn" data-id="${item.id}">Add to Cart</button>
        `;
        recommendedGrid.appendChild(menuItem);
    });

    // ��������� ������ ���������
    const totalPages = Math.ceil(totalItems / limit);
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.classList.add('pagination-button');
        if (i === currentPage) pageButton.classList.add('active');
        pageButton.addEventListener('click', () => {
            recommendedPage = i; // ��������� ������� ��������
            const sortDir = document.querySelector('.sort-button[data-sort].active')?.dataset.sort || 'asc'; // �������� ������� ����������� ����������
            loadRecommendedItems(recommendedPage, itemsPerPage, 'price', sortDir); // ��������� ������
        });
        recommendedPagination.appendChild(pageButton);
    }
}
async function loadMenuSections() {
    try {
        const response = await fetch('http://localhost:8080/menu'); // ������ ������ ���� ��� ������
        if (!response.ok) throw new Error('Failed to fetch menu sections.');

        const data = await response.json();
        populateMenuSections(data); // ��������� ������
    } catch (error) {
        console.error('Error loading menu sections:', error);
    }
}




document.querySelectorAll('.sort-button').forEach(button => {
    button.addEventListener('click', e => {
        // ������� �������� ����� � ���� ������
        document.querySelectorAll('.sort-button').forEach(btn => btn.classList.remove('active'));

        // ��������� �������� ����� ������� ������
        e.target.classList.add('active');

        const sortDir = e.target.dataset.sort;
        console.log(`Sorting direction changed to: ${sortDir}`);
        recommendedPage = 1; // ���������� �� ������ ��������
        loadRecommendedItems(recommendedPage, itemsPerPage, 'price', sortDir);
    });
});







async function fetchMenu(params = {}) {
    try {
        const query = new URLSearchParams(params).toString();
        console.log(`Requesting menu with query: ${query}`);

        const response = await fetch(`http://localhost:8080/items?${query}`);
        if (!response.ok) throw new Error(`Failed to load menu. Status: ${response.status}`);

        const { data, total } = await response.json();
        console.log('Data from server:', { data, total });

        return { items: data || [], total: total || 0 };
    } catch (error) {
        console.error('Error fetching menu:', error);
        return { items: [], total: 0 };
    }
}


async function loadRecommendedItems(
    page = 1,
    limit = 5,
    sort = 'price',
    sortDir = 'asc',
    filter = ''
) {
    console.log(
        `Fetching recommended items for page ${page}, limit ${limit}, sort ${sort}, direction ${sortDir}, filter: ${filter}`
    );

    const { items, total } = await fetchMenu({
        page,
        limit,
        sort,
        sortDir,
        filter,
    });

    if (items.length === 0) {
        console.warn('No recommended items found');
        document.getElementById('recommendedGrid').innerHTML = '<p>No items available</p>';
        return;
    }

    console.log('Recommended items loaded:', items);
    paginateRecommended(items, page, limit, total);
}




document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkAuthentication();
        await loadRecommendedItems('price', 1, 4); // ���������� �� ����, ������ ��������, 5 ���������
        updateCart();
    } catch (error) {
        console.error('Error initializing page:', error);
    }
});




function populateMenuSections(items) {
    const sectionGrids = {
        appetizers: document.getElementById('appetizersGrid'),
        'main-courses': document.getElementById('mainCoursesGrid'),
        desserts: document.getElementById('dessertsGrid'),
        drinks: document.getElementById('drinksGrid'),
    };

    // ������� ���� ������ ����� ����������� ����� ���������
    Object.values(sectionGrids).forEach(grid => {
        if (grid) grid.innerHTML = '';
    });

    // ������������� ��������� �� �������
    items.forEach(item => {
        const section = item.category?.toLowerCase().replace(/\s+/g, '-'); // ����������� ���������
        const sectionGrid = sectionGrids[section]; // ���� ��������������� ������

        if (sectionGrid) {
            const menuItem = document.createElement('div');
            menuItem.classList.add('menu-item');
            menuItem.innerHTML = `
                <img src="${item.picture_url}" alt="${item.name}" class="menu-item-image">
                <h4>${item.name}</h4>
                <p>${item.description}</p>
                <p>Price: $${item.price.toFixed(2)}</p>
                <button class="btn btn-primary add-to-cart-btn" data-id="${item.id}">Add to Cart</button>
            `;
            sectionGrid.appendChild(menuItem);
        } else {
            console.warn(`Unknown category: ${item.category}`);
        }
    });

    // ���������� ������������ ��� ������ "Add to Cart"
    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', e => {
            const itemId = parseInt(e.target.dataset.id, 10);
            addToCart(itemId);
        });
    });
}
document.getElementById('filterByNameInput').addEventListener('input', (e) => {
    const filterValue = e.target.value.trim();
    const sortDir = document.querySelector('.sort-button.active')?.dataset.sort || 'asc';
    recommendedPage = 1; // ���������� �� ������ ��������
    loadRecommendedItems(recommendedPage, itemsPerPage, 'price', sortDir, filterValue);
});


document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkAuthentication();
        await loadRecommendedItems(1, itemsPerPage, 'price', 'asc'); // ��������� "Recommended"
        await loadMenuSections(); // ��������� ������ ��� ������
        updateCart();
    } catch (error) {
        console.error('Error initializing page:', error);
    }
});
    