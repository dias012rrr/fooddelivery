const SERVER_URL = 'http://localhost:8080'; 
let currentPage = 1;
const ordersPerPage = 4; 


document.addEventListener('DOMContentLoaded', async () => {
    console.log('Current user:', currentUser);

    await checkAuthentication();
    if (currentUser) {
        await loadUserProfile();
    }
});


async function checkAuthentication() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        console.log('Current user:', currentUser);
    } else {
        console.error('User not authenticated');
    }
}



function displayOrderHistory(orders) {
    const orderHistoryContainer = document.getElementById('orderHistoryContainer');
    const currentPageLabel = document.getElementById('currentPageLabel');
    const prevPageButton = document.getElementById('prevPageButton');
    const nextPageButton = document.getElementById('nextPageButton');

    if (!orderHistoryContainer) {
        console.error('Order history container not found.');
        return;
    }

    if (!orders || orders.length === 0) {
        orderHistoryContainer.innerHTML = '<p>No orders found.</p>';
        return;
    }

    const totalPages = Math.ceil(orders.length / ordersPerPage);
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;

    orderHistoryContainer.innerHTML = '';
    const currentOrders = orders.slice(startIndex, endIndex);

    currentOrders.forEach(order => {
        const orderItem = document.createElement('div');
        orderItem.classList.add('order-item');
        orderItem.innerHTML = `
            <h4>Order #${order.id}</h4>
            <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
            <p><strong>Address:</strong> ${order.address}</p>
            <p><strong>Items:</strong></p>
            <ul>
                ${order.food_items.map(item => `<li>${item.name} - $${item.price.toFixed(2)}</li>`).join('')}
            </ul>
        `;
        orderHistoryContainer.appendChild(orderItem);
    });

    currentPageLabel.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageButton.disabled = currentPage === 1;
    nextPageButton.disabled = currentPage === totalPages;

    prevPageButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayOrderHistory(orders);
        }
    };

    nextPageButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayOrderHistory(orders);
        }
    };
}


async function loadUserProfile() {
    if (!currentUser) {
        console.error('No user found');
        return;
    }

    try {
        const response = await fetch(`${SERVER_URL}/users/by-email?email=${currentUser.email}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch user profile: ${response.statusText}`);
        }

        const user = await response.json();

        document.getElementById('profileName').textContent = `Name: ${user.name}`;
        document.getElementById('profileEmail').textContent = `Email: ${user.email}`;
        document.getElementById('profilePhone').textContent = `Phone: ${user.phone}`;

        const orders = await fetchUserOrders(currentUser.id);
        console.log('Orders:', orders); 
        displayOrderHistory(orders);
    } catch (error) {
        console.error('Failed to load user profile:', error);
    }
}
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
        const response = await fetch('http://localhost:8080/support', {
            method: 'POST',
            body: formData,
        });
        const statusDiv = document.getElementById('supportStatus');
        if (response.ok) {
            statusDiv.textContent = 'Message sent successfully!';
            console.log('Support message sent successfully.');

  
            document.getElementById('supportForm').reset();
        } else {
            statusDiv.textContent = 'Failed to send message. Try again.';
            console.log('Failed to send support message. Response status:', response.status);
        }
    } catch (err) {
        console.error('Error while sending support message:', err);
        document.getElementById('supportStatus').textContent = 'Failed to send message.';
    }
};




async function fetchUserOrders(userId) {
    try {
   
        console.log(`Attempting to fetch orders for user ID: ${userId}`);
        const response = await fetch(`${SERVER_URL}/orders/by-user?userId=${userId}`);
        
     
        if (!response.ok) {
            throw new Error(`Failed to fetch orders: ${response.statusText}`);
        }

    
        const orders = await response.json();
        console.log(`Orders fetched successfully for user ID: ${userId}`, orders);
        return orders;
    } catch (error) {
        console.error('Error fetching user orders:', error);
        console.warn(
            `Failed to retrieve orders for user ID: ${userId}. 
            This might be caused by:
            - Incorrect API endpoint.
            - Server not running.
            - No orders associated with the user.`
        );

        return [];
    }
}


