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
    console.log('🔄 Loading dashboard data...');
    
    const stats = await fetchData('/api/dashboard');
    if (!stats) {
        showError('Cannot connect to server. Please make sure the server is running.');
        return;
    }

    console.log('📊 Dashboard stats received:', stats);

    // Display main statistics
    const statsGrid = document.getElementById('dashboard-stats');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <h3>Total Players</h3>
                <p class="stat-number">${stats.total_players || 0}</p>
                <p class="stat-description">Registered in system</p>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🏐</div>
                <h3>Total Sessions</h3>
                <p class="stat-number">${stats.total_sessions || 0}</p>
                <p class="stat-description">Games recorded</p>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⭐</div>
                <h3>MVP Awards</h3>
                <p class="stat-number">${stats.total_mvps || 0}</p>
                <p class="stat-description">Total awards given</p>
            </div>
        `;
    }

    // Display top MVP players
    const topMvps = document.getElementById('top-mvps');
    if (topMvps) {
        if (stats.top_mvps && stats.top_mvps.length > 0) {
            topMvps.innerHTML = stats.top_mvps.map(player => `
                <div class="mvp-item">
                    <span class="player-name">${player.full_name}</span>
                    <span class="mvp-count">${player.mvp_awards_count} MVP${player.mvp_awards_count !== 1 ? 's' : ''}</span>
                </div>
            `).join('');
        } else {
            topMvps.innerHTML = '<div class="no-data">No MVP awards yet</div>';
        }
    }

    // Display recent players
    const recentPlayers = document.getElementById('recent-players');
    if (recentPlayers) {
        if (stats.recent_players && stats.recent_players.length > 0) {
            recentPlayers.innerHTML = stats.recent_players.map(player => `
                <div class="recent-player-item">
                    <span class="player-name">${player.full_name}</span>
                    <span class="player-id">${player.player_id}</span>
                    <span class="join-date">${new Date(player.created_at).toLocaleDateString()}</span>
                </div>
            `).join('');
        } else {
            recentPlayers.innerHTML = '<div class="no-data">No players yet</div>';
        }
    }

    // Display recent sessions
    const recentSessions = document.getElementById('recent-sessions');
    if (recentSessions) {
        if (stats.recent_sessions && stats.recent_sessions.length > 0) {
            recentSessions.innerHTML = stats.recent_sessions.map(session => `
                <div class="recent-session-item">
                    <span class="session-date">${new Date(session.session_date).toLocaleDateString()}</span>
                    <span class="session-added">Added: ${new Date(session.created_at).toLocaleDateString()}</span>
                </div>
            `).join('');
        } else {
            recentSessions.innerHTML = '<div class="no-data">No sessions yet</div>';
        }
    }

    // Display players grid
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
                        <div class="stat">
                            <span>Saves:</span>
                            <strong>${player.total_saves}</strong>
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
            playersList.innerHTML = `
                <div class="no-players-message">
                    <p>No players found in the system.</p>
                    <a href="/add-player" class="btn btn-primary">Add Your First Player</a>
                </div>
            `;
        }
    }
}

// Auto-refresh dashboard every 30 seconds
function startAutoRefresh() {
    setInterval(() => {
        console.log('🔄 Auto-refreshing dashboard...');
        loadDashboard();
    }, 30000); // 30 seconds
}

// View player details
function viewPlayer(playerId) {
    window.location.href = `/players-list`;
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
    startAutoRefresh();
});