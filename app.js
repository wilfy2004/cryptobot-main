const API_URL = 'https://nodered.wilfy2004.synology.me';

async function fetchData(endpoint) {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            // Redirect to login page or show login modal
            window.location.href = 'login.html'; // Adjust this to your login page
        }
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
}

async function updateDashboard() {
    try {
        const accountInfo = await fetchData('/api/account-info');
        const activeTrade = await fetchData('/api/active-trade');
        const recentTrades = await fetchData('/api/recent-trades');

        document.getElementById('account-info').innerHTML = `
            <h2>Account Info</h2>
            <p>Balance: $${accountInfo.balance}</p>
        `;

        document.getElementById('active-trade').innerHTML = activeTrade
            ? `
                <h2>Active Trade</h2>
                <p>Symbol: ${activeTrade.symbol}</p>
                <p>Entry Price: $${activeTrade.entryPrice}</p>
                <p>Current Price: $${activeTrade.currentPrice}</p>
              `
            : '<h2>No Active Trade</h2>';

        document.getElementById('recent-trades').innerHTML = `
            <h2>Recent Trades</h2>
            <ul>
                ${recentTrades.map(trade => `
                    <li>${trade.symbol}: ${trade.action} at $${trade.price}</li>
                `).join('')}
            </ul>
        `;
    } catch (error) {
        console.error('Error updating dashboard:', error);
        if (error.message.includes('No authentication token found')) {
            window.location.href = 'login.html'; // Redirect to login page
        }
    }
}

// Update dashboard every 10 seconds
setInterval(updateDashboard, 10000);

// Initial update
updateDashboard();

// Add these functions for login and logout
async function login(username, password) {
    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const data = await response.json();
        localStorage.setItem('auth_token', data.token);
        window.location.href = 'index.html'; // Redirect to main page after login
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    window.location.href = 'login.html';
}

// Add event listeners for login and logout buttons if they exist
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            login(username, password);
        });
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
});
