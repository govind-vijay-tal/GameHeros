ALTER TABLE players ADD COLUMN IF NOT EXISTS sport_type VARCHAR(50);

CREATE TABLE IF NOT EXISTS tournament_team_players (
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    PRIMARY KEY (tournament_id, team_id, player_id),

    UNIQUE(tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_team_players_tournament ON tournament_team_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_team_players_team ON tournament_team_players(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_team_players_player ON tournament_team_players(player_id);

