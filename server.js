const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// PostgreSQL connection for Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize database
async function initializeDatabase() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Create players table
    await client.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        player_id VARCHAR(20) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        phone_number VARCHAR(20),
        instagram_username VARCHAR(50),
        age INTEGER,
        skill_level VARCHAR(20) CHECK (skill_level IN ('Beginner', 'Intermediate', 'Advanced')),
        form_submissions_count INTEGER DEFAULT 0,
        sessions_attended_count INTEGER DEFAULT 0,
        mvp_awards_count INTEGER DEFAULT 0,
        total_points_scored INTEGER DEFAULT 0,
        total_saves INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sessions table (just dates)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        session_date DATE UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Drop and recreate player_sessions table with new schema
    await client.query('DROP TABLE IF EXISTS player_sessions CASCADE');
    
    // Create player_sessions table (links players to sessions with stats)
    await client.query(`
      CREATE TABLE IF NOT EXISTS player_sessions (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        points_scored INTEGER DEFAULT 0,
        saves INTEGER DEFAULT 0,
        mvp_award BOOLEAN DEFAULT FALSE,
        attendance_status VARCHAR(20) DEFAULT 'Present',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, session_id)
      )
    `);

    // Create form_submissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS form_submissions (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        session_date DATE,
        attended_session BOOLEAN DEFAULT FALSE
      )
    `);

    console.log('✅ Database tables created/verified');
    client.release();
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  }
}

// Initialize database on startup
initializeDatabase();

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get players list
app.get('/api/players-list', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        player_id,
        full_name,
        phone_number,
        instagram_username,
        age,
        skill_level,
        created_at
      FROM players 
      ORDER BY full_name
    `);
    
    res.json({ 
      players: result.rows,
      count: result.rowCount
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Get all players with stats
app.get('/api/players', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.player_id,
        p.full_name,
        p.phone_number,
        p.instagram_username,
        p.age,
        p.skill_level,
        p.form_submissions_count,
        p.sessions_attended_count,
        p.mvp_awards_count,
        p.total_points_scored,
        p.total_saves,
        CASE 
          WHEN p.sessions_attended_count > 0 
          THEN ROUND((p.total_points_scored * 1.0 / p.sessions_attended_count), 2)
          ELSE 0 
        END as avg_points_per_session,
        CASE 
          WHEN p.sessions_attended_count > 0 
          THEN ROUND((p.total_saves * 1.0 / p.sessions_attended_count), 2)
          ELSE 0 
        END as avg_saves_per_session
      FROM players p
      ORDER BY full_name
    `);
    
    res.json({ players: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch players with stats' });
  }
});

// Get player by ID
app.get('/api/players/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM players WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    
    res.json({ player: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new player
app.post('/api/players', async (req, res) => {
  const { player_id, full_name, phone_number, instagram_username, age, skill_level } = req.body;
  
  if (!player_id || !full_name) {
    return res.status(400).json({ error: 'Player ID and Full Name are required' });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO players (player_id, full_name, phone_number, instagram_username, age, skill_level) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [player_id, full_name, phone_number, instagram_username, age, skill_level]
    );
    
    res.json({ 
      message: 'Player added successfully',
      player_id: player_id,
      id: result.rows[0].id
    });
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      res.status(400).json({ error: `Player ID "${player_id}" already exists` });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Update player
app.put('/api/players/:id', async (req, res) => {
  const { player_id, full_name, phone_number, instagram_username, age, skill_level } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE players 
       SET player_id = $1, full_name = $2, phone_number = $3, instagram_username = $4, 
           age = $5, skill_level = $6, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $7`,
      [player_id, full_name, phone_number, instagram_username, age, skill_level, req.params.id]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    
    res.json({ message: 'Player updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete player
app.delete('/api/players/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM players WHERE id = $1', [req.params.id]);
    
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    
    res.json({ message: 'Player deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, session_date, created_at 
      FROM sessions 
      ORDER BY session_date DESC
    `);
    
    res.json({ sessions: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Add new session (just date)
app.post('/api/sessions', async (req, res) => {
  const { session_date } = req.body;
  
  if (!session_date) {
    return res.status(400).json({ error: 'Session date is required' });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO sessions (session_date) 
       VALUES ($1) RETURNING id`,
      [session_date]
    );
    
    res.json({ 
      message: 'Session added successfully',
      session_id: result.rows[0].id
    });
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      res.status(400).json({ error: `Session for date "${session_date}" already exists` });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Add player statistics to a session
app.post('/api/player-sessions', async (req, res) => {
  const { player_id, session_id, points_scored, saves, mvp_award } = req.body;
  
  if (!player_id || !session_id) {
    return res.status(400).json({ error: 'Player ID and Session ID are required' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Insert or update player session stats
    await client.query(
      `INSERT INTO player_sessions (player_id, session_id, points_scored, saves, mvp_award) 
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (player_id, session_id) 
       DO UPDATE SET 
         points_scored = EXCLUDED.points_scored,
         saves = EXCLUDED.saves,
         mvp_award = EXCLUDED.mvp_award`,
      [player_id, session_id, points_scored || 0, saves || 0, mvp_award || false]
    );
    
    // Update player overall stats
    await client.query(
      `UPDATE players 
       SET total_points_scored = COALESCE((
         SELECT SUM(points_scored) FROM player_sessions WHERE player_id = $1
       ), 0),
           total_saves = COALESCE((
         SELECT SUM(saves) FROM player_sessions WHERE player_id = $1
       ), 0),
           mvp_awards_count = COALESCE((
         SELECT COUNT(*) FROM player_sessions WHERE player_id = $1 AND mvp_award = true
       ), 0),
           sessions_attended_count = COALESCE((
         SELECT COUNT(*) FROM player_sessions WHERE player_id = $1
       ), 0),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [player_id]
    );
    
    await client.query('COMMIT');
    res.json({ message: 'Player session statistics added successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding player session:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get player sessions with session details
app.get('/api/players/:id/sessions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ps.*, s.session_date 
       FROM player_sessions ps 
       JOIN sessions s ON ps.session_id = s.id 
       WHERE ps.player_id = $1 
       ORDER BY s.session_date DESC`,
      [req.params.id]
    );
    
    res.json({ sessions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get players for a specific session
app.get('/api/sessions/:id/players', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.full_name, p.player_id, ps.points_scored, ps.saves, ps.mvp_award
       FROM players p
       JOIN player_sessions ps ON p.id = ps.player_id
       WHERE ps.session_id = $1
       ORDER BY p.full_name`,
      [req.params.id]
    );
    
    res.json({ players: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get dashboard stats - UPDATED
app.get('/api/dashboard', async (req, res) => {
  try {
    const stats = {};
    
    // Total players
    const totalPlayersResult = await pool.query('SELECT COUNT(*) as total_players FROM players');
    stats.total_players = parseInt(totalPlayersResult.rows[0].total_players);
    
    // Total sessions played
    const totalSessionsResult = await pool.query('SELECT COUNT(*) as total_sessions FROM sessions');
    stats.total_sessions = parseInt(totalSessionsResult.rows[0].total_sessions);
    
    // Total MVP awards
    const totalMvpResult = await pool.query('SELECT COUNT(*) as total_mvps FROM player_sessions WHERE mvp_award = true');
    stats.total_mvps = parseInt(totalMvpResult.rows[0].total_mvps);
    
    // Top MVP players
    const topMvpsResult = await pool.query(`
      SELECT full_name, mvp_awards_count 
      FROM players 
      WHERE mvp_awards_count > 0
      ORDER BY mvp_awards_count DESC 
      LIMIT 5
    `);
    stats.top_mvps = topMvpsResult.rows;
    
    // Recent players
    const recentPlayersResult = await pool.query(`
      SELECT full_name, player_id, created_at 
      FROM players 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    stats.recent_players = recentPlayersResult.rows;
    
    // Recent sessions
    const recentSessionsResult = await pool.query(`
      SELECT session_date, created_at 
      FROM sessions 
      ORDER BY session_date DESC 
      LIMIT 5
    `);
    stats.recent_sessions = recentSessionsResult.rows;
    
    console.log('📊 Dashboard stats:', stats);
    res.json(stats);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Check if player ID exists
app.get('/api/check-player-id/:player_id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM players WHERE player_id = $1',
      [req.params.player_id]
    );
    
    res.json({ exists: parseInt(result.rows[0].count) > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Database repair endpoint
app.post('/api/repair-database', async (req, res) => {
  try {
    // Drop and recreate player_sessions table
    await pool.query('DROP TABLE IF EXISTS player_sessions CASCADE');
    await pool.query(`
      CREATE TABLE player_sessions (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        points_scored INTEGER DEFAULT 0,
        saves INTEGER DEFAULT 0,
        mvp_award BOOLEAN DEFAULT FALSE,
        attendance_status VARCHAR(20) DEFAULT 'Present',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_id, session_id)
      )
    `);
    res.json({ message: 'Database repaired successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/players-list', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'players-list.html'));
});

app.get('/add-player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add-player.html'));
});

app.get('/edit-player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'edit-player.html'));
});

app.get('/add-session', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add-session.html'));
});

app.get('/add-player-stats', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'add-player-stats.html'));
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Open your browser and go to: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await pool.end();
  console.log('✅ Database connection closed.');
  process.exit(0);
});