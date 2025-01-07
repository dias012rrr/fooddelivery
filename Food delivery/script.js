
let currentUser = null;
let cart = [];
let recommendedItems = [];
let filteredRecommendedItems = [];
let recommendedPage = 1;
const itemsPerPage = 5;
async function checkAuthentication() {
    const storedUser = localStorage.getItem('currentUser');
    currentUser = storedUser ? JSON.parse(storedUser) : null;
    updateAuthUI();
}
document.querySelectorAll('.sort-button').forEach(button => {
    button.addEventListener('click', e => {
        const sortType = e.target.dataset.sort;
        if (sortType === 'asc') {
            filteredRecommendedItems.sort((a, b) => a.price - b.price);
        } else if (sortType === 'desc') {
            filteredRecommendedItems.sort((a, b) => b.price - a.price);
        }
        recommendedPage = 1;
        paginateRecommended(filteredRecommendedItems);
    });
});
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

function paginateRecommended(items) {
    const recommendedGrid = document.getElementById('recommendedGrid');
    const recommendedPagination = document.getElementById('recommendedPagination');

    if (!recommendedGrid || !recommendedPagination) return;

    recommendedGrid.innerHTML = '';
    recommendedPagination.innerHTML = '';

    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = (recommendedPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    items.slice(startIndex, endIndex).forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.classList.add('menu-item');
        menuItem.innerHTML = `
            <img src="${item.picture_url}" alt="${item.name}" class="menu-item-image">
            <h4>${item.name}</h4>
            <p>${item.description}</p>
            <p>Price: $${item.price.toFixed(2)}</p>
            <button class="btn btn-primary add-to-cart-btn" data-id="${item.id}">Add to Cart</button>
        `;
        recommendedGrid.appendChild(menuItem);
    });

    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        button.addEventListener('click', e => {
            const itemId = parseInt(e.target.dataset.id, 10);
            addToCart(itemId);
        });
    });

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.classList.add('pagination-button');
        if (i === recommendedPage) pageButton.classList.add('active');
        pageButton.addEventListener('click', () => {
            recommendedPage = i;
            paginateRecommended(items);
        });
        recommendedPagination.appendChild(pageButton);
    }
}

async function fetchMenu() {
    try {
        const response = await fetch('http://localhost:8080/menu');
        if (!response.ok) throw new Error('Failed to load menu.');
        const menuItems = await response.json();
        populateMenuSections(menuItems);
    } catch (error) {
        console.error('Error fetching menu:', error);
    }
}

function populateMenuSections(menuItems) {
    const sectionGrids = {
        appetizers: document.getElementById('appetizersGrid'),
        'main-courses': document.getElementById('mainCoursesGrid'),
        desserts: document.getElementById('dessertsGrid'),
        drinks: document.getElementById('drinksGrid'),
    };

    Object.values(sectionGrids).forEach(grid => grid && (grid.innerHTML = ''));

    recommendedItems = [];
    menuItems.forEach(item => {
        recommendedItems.push(item);

        const section = item.category?.toLowerCase().replace(' ', '-');
        if (sectionGrids[section]) {
            const menuItem = document.createElement('div');
            menuItem.classList.add('menu-item');
            menuItem.innerHTML = `
                <img src="${item.picture_url}" alt="${item.name}" class="menu-item-image">
                <h4>${item.name}</h4>
                <p>${item.description}</p>
                <p>Price: $${item.price.toFixed(2)}</p>
                <button class="btn btn-primary add-to-cart-btn" data-id="${item.id}">Add to Cart</button>
            `;
            sectionGrids[section].appendChild(menuItem);
        }
    });

    filteredRecommendedItems = [...recommendedItems];
    paginateRecommended(filteredRecommendedItems);
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthentication();
    await fetchMenu();
    updateCart();

    const confirmOrderButton = document.getElementById('confirmOrderButton');
    if (!confirmOrderButton) {
        console.error('Confirm Order Button not found in DOM');
    }
});

