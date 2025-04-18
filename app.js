// Global constants and variables
const API_URL = 'https://nodered.wilfy2004.synology.me';
let dashboardInterval;
let logoutTimer;
const LOGOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds
const isGitHubPages = window.location.hostname.includes('github.io');

function handleApiError(error, context) {
    console.error(`${context}:`, error);
    // Only show user-facing errors for non-dashboard updates
    if (context !== 'Dashboard update') {
        alert(`${context}: ${error.message}`);
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
            throw new Error(`Failed to ${pause ? 'pause' : 'resume'} bot`);
        }

        const result = await response.json();
        
        // Force immediate dashboard update
        await updateDashboard();
        
    } catch (error) {
        alert(`Failed to ${pause ? 'pause' : 'resume'} bot: ${error.message}`);
    }
}

async function fetchData(endpoint) {
    try {
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
            // Return a default object instead of throwing
            return { error: `HTTP error! status: ${response.status}` };
        }
        
        const data = await response.json().catch(() => ({}));
        return data || {};  // Return empty object if null/undefined
        
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return { error: error.message };  // Return error object instead of throwing
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

        const result = await response.json();

        // Check for success first before any error checks
        if (result.success || result.status === 'success') {
            alert(`Trailing stop ${disable ? 'disabled' : 'enabled'} successfully`);
            await updateDashboard();
            return;
        }

        // Only throw error if we didn't get a success response
        if (!response.ok) {
            throw new Error(result.error || 'Failed to update trailing stop status');
        }

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

        // Check for success first before any error checks
        if (responseData.status === 'success' || responseData.executed) {
            alert('Manual sell order executed successfully');
            await updateDashboard();
            return;
        }

        // Only throw error if we didn't get a success response
        if (!response.ok) {
            throw new Error(responseData.error || 'Failed to execute sell order');
        }

    } catch (error) {
        console.error('Error executing manual sell:', error);
        
        // Specific handling for duplicate execution attempts
        if (error.message.includes('body used already')) {
            alert('Trade was already executed successfully');
            await updateDashboard();
            return;
        }

        handleApiError(error, 'Manual sell execution failed');
    }
}

// Main dashboard update function
async function updateDashboard() {
    try {
        const [accountInfo, performanceMetrics, botStatus, activeTrade] = await Promise.all([
            fetchData('/api/account-info').catch(e => ({ error: e })),
            fetchData('/api/performance-metrics').catch(e => ({ error: e })),
            fetchData('/api/bot-control').catch(e => ({ error: e })),
            fetchData('/api/active-trade').catch(e => ({ error: e }))
        ]);

        // Get elements
        const elements = {
            accountInfo: document.getElementById('account-info'),
            performanceMetrics: document.getElementById('performance-metrics'),
            botControl: document.getElementById('bot-control'),
            activeTrade: document.getElementById('active-trade')
        };

        // Update bot control section
        if (elements.botControl) {
            const currentState = botStatus?.currentState || 'active';
            elements.botControl.innerHTML = `
                <div class="bot-control-card">
                    <div class="status-display ${currentState === 'active' ? 'active' : 'paused'}">
                        <span class="status-indicator ${currentState === 'active' ? 'active' : 'paused'}">
                            ${currentState === 'active' ? '🟢' : '🔴'}
                        </span>
                        <span class="status-text">
                            BOT STATUS: ${currentState.toUpperCase()}
                        </span>
                    </div>
                    <button onclick="toggleBot(${currentState === 'active'})" 
                            class="action-button ${currentState === 'active' ? 'pause-bot' : 'resume-bot'}">
                        ${currentState === 'active' ? 'PAUSE BOT' : 'RESUME BOT'}
                    </button>
                </div>
            `;
        }

        // Update performance metrics
        if (elements.performanceMetrics && performanceMetrics && !performanceMetrics.error) {
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
        if (elements.accountInfo && accountInfo && !accountInfo.error && accountInfo.balance !== undefined) {
            elements.accountInfo.innerHTML = `
                <h2>Account Info</h2>
                <p>Balance: $${parseFloat(accountInfo.balance).toFixed(2)}</p>
            `;
        }

        // Update active trade section only if there is an active trade
        if (elements.activeTrade) {
            if (activeTrade && !activeTrade.error && activeTrade.symbol) {
                updateActiveTrade(activeTrade, elements.activeTrade);
            } else {
                elements.activeTrade.innerHTML = '';  // Clear the section if no active trade
            }
        }

    } catch (error) {
        console.error('Dashboard update error:', error);
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
                            <th>Buy Total</th>
                            <th>Sell Total %</th>
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
                                <td>${trade.buyAmount}</td> 
                                <td>${trade.sellAmount}</td>
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

async function showHardResetConfirmation() {
    if (confirm('Are you sure you want to perform a hard reset? This will reset all monitoring variables.')) {
        await performHardReset();
    }
}

async function performHardReset() {
    console.log('performHardReset called');
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/api/hard-reset`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Hard reset response:', response);

        if (!response.ok) {
            throw new Error(`Hard reset failed with status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Hard reset response data:', data);

        if (data.success) {
            alert('Hard reset completed successfully: ' + data.message);
            // Verify the reset by checking monitored coins
            const monitoredCoins = await fetchData('/api/monitored-coins');
            console.log('Post-reset monitored coins:', monitoredCoins);
            if (monitoredCoins.coins && monitoredCoins.coins.length === 0) {
                console.log('Verified: No monitored coins after reset');
            }
            window.location.reload();
        } else {
            throw new Error(data.message || 'Hard reset failed');
        }
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

    if (hardResetButton) {
        hardResetButton.addEventListener('click', async () => {
            console.log('Hard reset button clicked');
            if (confirm('Are you sure you want to perform a hard reset? This will reset all monitoring variables.')) {
                await performHardReset();
            }
        });
    }

    if (recentTradesButton) recentTradesButton.addEventListener('click', () => window.location.href = 'recent-trades.html');
    if (monitoredCoinsButton) monitoredCoinsButton.addEventListener('click', () => window.location.href = 'monitored-coins.html');
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
    // Initial dashboard load
    updateDashboard().catch(console.error);
    
    // Set up regular dashboard updates
    dashboardInterval = setInterval(() => {
        updateDashboard().catch(console.error);
    }, 10000);
    
    // Set up more frequent active trade updates
    setInterval(async () => {
        const element = document.getElementById('active-trade');
        if (element) {
            const activeTrade = await fetchData('/api/active-trade');
            if (activeTrade && !activeTrade.error && activeTrade.symbol) {
                updateActiveTrade(activeTrade, element);
            } else {
                element.innerHTML = '';  // Clear the section if no active trade
            }
        }
    }, 2000);
    break;

        case 'recent-trades.html':
            loadRecentTrades();
            break;
            
        case 'monitored-coins.html':
            console.log('Loading monitored coins...');
            loadMonitoredCoins();
            break;
            
        case 'active-coin-chart.html':
            loadActiveCoinChart();
            break;
    }
}
function updateActiveTrade(activeTrade, element) {
    const activeTradeHtml = (!activeTrade || activeTrade.error)
        ? '<div class="no-trade-card"><h2>No Active Trade</h2></div>'
        : `
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
        `;
    
    element.innerHTML = activeTradeHtml;
}

document.addEventListener('DOMContentLoaded', initializeApp);
