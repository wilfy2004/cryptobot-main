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
    
    // Special handling for bot status endpoint
    if (endpoint === '/api/bot-control' && !endpoint.includes('?')) {
        endpoint += '?command=status';  // Add status command for GET requests
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
async function updateBotStatus() {
    try {
        const response = await fetchData('/api/bot-control');
        const botStatus = response.currentState || 'active';
        
        const botControlElement = document.getElementById('bot-control');
        if (botControlElement) {
            botControlElement.innerHTML = `
                <div class="bot-control-card">
                    <h2>Bot Control</h2>
                    <div class="bot-status ${botStatus === 'active' ? 'active' : 'paused'}">
                        Current Status: ${botStatus.toUpperCase()}
                    </div>
                    <button onclick="toggleBot(${botStatus === 'active'})" 
                            class="action-button ${botStatus === 'active' ? 'pause-bot' : 'resume-bot'}">
                        ${botStatus === 'active' ? 'Pause Bot' : 'Resume Bot'}
                    </button>
                </div>
            `;
        }
        return botStatus;
    } catch (error) {
        console.error('Error fetching bot status:', error);
        return 'active'; // Default to active if status fetch fails
    }
}
async function toggleBot(pause) {
    if (!confirm(`Are you sure you want to ${pause ? 'pause' : 'resume'} the trading bot?`)) {
        return;
    }

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/api/bot-control`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: pause ? 'pause' : 'resume'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update bot status');
        }

        const result = await response.json();
        alert(`Bot ${pause ? 'paused' : 'resumed'} successfully`);
        await updateDashboard();
    } catch (error) {
        console.error('Error updating bot status:', error);
        alert(`Failed to update bot status: ${error.message}`);
    }
}
async function toggleTrailingStop(disable) {
    if (!confirm(`Are you sure you want to ${disable ? 'disable' : 'enable'} the trailing stop?`)) {
        return;
    }

    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/api/trailing-stop/control`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: disable ? 'DISABLE' : 'ENABLE'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update trailing stop status');
        }

        const result = await response.json();
        alert(`Trailing stop ${disable ? 'disabled' : 'enabled'} successfully`);
        await updateDashboard();
    } catch (error) {
        console.error('Error updating trailing stop:', error);
        alert(`Failed to update trailing stop: ${error.message}`);
    }
}

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

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error || 'Failed to execute sell order');
        }

        alert('Manual sell order executed successfully');
        await updateDashboard(); // Refresh the dashboard
    } catch (error) {
        console.error('Error executing manual sell:', error);
        
        // Only show error if the sell actually failed
        if (!error.message.includes('body used already')) {
            alert(`Failed to execute manual sell: ${error.message}`);
        }
    }
}
async function updateDashboard() {
    try {
        const [accountInfo, performanceMetrics, activeTrade, botStatus] = await Promise.all([
            fetchData('/api/account-info'),
            fetchData('/api/performance-metrics'),
            fetchData('/api/active-trade'),
            updateBotStatus() // Use the new function
        ]);

        // Get all elements at once and check they exist
        const elements = {
            accountInfo: document.getElementById('account-info'),
            performanceMetrics: document.getElementById('performance-metrics'),
            activeTrade: document.getElementById('active-trade'),
            botControl: document.getElementById('bot-control')
        };

        // Update performance metrics
        if (elements.performanceMetrics && performanceMetrics) {
            elements.performanceMetrics.innerHTML = `
                <h2>Performance Metrics</h2>
                <p>Total Trades: ${performanceMetrics.totalTrades || 0}</p>
                <p>Profitable Trades: ${performanceMetrics.profitableTrades || 0}</p>
                <p>Unprofitable Trades: ${performanceMetrics.unprofitableTrades || 0}</p>
                <p>Total Gains: $${performanceMetrics.totalGains || '0.00'}</p>
                <p>Total Profit: $${performanceMetrics.totalProfit || '0.00'}</p>
                <p>Total Losses: $${performanceMetrics.totalLosses || '0.00'}</p>
                <p>Win Rate: ${performanceMetrics.winRate || '0.00'}%</p>
                <p>Avg Profit %: ${performanceMetrics.avgProfitPercentage || '0.00'}%</p>
            `;
        }

        // Update account info
        if (elements.accountInfo && accountInfo && accountInfo.balance !== undefined) {
            elements.accountInfo.innerHTML = `
                <h2>Account Info</h2>
                <p>Balance: $${parseFloat(accountInfo.balance).toFixed(2)}</p>
            `;
        }
        
        // Update active trade section
        if (elements.activeTrade) {
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
                            <div class="time-info">
                                <p><strong>Time Elapsed:</strong> ${formatMinutes(activeTrade.timeElapsed)} minutes</p>
                                <p><strong>Custom Duration:</strong> ${formatHours(activeTrade.customDuration)} hours</p>
                                <p><strong>Time Remaining:</strong> ${formatHours(activeTrade.timeRemaining)} hours</p>
                                <p class="${activeTrade.trailingStopDisabled ? 'warning-text' : 'success-text'}">
                                    <strong>Trailing Stop:</strong> ${activeTrade.trailingStopDisabled ? 'Disabled (Manual Control)' : 'Active'}
                                </p>
                            </div>
                        </div>
                        <div class="trade-controls">
                            <div class="control-buttons">
                                <button onclick="handleExtendTime(120)" class="action-button extend-time">
                                    +2 Hours
                                </button>
                                <button onclick="executeManualSell()" class="action-button sell-button">
                                    Execute Sell
                                </button>
                                ${activeTrade.trailingStopDisabled ? 
                                    `<button onclick="toggleTrailingStop(false)" class="action-button enable-stop">
                                        Enable Trailing Stop
                                     </button>` :
                                    `<button onclick="toggleTrailingStop(true)" class="action-button disable-stop">
                                        Disable Trailing Stop
                                     </button>`
                                }
                            </div>
                            <p class="timer">Duration: ${formatDuration(activeTrade.currentDuration)}</p>
                        </div>
                    </div>
                    `
                : '<div class="no-trade-card"><h2>No Active Trade</h2></div>';
            
            elements.activeTrade.innerHTML = activeTradeHtml;
        }

    } catch (error) {
        console.error('Error updating dashboard:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = `Failed to update dashboard: ${error.message}`;
        document.body.insertBefore(errorDiv, document.body.firstChild);
    }
}

function formatMinutes(minutes) {
    return minutes ? minutes.toFixed(1) : '0';
}

function formatHours(hours) {
    return hours ? hours.toFixed(2) : '0';
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
        window.location.href = 'index.html';
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

document.addEventListener('DOMContentLoaded', initializeApp);

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
