// Global constants and variables
const API_URL = 'https://nodered.wilfy2004.synology.me';
let dashboardInterval;
let logoutTimer;
const LOGOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds
const isGitHubPages = window.location.hostname.includes('github.io');

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

// Trade timing control functions
async function updateTradeTiming(minutes) {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/api/trade/timing/update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parameter: 'trailingStopDuration',
                adjustment: minutes * 60 * 1000 // Convert minutes to milliseconds
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update trade timing');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error updating trade timing:', error);
        throw error;
    }
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
// Add these functions to your existing app.js

// Manual sell API call function
async function executeManualSell() {
    if (!confirm('Are you sure you want to immediately sell the current position?')) {
        return;
    }

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/api/execute-sell`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to execute sell order');
        }

        const result = await response.json();
        alert('Manual sell order executed successfully');
        updateDashboard(); // Refresh the dashboard
    } catch (error) {
        console.error('Error executing manual sell:', error);
        alert(`Failed to execute manual sell: ${error.message}`);
    }
}

// Update the activeTrade template in the updateDashboard function

async function updateDashboard() {
    try {
        const accountInfo = await fetchData('/api/account-info');
        const activeTrade = await fetchData('/api/active-trade');
        const performanceMetrics = await fetchData('/api/performance-metrics');
        
        document.getElementById('account-info').innerHTML = `
            <h2>Account Info</h2>
            <p>Balance: $${parseFloat(accountInfo.balance).toFixed(2)}</p>
        `;
        
        document.getElementById('performance-metrics').innerHTML = `
            <h2>Performance Metrics</h2>
            <p>Total Trades: ${performanceMetrics.totalTrades}</p>
            <p>Profitable Trades: ${performanceMetrics.profitableTrades}</p>
            <p>Total Profit: $${performanceMetrics.totalProfit}</p>
            <p>Win Rate: ${performanceMetrics.winRate}%</p>
            <p>Avg Profit %: ${performanceMetrics.avgProfitPercentage}%</p>
        `;
        
        // Updated active trade template with both extend time and sell buttons
        const activeTradeHtml = activeTrade
            ? `
                <div class="active-trade-card">
                    <h2>Active Trade</h2>
                    <div class="trade-details">
                        <p><strong>Symbol:</strong> ${activeTrade.symbol}</p>
                        <p><strong>Entry Price:</strong> $${parseFloat(activeTrade.entryPrice).toFixed(8)}</p>
                        <p><strong>Current Price:</strong> $${parseFloat(activeTrade.currentPrice).toFixed(8)}</p>
                        <p><strong>Quantity:</strong> ${activeTrade.quantity}</p>
                        <p class="profit-loss ${(activeTrade.currentPrice - activeTrade.entryPrice) >= 0 ? 'profit' : 'loss'}">
                            <strong>Current P/L:</strong> ${((activeTrade.currentPrice - activeTrade.entryPrice) / activeTrade.entryPrice * 100).toFixed(2)}%
                        </p>
                    </div>
                    <div class="trade-controls">
                        <div class="control-buttons">
                            <button onclick="handleExtendTime(120)" class="action-button extend-time">
                                +2 Hours
                            </button>
                            <button onclick="executeManualSell()" class="action-button sell-button">
                                Execute Sell
                            </button>
                        </div>
                        <p class="timer">Duration: ${formatDuration(activeTrade.currentDuration)}</p>
                    </div>
                </div>
                `
            : '<div class="no-trade-card"><h2>No Active Trade</h2></div>';
        
        document.getElementById('active-trade').innerHTML = activeTradeHtml;
    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}

function formatDuration(ms) {
    if (!ms) return '0h 0m';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
}

async function handleExtendTime(minutes) {
    if (!confirm(`Are you sure you want to extend the trailing stop duration by ${minutes} minutes?`)) {
        return;
    }

    try {
        const result = await updateTradeTiming(minutes);
        alert('Duration updated successfully');
        updateDashboard(); // Refresh the dashboard to show new duration
    } catch (error) {
        alert('Failed to update duration. Please try again.');
    }
}

async function loadRecentTrades() {
    try {
        const recentTrades = await fetchData('/api/recent-trades');
        const tableHtml = `
            <h2>Recent Trades</h2>
            <div class="table-container">
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
            </div>
        `;
        document.getElementById('content').innerHTML = tableHtml;
    } catch (error) {
        console.error('Error loading recent trades:', error);
        document.getElementById('content').innerHTML = '<p>Error loading recent trades. Please try again.</p>';
    }
}
async function loadMonitoredCoins() {
    try {
        const response = await fetchData('/api/monitored-coins');
        console.log('Raw monitored coins response:', response);

        let monitoredCoins;
        if (Array.isArray(response)) {
            monitoredCoins = { coins: response };
        } else if (typeof response === 'object' && response !== null) {
            monitoredCoins = response;
        } else {
            throw new Error('Unexpected response format');
        }

        if (!monitoredCoins.coins || !Array.isArray(monitoredCoins.coins)) {
            throw new Error('Invalid monitored coins data received');
        }

        const tableHtml = `
            <h2>Monitored Coins</h2>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Dip Count</th>
                        <th>State</th>
                        <th>First Dip</th>
                        <th>Last Dip</th>
                    </tr>
                </thead>
                <tbody>
                    ${monitoredCoins.coins.map(coin => `
                        <tr>
                            <td>${coin.symbol}</td>
                            <td>${coin.dipCount}</td>
                            <td>${coin.state}</td>
                            <td>${coin.timing?.firstDip?.time ? `${coin.timing.firstDip.time} (${coin.timing.firstDip.ago})` : '-'}</td>
                            <td>${coin.timing?.lastDip?.time ? `${coin.timing.lastDip.time} (${coin.timing.lastDip.ago})` : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        document.getElementById('content').innerHTML = tableHtml;
    } catch (error) {
        console.error('Error loading monitored coins:', error);
        document.getElementById('content').innerHTML = '<p>Error loading monitored coins. Please try again.</p>';
    }
}

function loadHardResetInfo() {
    const resetVariables = [
        'monitoringCoins',
        'dippedCoins',
        'lastDipTime',
        'trailingStops'
    ];
    const resetInfoHtml = `
        <h2>Hard Reset Confirmation</h2>
        <p>Warning: This action will reset the following variables:</p>
        <ul>
            ${resetVariables.map(variable => `<li>${variable}</li>`).join('')}
        </ul>
        <p>Are you sure you want to proceed with the hard reset?</p>
        <button id="confirm-hard-reset">Confirm Hard Reset</button>
        <button id="cancel-hard-reset">Cancel</button>
    `;
    const contentElement = document.getElementById('content');
    if (contentElement) {
        contentElement.innerHTML = resetInfoHtml;
        document.getElementById('confirm-hard-reset').addEventListener('click', performHardReset);
        document.getElementById('cancel-hard-reset').addEventListener('click', () => window.location.href = 'index.html');
    } else {
        console.error('Content element not found');
    }
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

function loadActiveCoinChart() {
    fetchData('/api/active-trade')
        .then(activeTrade => {
            if (activeTrade && activeTrade.symbol) {
                const symbol = activeTrade.symbol;
                new TradingView.widget({
                    "width": "100%",
                    "height": 500,
                    "symbol": `BINANCE:${symbol}`,
                    "interval": "D",
                    "timezone": "Etc/UTC",
                    "theme": "light",
                    "style": "1",
                    "locale": "en",
                    "toolbar_bg": "#f1f3f6",
                    "enable_publishing": false,
                    "allow_symbol_change": false,
                    "container_id": "tradingview_widget"
                });
                document.getElementById('content').innerHTML = `<h2>Chart for ${symbol}</h2><div id="tradingview_widget"></div>`;
            } else {
                document.getElementById('content').innerHTML = '<p>No active trade at the moment.</p>';
            }
        })
        .catch(error => {
            console.error('Error loading active trade:', error);
            document.getElementById('content').innerHTML = '<p>Error loading active trade data.</p>';
        });
}

function setupActivityListeners() {
    ['click', 'touchstart', 'mousemove', 'keypress'].forEach(eventType => {
        document.addEventListener(eventType, resetLogoutTimer);
    });
}

function setupNavigation() {
    const recentTradesButton = document.getElementById('recent-trades-button');
    const monitoredCoinsButton = document.getElementById('monitored-coins-button');
    const hardResetButton = document.getElementById('hard-reset-button');
    const activeCoinChartButton = document.getElementById('active-coin-chart-button');
    const logoutButton = document.getElementById('logout-button');

    if (recentTradesButton) recentTradesButton.addEventListener('click', () => window.location.href = 'recent-trades.html');
    if (monitoredCoinsButton) monitoredCoinsButton.addEventListener('click', () => {
        console.log('Monitored Coins button clicked');
        window.location.href = 'monitored-coins.html';
    });
    if (hardResetButton) hardResetButton.addEventListener('click', () => window.location.href = 'hard-reset-confirm.html');
    if (activeCoinChartButton) activeCoinChartButton.addEventListener('click', () => window.location.href = 'active-coin-chart.html');
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
}

function initializeLoginPage() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            login(username, password);
        });
    }
}

function initializeApp() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    console.log('Current page:', currentPage);

    if (currentPage === 'login.html') {
        initializeLoginPage();
        return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    resetLogoutTimer();
    setupActivityListeners();
    setupNavigation();

    switch (currentPage) {
        case 'index.html':
            updateDashboard();
            dashboardInterval = setInterval(updateDashboard, 10000);
            break;
        case 'recent-trades.html':
            loadRecentTrades();
            break;
        case 'monitored-coins.html':
            console.log('Loading monitored coins...');
            loadMonitoredCoins();
            break;
        case 'hard-reset-confirm.html':
            loadHardResetInfo();
            break;
        case 'active-coin-chart.html':
            loadActiveCoinChart();
            break;
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Add visible error handler for mobile debugging

// Add visible error handler for mobile debugging
window.onerror = function(msg, url, lineNo, columnNo, error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.backgroundColor = '#ffebee';
    errorDiv.style.padding = '10px';
    errorDiv.style.margin = '10px';
    errorDiv.style.border = '1px solid #ef9a9a';
    errorDiv.innerHTML = `Error: ${msg}<br>Line: ${lineNo}`;
    document.body.insertBefore(errorDiv, document.body.firstChild);
    return false;
};
