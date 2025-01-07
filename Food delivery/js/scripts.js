window.addEventListener('DOMContentLoaded', event => {

    // Navbar shrink function
    var navbarShrink = function () {
        const navbarCollapsible = document.body.querySelector('#mainNav');
        if (!navbarCollapsible) {
            return;
        }
        if (window.scrollY === 0) {
            navbarCollapsible.classList.remove('navbar-shrink')
        } else {
            navbarCollapsible.classList.add('navbar-shrink')
        }

    };

    // Shrink the navbar 
    navbarShrink();

    // Shrink the navbar when page is scrolled
    document.addEventListener('scroll', navbarShrink);

    // Activate Bootstrap scrollspy on the main nav element
    const mainNav = document.body.querySelector('#mainNav');
    if (mainNav) {
        new bootstrap.ScrollSpy(document.body, {
            target: '#mainNav',
            rootMargin: '0px 0px -40%',
        });
    };

    // Collapse responsive navbar when toggler is visible
    const navbarToggler = document.body.querySelector('.navbar-toggler');
    const responsiveNavItems = [].slice.call(
        document.querySelectorAll('#navbarResponsive .nav-link')
    );
    responsiveNavItems.map(function (responsiveNavItem) {
        responsiveNavItem.addEventListener('click', () => {
            if (window.getComputedStyle(navbarToggler).display !== 'none') {
                navbarToggler.click();
            }
        });
    });

    // Activate SimpleLightbox plugin for portfolio items
    new SimpleLightbox({
        elements: '#portfolio a.portfolio-box'
    });

});
document.addEventListener('DOMContentLoaded', function() {
    const loadingScreen = document.getElementById('loading-screen');
    const body = document.body;

    window.addEventListener('load', function() {
    setTimeout(function() {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.visibility = 'hidden';
        body.classList.add('loaded');
    }, 1000); 
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const authButton = document.getElementById('authButton');
    const authButtonText = document.getElementById('authButtonText');
    const authModal = document.getElementById('authModal');
    const closeBtn = authModal.querySelector('.close');
    const modalTitle = document.getElementById('modalTitle');
    const authContent = document.getElementById('authContent');
    const signinContent = document.getElementById('signinContent');
    const signupContent = document.getElementById('signupContent');
    const profileContent = document.getElementById('profileContent');
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    const accountSelect = document.getElementById('accountSelect');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');
    const newAccountButton = document.getElementById('newAccountButton');
    const logoutButton = document.getElementById('logoutButton');
    const errorMessages = document.getElementById('errorMessages');
    const tabs = document.querySelectorAll('.tab');

    let currentUser = null;

    function getAccounts() {
        return JSON.parse(localStorage.getItem('accounts')) || [];
    }

    function saveAccounts(accounts) {
        localStorage.setItem('accounts', JSON.stringify(accounts));
    }

    function updateAccountSelect() {
        accountSelect.innerHTML = '';
        const accounts = getAccounts();
        accounts.forEach((account, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${account.email} (${account.phone})`;
            accountSelect.appendChild(option);
        });
    }

    function showProfile(user) {
        currentUser = user;
        authButtonText.textContent = 'Profile';
        modalTitle.textContent = 'Profile';
        authContent.style.display = 'none';
        profileContent.style.display = 'block';
        profileEmail.textContent = user.email;
        profilePhone.textContent = user.phone;
        updateAccountSelect();
        accountSelect.value = getAccounts().findIndex(account => account.email === user.email);
    }

    function showAuth() {
        currentUser = null;
        authButtonText.textContent = 'Login';
        modalTitle.textContent = 'Sign In';
        authContent.style.display = 'block';
        profileContent.style.display = 'none';
        signinContent.style.display = 'block';
        signupContent.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    }

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function validatePhoneNumber(phone) {
        const re = /^\+?[1-9]\d{1,14}$/;
        return re.test(phone);
    }

    authButton.addEventListener('click', () => {
        authModal.style.display = 'block';
        if (currentUser) {
            showProfile(currentUser);
        } else {
            showAuth();
        }
    });

    closeBtn.addEventListener('click', () => {
        authModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === authModal) {
            authModal.style.display = 'none';
        }
    });

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (tab.dataset.tab === 'signin') {
                signinContent.style.display = 'block';
                signupContent.style.display = 'none';
                modalTitle.textContent = 'Sign In';
            } else {
                signinContent.style.display = 'none';
                signupContent.style.display = 'block';
                modalTitle.textContent = 'Sign Up';
            }
        });
    });

    signinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        errorMessages.textContent = '';

        const emailOrPhone = document.getElementById('emailOrPhone').value.trim();
        const password = document.getElementById('password').value;

        if (!emailOrPhone || !password) {
            errorMessages.textContent = 'All fields are required.';
            return;
        }

        const accounts = getAccounts();
        const user = accounts.find(account => 
            (account.email === emailOrPhone || account.phone === emailOrPhone) && 
            account.password === password
        );

        if (user) {
            showProfile(user);
        } else {
            errorMessages.textContent = 'Invalid credentials. Please try again.';
        }
    });

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        errorMessages.textContent = '';

        const email = document.getElementById('signupEmail').value.trim();
        const phone = document.getElementById('signupPhone').value.trim();
        const password = document.getElementById('signupPassword').value;

        if (!email || !phone || !password) {
            errorMessages.textContent = 'All fields are required.';
            return;
        }

        if (!validateEmail(email)) {
            errorMessages.textContent = 'Invalid email format.';
            return;
        }

        if (!validatePhoneNumber(phone)) {
            errorMessages.textContent = 'Invalid phone number format.';
            return;
        }

        if (password.length < 8) {
            errorMessages.textContent = 'Password must be at least 8 characters long.';
            return;
        }

        const accounts = getAccounts();
        if (accounts.some(account => account.email === email || account.phone === phone)) {
            errorMessages.textContent = 'An account with this email or phone number already exists.';
            return;
        }

        const newUser = { email, phone, password };
        accounts.push(newUser);
        saveAccounts(accounts);
        showProfile(newUser);
    });

    accountSelect.addEventListener('change', (e) => {
        const selectedIndex = e.target.value;
        const accounts = getAccounts();
        if (selectedIndex >= 0 && selectedIndex < accounts.length) {
            showProfile(accounts[selectedIndex]);
        }
    });

    newAccountButton.addEventListener('click', showAuth);

    logoutButton.addEventListener('click', () => {
        showAuth();
        authModal.style.display = 'none';
        document.getElementById('emailOrPhone').value = '';
        document.getElementById('password').value = '';
    });

    // Check if user is already logged in
    const accounts = getAccounts();
    if (accounts.length > 0) {
        currentUser = accounts[0];
        authButtonText.textContent = 'Profile';
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const toggleThemeButton = document.getElementById('toggleTheme');

    function setTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            toggleThemeButton.textContent = '☀️';
        } else {
            document.body.classList.remove('dark-theme');
            toggleThemeButton.textContent = '🌙';
        }
        localStorage.setItem('theme', theme);
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    toggleThemeButton.addEventListener('click', function () {
        const currentTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
        setTheme(currentTheme);
    });
  });


const supportChatBtn = document.getElementById('supportChatBtn');
const chatInterface = document.getElementById('chatInterface');
const closeChatBtn = document.getElementById('closeChatBtn');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const chatMessages = document.getElementById('chatMessages');

supportChatBtn.addEventListener('click', () => {
    chatInterface.classList.add('active');
});

closeChatBtn.addEventListener('click', () => {
    chatInterface.classList.remove('active');
});

sendMessageBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        addMessage('user', message);
        messageInput.value = '';
        // Simulate a response (replace with actual chat functionality)
        setTimeout(() => {
            addMessage('support', 'Thank you for your message. We will consider your problem!');
        }, 1000);
    }
}

function addMessage(sender, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    messageElement.textContent = text;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.addEventListener('DOMContentLoaded', function() {
    const faqQuestions = document.querySelectorAll('.faq-question');

    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const isOpen = answer.classList.contains('show');

            // Close all other answers
            document.querySelectorAll('.faq-answer').forEach(item => {
                item.classList.remove('show');
            });
            document.querySelectorAll('.faq-question').forEach(item => {
                item.classList.remove('active');
            });

            // Toggle the clicked answer
            if (!isOpen) {
                answer.classList.add('show');
                question.classList.add('active');
            }
        });
    });
});

document.getElementById("vacancyForm").addEventListener("submit", function(event) {
    const inputs = document.querySelectorAll("#vacancyForm input, #vacancyForm textarea");
    inputs.forEach(function(input) {
        if (!input.checkValidity()) {
        input.classList.add("is-invalid");
        event.preventDefault(); // Останавливаем отправку формы
        } else {
        input.classList.remove("is-invalid");
        }
    });
    });
