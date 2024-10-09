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

async function updateDashboard() {
    try {
        const accountInfo = await fetchData('/api/account-info');
        const activeTrade = await fetchData('/api/active-trade');
        const recentTrades = await fetchData('/api/recent-trades');
        const performanceMetrics = await fetchData('/api/performance-metrics');
        
        document.getElementById('account-info-and-metrics').innerHTML = `
            <div class="info-section">
                <h2>Account Info</h2>
                <p>Balance: $${parseFloat(accountInfo.balance).toFixed(2)}</p>
            </div>
            <div class="info-section">
                <h2>Performance Metrics</h2>
                <p>Total Trades: ${performanceMetrics.totalTrades}</p>
                <p>Profitable Trades: ${performanceMetrics.profitableTrades}</p>
                <p>Total Profit: $${performanceMetrics.totalProfit}</p>
                <p>Win Rate: ${performanceMetrics.winRate}%</p>
                <p>Avg Profit %: ${performanceMetrics.avgProfitPercentage}%</p>
            </div>
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
            <table class="recent-trades-table">
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
    } catch (error) {
        console.error('Error updating dashboard:', error);
        if (error.message.includes('No authentication token found')) {
            handleLogout();
        }
    }
}

function startDashboardUpdates() {
    updateDashboard();
    dashboardInterval = setInterval(updateDashboard, 10000);
}

function stopDashboardUpdates() {
    if (dashboardInterval) {
        clearInterval(dashboardInterval);
    }
}

function resetLogoutTimer() {
    if (logoutTimer) {
        clearTimeout(logoutTimer);
    }
    logoutTimer = setTimeout(handleLogout, LOGOUT_TIME);
}

function handleLogout() {
    stopDashboardUpdates();
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

function initializeApp() {
    const token = localStorage.getItem('auth_token');
    if (token && window.location.pathname.endsWith('index.html')) {
        startDashboardUpdates();
        resetLogoutTimer();
        setupActivityListeners();
    } else if (!token && !window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
    }
}

function setupActivityListeners() {
    ['click', 'touchstart', 'mousemove', 'keypress'].forEach(eventType => {
        document.addEventListener(eventType, resetLogoutTimer);
    });
}

async function getMonitoredCoins() {
    try {
        const response = await fetchData('/api/monitored-coins');
        return response.coins.filter(coin => coin.dipCount >= 2 && coin.dipCount <= 3);
    } catch (error) {
        console.error('Error fetching monitored coins:', error);
        return [];
    }
}

async function showHardResetConfirmation() {
    console.log('showHardResetConfirmation called');
    try {
        const monitoredCoins = await getMonitoredCoins();
        console.log('Monitored coins:', monitoredCoins);
        if (monitoredCoins.length > 0) {
            console.log('Redirecting to hard-reset-confirm.html');
            window.location.href = 'hard-reset-confirm.html';
        } else {
            console.log('No monitored coins, showing confirmation dialog');
            if (confirm('No coins with 2 or 3 dips are being monitored. Proceed with hard reset?')) {
                console.log('User confirmed, performing hard reset');
                performHardReset();
            } else {
                console.log('User cancelled hard reset');
            }
        }
    } catch (error) {
        console.error('Error in showHardResetConfirmation:', error);
    }
}

async function performHardReset() {
    console.log('performHardReset called');
    try {
        const response = await fetch(`${API_URL}/api/hard-reset`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });

        console.log('Hard reset response:', response);

        if (!response.ok) {
            throw new Error('Hard reset failed');
        }

        alert('Hard reset performed successfully');
        updateDashboard();  // Refresh the dashboard after reset
    } catch (error) {
        console.error('Hard reset error:', error);
        alert('Hard reset failed. Please try again.');
    }
}

function displayMonitoredCoins(coins) {
    const monitoredCoinsDiv = document.getElementById('monitored-coins');
    if (monitoredCoinsDiv) {
        monitoredCoinsDiv.innerHTML = `
            <h2>Monitored Coins (2-3 dips)</h2>
            <ul>
                ${coins.map(coin => `<li>${coin.symbol}: ${coin.dipCount} dips</li>`).join('')}
            </ul>
        `;
        document.getElementById('confirm-hard-reset').disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded event fired');
    initializeApp();

    const hardResetButton = document.getElementById('hard-reset-button');
    if (hardResetButton) {
        console.log('Hard reset button found, adding event listener');
        hardResetButton.addEventListener('click', showHardResetConfirmation);
    } else {
        console.log('Hard reset button not found');
    }

    const confirmHardResetButton = document.getElementById('confirm-hard-reset');
    if (confirmHardResetButton) {
        const monitoredCoins = await getMonitoredCoins();
        displayMonitoredCoins(monitoredCoins);
        confirmHardResetButton.addEventListener('click', performHardReset);
    }

    const cancelHardResetButton = document.getElementById('cancel-hard-reset');
    if (cancelHardResetButton) {
        cancelHardResetButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

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
        logoutButton.addEventListener('click', handleLogout);
    }
});
