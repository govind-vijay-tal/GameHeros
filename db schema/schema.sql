CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    sport_type VARCHAR(50) NOT NULL,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'UPCOMING'
);

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    short_code VARCHAR(10) NOT NULL,
    logo_url TEXT
);

CREATE TABLE tournament_teams (
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    PRIMARY KEY (tournament_id, team_id)
);

CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    sport_type VARCHAR(50) NOT NULL,
    role VARCHAR(50)
);

CREATE TABLE tournament_team_players (
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    PRIMARY KEY (tournament_id, team_id, player_id),

    UNIQUE(tournament_id, player_id)
);

CREATE INDEX idx_tournament_team_players_tournament ON tournament_team_players(tournament_id);
CREATE INDEX idx_tournament_team_players_team ON tournament_team_players(team_id);
CREATE INDEX idx_tournament_team_players_player ON tournament_team_players(player_id);

CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id),
    team_a_id UUID REFERENCES teams(id),
    team_b_id UUID REFERENCES teams(id),
    start_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED',

    score_summary JSONB DEFAULT '{}'::jsonb,

    version INT DEFAULT 1
);

CREATE TABLE match_events (
    id BIGSERIAL PRIMARY KEY,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,

    event_type VARCHAR(50) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    event_data JSONB NOT NULL
);

CREATE INDEX idx_match_events_match_id ON match_events(match_id);

CREATE TABLE tournament_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id),
    player_id UUID REFERENCES players(id),

    stats JSONB DEFAULT '{}'::jsonb,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(tournament_id, player_id)
);