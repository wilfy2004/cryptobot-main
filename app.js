const API_URL = 'https://nodered.wilfy2004.synology.me';
let dashboardInterval;
let logoutTimer;
const LOGOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

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
            handleLogout();
        }
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
}

function resetLogoutTimer() {
    if (logoutTimer) {
        clearTimeout(logoutTimer);
    }
    logoutTimer = setTimeout(handleLogout, LOGOUT_TIME);
}

function handleLogout() {
    clearTimeout(logoutTimer);
    localStorage.removeItem('auth_token');
    window.location.href = 'login.html';
}

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
        resetLogoutTimer();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

async function loadRecentTrades() {
    try {
        const recentTrades = await fetchData('/api/recent-trades');
        const tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Buy Time</th>
                        <th>Buy Price</th>
                        <th>Sell Price</th>
                        <th>Quantity</th>
                        <th>Profit</th>
                        <th>Profit %</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentTrades.map(trade => `
                        <tr>
                            <td>${trade.symbol}</td>
                            <td>${trade.buyTime}</td>
                            <td>$${trade.buyPrice}</td>
                            <td>${trade.sellPrice === 'Not sold' ? trade.sellPrice : '$' + trade.sellPrice}</td>
                            <td>${trade.quantity}</td>
                            <td>${trade.profit === 'N/A' ? trade.profit : '$' + trade.profit}</td>
                            <td>${trade.profitPercentage}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        document.getElementById('recent-trades-table').innerHTML = tableHtml;
    } catch (error) {
        console.error('Error loading recent trades:', error);
        document.getElementById('recent-trades-table').innerHTML = '<p>Error loading recent trades. Please try again.</p>';
    }
}

async function loadMonitoredCoins() {
    try {
        const monitoredCoins = await fetchData('/api/monitored-coins');
        const tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Dip Count</th>
                    </tr>
                </thead>
                <tbody>
                    ${monitoredCoins.coins.map(coin => `
                        <tr>
                            <td>${coin.symbol}</td>
                            <td>${coin.dipCount}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        document.getElementById('monitored-coins-table').innerHTML = tableHtml;
    } catch (error) {
        console.error('Error loading monitored coins:', error);
        document.getElementById('monitored-coins-table').innerHTML = '<p>Error loading monitored coins. Please try again.</p>';
    }
}

function loadHardResetInfo() {
    const resetVariables = [
        'monitoringCoins',
        'dippedCoins',
        'lastDipTime',
        'trailingStops',
        'activeTradeSymbol',
        'positions'
    ];
    const resetInfoHtml = `
        <h2>The following variables will be reset:</h2>
        <ul>
            ${resetVariables.map(variable => `<li>${variable}</li>`).join('')}
        </ul>
        <p>Are you sure you want to proceed with the hard reset?</p>
    `;
    document.getElementById('reset-variables').innerHTML = resetInfoHtml;
}

async function performHardReset() {
    try {
        const response = await fetch(`${API_URL}/api/hard-reset`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        if (!response.ok) {
            throw new Error(`Hard reset failed with status: ${response.status}`);
        }

        const responseData = await response.json();
        alert('Hard reset performed successfully');
        window.location.href = 'index.html';  // Redirect to main page after reset
    } catch (error) {
        console.error('Hard reset error:', error);
        alert(`Hard reset failed. Error: ${error.message}`);
    }
}

function setupActivityListeners() {
    ['click', 'touchstart', 'mousemove', 'keypress'].forEach(eventType => {
        document.addEventListener(eventType, resetLogoutTimer);
    });
}

function initializeApp() {
    const currentPage = window.location.pathname.split('/').pop();

    // Special handling for login page
    if (currentPage === 'login.html') {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                login(username, password);
            });
        }
        return; // Exit the function early for login page
    }

    // For all other pages, check authentication
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    resetLogoutTimer();
    setupActivityListeners();

    switch (currentPage) {
        case 'index.html':
        case '':  // Handle case when accessed via directory without filename
            setupMainPageListeners();
            break;
        case 'recent-trades.html':
            loadRecentTrades();
            break;
        case 'monitored-coins.html':
            loadMonitoredCoins();
            break;
        case 'hard-reset.html':
            loadHardResetInfo();
            setupHardResetListeners();
            break;
    }

    // Set up back button listeners for all pages except index
    if (currentPage !== 'index.html' && currentPage !== '') {
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
    }

    // Set up logout button listener for all pages
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
}

function setupMainPageListeners() {
    document.getElementById('recent-trades-button').addEventListener('click', () => {
        window.location.href = 'recent-trades.html';
    });

    document.getElementById('monitored-coins-button').addEventListener('click', () => {
        window.location.href = 'monitored-coins.html';
    });

    document.getElementById('hard-reset-button').addEventListener('click', () => {
        window.location.href = 'hard-reset.html';
    });
}

function setupHardResetListeners() {
    const confirmHardResetButton = document.getElementById('confirm-hard-reset');
    if (confirmHardResetButton) {
        confirmHardResetButton.addEventListener('click', performHardReset);
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);
