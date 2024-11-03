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
        
        document.getElementById('active-trade').innerHTML = activeTrade
            ? `
                <h2>Active Trade</h2>
                <p>Symbol: ${activeTrade.symbol}</p>
                <p>Entry Price: $${activeTrade.entryPrice}</p>
                <p>Current Price: $${activeTrade.currentPrice}</p>
                <p>Quantity: ${activeTrade.quantity}</p>
            `
            : '<h2>No Active Trade</h2>';
    } catch (error) {
        console.error('Error updating dashboard:', error);
    }
}

async function loadRecentTrades() {
    try {
        const recentTrades = await fetchData('/api/recent-trades');
        const tableHtml = `
            <h2>Recent Trades</h2>
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
        document.getElementById('content').innerHTML = tableHtml;
    } catch (error) {
        console.error('Error loading recent trades:', error);
        document.getElementById('content').innerHTML = '<p>Error loading recent trades. Please try again.</p>';
    }
}

async function loadMonitoredCoins() {
    try {
        console.log('Starting to fetch monitored coins...');
        const response = await fetchData('/api/monitored-coins');
        console.log('Raw monitored coins response:', response);

        // Validate response structure
        if (!response || typeof response !== 'object') {
            throw new Error('Invalid response received');
        }

        const monitoredCoins = response;
        console.log('Processed monitored coins:', monitoredCoins);

        const tableHtml = `
            <h2>Monitored Coins</h2>
            <div class="stats">
                <p>Total Monitored: ${monitoredCoins.totalMonitored || 0}</p>
                <p>Coins with Dips: ${monitoredCoins.coinsWithTwoOrThreeDips || 0}</p>
            </div>
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
                    ${(monitoredCoins.coins || []).map(coin => `
                        <tr>
                            <td>${coin.symbol || ''}</td>
                            <td>${coin.dipCount || 0}</td>
                            <td>${coin.state || ''}</td>
                            <td>${coin.timing?.firstDip?.time ? `${coin.timing.firstDip.time} (${coin.timing.firstDip.ago})` : '-'}</td>
                            <td>${coin.timing?.lastDip?.time ? `${coin.timing.lastDip.time} (${coin.timing.lastDip.ago})` : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        const contentElement = document.getElementById('content');
        if (!contentElement) {
            throw new Error('Content element not found');
        }
        contentElement.innerHTML = tableHtml;
    } catch (error) {
        console.error('Error loading monitored coins:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        document.getElementById('content').innerHTML = `<p>Error loading monitored coins: ${error.message}</p>`;
    }
}
        // Update summary stats
        const summaryHtml = `
            <h2>Monitoring Status</h2>
            <p>Total Coins Monitored: ${monitoredCoins.totalMonitored}</p>
            <p>Coins with 1-3 Dips: ${monitoredCoins.coinsWithTwoOrThreeDips}</p>
        `;
        document.getElementById('summary-stats').innerHTML = summaryHtml;

        // Create coin cards
        const coinsHtml = monitoredCoins.coins.map(coin => `
            <div class="coin-card">
                <div class="coin-header">
                    <h3 class="coin-symbol">${coin.symbol}</h3>
                    <span class="coin-dips">Dips: ${coin.dipCount}</span>
                    <span class="coin-state">${coin.state}</span>
                </div>
                <div class="coin-timing">
                    ${coin.timing.firstDip.time ? `
                        <div class="timing-row first-dip">
                            <span class="label">First Dip:</span>
                            <span class="time">${coin.timing.firstDip.time}</span>
                            <span class="ago">(${coin.timing.firstDip.ago})</span>
                        </div>
                    ` : ''}
                    ${coin.timing.lastDip.time ? `
                        <div class="timing-row last-dip">
                            <span class="label">Last Dip:</span>
                            <span class="time">${coin.timing.lastDip.time}</span>
                            <span class="ago">(${coin.timing.lastDip.ago})</span>
                        </div>
                    ` : ''}
                    ${coin.timing.monitoring.time ? `
                        <div class="timing-row monitoring">
                            <span class="label">Monitoring:</span>
                            <span class="time">${coin.timing.monitoring.time}</span>
                            <span class="ago">(${coin.timing.monitoring.duration})</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

        document.getElementById('content').innerHTML = `
            <div class="coin-grid">
                ${coinsHtml}
            </div>
        `;
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

function setupNavigation() {
    const recentTradesButton = document.getElementById('recent-trades-button');
    const monitoredCoinsButton = document.getElementById('monitored-coins-button');
    const hardResetButton = document.getElementById('hard-reset-button');
    const activeCoinChartButton = document.getElementById('active-coin-chart-button');
    const logoutButton = document.getElementById('logout-button');

    if (recentTradesButton) recentTradesButton.addEventListener('click', () => window.location.href = 'recent-trades.html');
    if (monitoredCoinsButton) monitoredCoinsButton.addEventListener('click', () => window.location.href = 'monitored-coins.html');
    if (hardResetButton) hardResetButton.addEventListener('click', () => window.location.href = 'hard-reset-confirm.html');
    if (activeCoinChartButton) activeCoinChartButton.addEventListener('click', () => window.location.href = 'active-coin-chart.html');
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
}

document.addEventListener('DOMContentLoaded', initializeApp);
