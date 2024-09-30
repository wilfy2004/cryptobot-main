{\rtf1\ansi\ansicpg1252\cocoartf2761
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww21700\viewh15340\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const API_URL = 'https://home-mqhqbccvbz.dynamic-m.com:6333/api';\
\
async function fetchData(endpoint) \{\
    const response = await fetch(`$\{API_URL\}$\{endpoint\}`);\
    return response.json();\
\}\
\
async function updateDashboard() \{\
    try \{\
        const accountInfo = await fetchData('/account-info');\
        const activeTrade = await fetchData('/active-trade');\
        const recentTrades = await fetchData('/recent-trades');\
\
        document.getElementById('account-info').innerHTML = `\
            <h2>Account Info</h2>\
            <p>Balance: $$\{accountInfo.balance\}</p>\
        `;\
\
        document.getElementById('active-trade').innerHTML = activeTrade\
            ? `\
                <h2>Active Trade</h2>\
                <p>Symbol: $\{activeTrade.symbol\}</p>\
                <p>Entry Price: $$\{activeTrade.entryPrice\}</p>\
                <p>Current Price: $$\{activeTrade.currentPrice\}</p>\
            `\
            : '<h2>No Active Trade</h2>';\
\
        document.getElementById('recent-trades').innerHTML = `\
            <h2>Recent Trades</h2>\
            <ul>\
                $\{recentTrades.map(trade => `\
                    <li>$\{trade.symbol\}: $\{trade.action\} at $$\{trade.price\}</li>\
                `).join('')\}\
            </ul>\
        `;\
    \} catch (error) \{\
        console.error('Error updating dashboard:', error);\
    \}\
\}\
\
// Update dashboard every 10 seconds\
setInterval(updateDashboard, 10000);\
\
// Initial update\
updateDashboard();\
\
// Register service worker for PWA functionality\
if ('serviceWorker' in navigator) \{\
    navigator.serviceWorker.register('/sw.js')\
        .then(reg => console.log('Service Worker registered'))\
        .catch(err => console.log('Service Worker registration failed:', err));\
\}}