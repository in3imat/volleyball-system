// Base URL for API - will work in both development and production
const API_BASE_URL = window.location.origin;

// Function to fetch data from server
async function fetchData(endpoint) {
    try {
        console.log(`📡 Fetching from: ${API_BASE_URL}${endpoint}`);
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

// Display dashboard statistics
async function loadDashboard() {
    const stats = await fetchData('/api/dashboard');
    if (!stats) {
        showError('Cannot connect to server. Please make sure the server is running.');
        return;
    }

    // Display main statistics
    const statsGrid = document.getElementById('dashboard-stats');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="stat-card">
                <h3>Total Players</h3>
                <p class="stat-number">${stats.total_players || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Total Sessions</h3>
                <p class="stat-number">${stats.attendance_stats?.total_sessions || 0}</p>
            </div>
            <div class="stat-card">
                <h3>Avg Attendance</h3>
                <p class="stat-number">${stats.attendance_stats?.avg_attendance?.toFixed(1) || 0}</p>
            </div>
        `;
    }

    // Display top MVP players
    const topMvps = document.getElementById('top-mvps');
    if (topMvps) {
        if (stats.top_mvps && stats.top_mvps.length > 0) {
            topMvps.innerHTML = stats.top_mvps.map(player => `
                <div class="mvp-item">
                    <span>${player.full_name}</span>
                    <span class="mvp-count">${player.mvp_awards_count} MVPs</span>
                </div>
            `).join('');
        } else {
            topMvps.innerHTML = '<p>No MVP data available yet</p>';
        }
    }

    // Display players
    const players = await fetchData('/api/players');
    const playersList = document.getElementById('players-list');
    
    if (players && players.players && playersList) {
        if (players.players.length > 0) {
            playersList.innerHTML = players.players.slice(0, 6).map(player => `
                <div class="player-card">
                    <div class="player-header">
                        <h3>${player.full_name}</h3>
                        <span class="skill-badge ${player.skill_level.toLowerCase()}">
                            ${player.skill_level}
                        </span>
                    </div>
                    <div class="player-stats">
                        <div class="stat">
                            <span>MVP Awards:</span>
                            <strong>${player.mvp_awards_count}</strong>
                        </div>
                        <div class="stat">
                            <span>Sessions:</span>
                            <strong>${player.sessions_attended_count}</strong>
                        </div>
                        <div class="stat">
                            <span>Points:</span>
                            <strong>${player.total_points_scored}</strong>
                        </div>
                    </div>
                    <div class="player-actions">
                        <button onclick="viewPlayer(${player.id})" class="btn btn-primary">
                            View Profile
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            playersList.innerHTML = '<p>No players found. <a href="/add-player">Add your first player!</a></p>';
        }
    }
}

// View player details
function viewPlayer(playerId) {
    window.location.href = `/player-stats.html?id=${playerId}`;
}

// Show error message
function showError(message) {
    const app = document.getElementById('app');
    if (app) {
        app.innerHTML = `
            <div class="error-message">
                <h2>⚠️ Connection Error</h2>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn btn-primary">Try Again</button>
            </div>
        `;
    }
}

// Load dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🏐 Volleyball System Loaded');
    loadDashboard();
});