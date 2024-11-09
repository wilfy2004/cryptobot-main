import React, { useState, useEffect } from 'react';

const TradeTimingControl = () => {
    const [currentDuration, setCurrentDuration] = useState(null);
    const [isAdjustable, setIsAdjustable] = useState(false);
    const [activeTrade, setActiveTrade] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchTradeStatus = async () => {
            try {
                const response = await fetch('/api/active-trade');
                const data = await response.json();
                setActiveTrade(data);
                setIsAdjustable(!!data); // Enable controls if there's an active trade
                if (data) {
                    const timingResponse = await fetch('/api/trade/timing/current');
                    const timingData = await timingResponse.json();
                    setCurrentDuration(timingData.trailingStopDuration);
                }
            } catch (error) {
                console.error('Failed to fetch trade status:', error);
            }
        };

        fetchTradeStatus();
        const interval = setInterval(fetchTradeStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleExtendTime = async (minutes) => {
        if (!window.confirm(`Are you sure you want to extend the trailing stop duration by ${minutes} minutes?`)) {
            return;
        }

        setLoading(true);
        try {
            const adjustment = minutes * 60 * 1000; // Convert to milliseconds
            const response = await fetch('/api/trade/timing/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    parameter: 'trailingStopDuration',
                    adjustment
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update duration');
            }

            const data = await response.json();
            setCurrentDuration(data.newValue);
            alert('Duration updated successfully');
        } catch (error) {
            console.error('Failed to update duration:', error);
            alert('Failed to update duration. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isAdjustable) {
        return null;
    }

    const formatDuration = (ms) => {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className="trade-timing-control">
            <h3 className="text-xl font-bold mb-4">Trade Timing Control</h3>
            {activeTrade && (
                <div className="bg-white rounded-lg shadow p-4 mb-4">
                    <p className="text-sm text-gray-600 mb-2">Active Trade: {activeTrade.symbol}</p>
                    <p className="text-sm text-gray-600 mb-4">
                        Current Duration: {currentDuration ? formatDuration(currentDuration) : 'Loading...'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => handleExtendTime(30)}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                        >
                            +30 Minutes
                        </button>
                        <button
                            onClick={() => handleExtendTime(60)}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                        >
                            +1 Hour
                        </button>
                        <button
                            onClick={() => handleExtendTime(120)}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                        >
                            +2 Hours
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TradeTimingControl;
