const API_URL = 'https://your-node-red-instance.com/api';
const AUTH_TOKEN = 'your_secret_token';

async function fetchData(endpoint) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`
        }
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

async function updateDashboard() {
    try {
        const accountInfo = await fetchData('/account-info');
        const activeTrade = await fetchData('/active-trade');
        const recentTrades = await fetchData('/recent-trades');

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
    }
}

// Update dashboard every 10 seconds
setInterval(updateDashboard, 10000);

// Initial update
updateDashboard();
