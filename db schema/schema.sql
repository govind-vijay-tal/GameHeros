-- 1. Enable UUID extension (Crucial for Distributed Systems)
-- This allows us to generate unique IDs inside the DB without central coordination.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- EPIC 1: ADMIN LAYER (Strict Relational)
-- ==========================================

-- 2. Tournaments Table
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    sport_type VARCHAR(50) NOT NULL, -- 'CRICKET', 'FOOTBALL'
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'UPCOMING' -- 'UPCOMING', 'LIVE', 'COMPLETED'
);

-- 3. Teams Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    short_code VARCHAR(10) NOT NULL, -- e.g., 'CSK', 'MI'
    logo_url TEXT
);

-- 4. Tournament_Teams (Many-to-Many Join Table)
-- A team can play in multiple tournaments.
CREATE TABLE tournament_teams (
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    PRIMARY KEY (tournament_id, team_id)
);

-- 5. Players Table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES teams(id), -- Current team (simplification for POC)
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) -- 'BATTER', 'BOWLER', 'ALL_ROUNDER'
);

-- 6. Matches Table (The Core Entity)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id),
    team_a_id UUID REFERENCES teams(id),
    team_b_id UUID REFERENCES teams(id),
    start_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED', -- 'LIVE', 'COMPLETED'
    
    -- Denormalized Score Summary (For fast listing without JOINs)
    -- We update this JSONB every time an event happens.
    score_summary JSONB DEFAULT '{}'::jsonb,
    
    -- Optimistic Locking Version (For POC-303 later)
    version INT DEFAULT 1
);

-- ==========================================
-- EPIC 2: SCORING LAYER (Event Sourcing)
-- ==========================================

-- 7. Match Events (The Append-Only Log)
-- partitioning this table would be the next step in SDE-3 interviews.
CREATE TABLE match_events (
    id BIGSERIAL PRIMARY KEY, -- Sequence for strict ordering
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    
    -- What happened?
    event_type VARCHAR(50) NOT NULL, -- 'BALL_BOWLED', 'WICKET', 'GOAL'
    
    -- When did it happen?
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- The "Payload" (Flexible Data)
    -- Cricket Example: {"runs": 4, "batter_id": "...", "bowler_id": "..."}
    -- Football Example: {"minute": 34, "player_id": "...", "card": "YELLOW"}
    event_data JSONB NOT NULL
);

-- Index for faster reads of a specific match's history
CREATE INDEX idx_match_events_match_id ON match_events(match_id);


-- ==========================================
-- EPIC 3: ANALYTICS LAYER (Async Stats)
-- ==========================================

-- 8. Tournament Leaderboard (Updated by Worker)
CREATE TABLE tournament_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id),
    player_id UUID REFERENCES players(id),
    
    -- Store generic stats as JSON to support multiple sports
    -- {"runs": 450, "wickets": 12} or {"goals": 5}
    stats JSONB DEFAULT '{}'::jsonb,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tournament_id, player_id) -- Ensure one entry per player per tournament
);