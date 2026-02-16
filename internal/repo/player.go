package repo

import (
	"database/sql"

	"gameheros/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type PlayerRepo struct {
	db *sqlx.DB
}

func NewPlayerRepo(db *sqlx.DB) *PlayerRepo {
	return &PlayerRepo{db: db}
}

func (r *PlayerRepo) Create(p *models.Player) error {
	_, err := r.db.Exec(
		"INSERT INTO players (id, name, sport_type, role) VALUES ($1, $2, $3, $4)",
		p.ID, p.Name, p.SportType, p.Role,
	)
	return err
}

func (r *PlayerRepo) GetAll() ([]models.Player, error) {
	var players []models.Player
	err := r.db.Select(&players, "SELECT * FROM players ORDER BY name")
	return players, err
}

func (r *PlayerRepo) GetByID(id uuid.UUID) (*models.Player, error) {
	var player models.Player
	err := r.db.Get(&player, "SELECT * FROM players WHERE id = $1", id)
	return &player, err
}

func (r *PlayerRepo) UpdateName(id uuid.UUID, name string) error {
	_, err := r.db.Exec("UPDATE players SET name = $1 WHERE id = $2", name, id)
	return err
}

func (r *PlayerRepo) UpdateRole(id uuid.UUID, role string) error {
	if role == "" {
		_, err := r.db.Exec("UPDATE players SET role = NULL WHERE id = $1", id)
		return err
	}
	_, err := r.db.Exec("UPDATE players SET role = $1 WHERE id = $2", role, id)
	return err
}

func (r *PlayerRepo) GetBySportType(sportType string) ([]models.Player, error) {
	var players []models.Player
	err := r.db.Select(&players, "SELECT * FROM players WHERE sport_type = $1 ORDER BY name", sportType)
	return players, err
}

func (r *PlayerRepo) GetProfile(id uuid.UUID) (*models.PlayerProfile, error) {
	var profile models.PlayerProfile

	query := `
		SELECT
			p.*,
			COALESCE(t.name, '') as team_name,
			COALESCE(t.short_code, '') as team_code
		FROM players p
		LEFT JOIN (
			SELECT DISTINCT ON (player_id)
				player_id, team_id
			FROM tournament_team_players
			WHERE player_id = $1
			ORDER BY player_id, tournament_id DESC
		) ttp ON p.id = ttp.player_id
		LEFT JOIN teams t ON ttp.team_id = t.id
		WHERE p.id = $1`
	err := r.db.Get(&profile, query, id)
	return &profile, err
}

func (r *PlayerRepo) ExistsByName(name string) (bool, error) {
	var count int
	err := r.db.Get(&count,
		"SELECT COUNT(*) FROM players WHERE LOWER(name) = LOWER($1)",
		name)
	return count > 0, err
}

func (r *PlayerRepo) GetLatestStats(playerID uuid.UUID) (models.JSONB, error) {
	var stats models.JSONB
	query := `
		SELECT stats FROM tournament_leaderboard
		WHERE player_id = $1
		ORDER BY updated_at DESC
		LIMIT 1`
	err := r.db.Get(&stats, query, playerID)
	if err == sql.ErrNoRows {
		return models.JSONB{}, nil
	}
	return stats, err
}

func (r *PlayerRepo) AddPlayerToTeamInTournament(tournamentID, teamID, playerID uuid.UUID) error {
	_, err := r.db.Exec(`
		INSERT INTO tournament_team_players (tournament_id, team_id, player_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (tournament_id, player_id) DO NOTHING`,
		tournamentID, teamID, playerID)
	return err
}

func (r *PlayerRepo) RemovePlayerFromTeamInTournament(tournamentID, teamID, playerID uuid.UUID) error {
	_, err := r.db.Exec(`
		DELETE FROM tournament_team_players
		WHERE tournament_id = $1 AND team_id = $2 AND player_id = $3`,
		tournamentID, teamID, playerID)
	return err
}

func (r *PlayerRepo) IsPlayerInTournamentTeam(tournamentID, playerID uuid.UUID) (bool, uuid.UUID, error) {
	var teamID uuid.UUID
	err := r.db.Get(&teamID,
		"SELECT team_id FROM tournament_team_players WHERE tournament_id = $1 AND player_id = $2",
		tournamentID, playerID)
	if err == sql.ErrNoRows {
		return false, uuid.Nil, nil
	}
	if err != nil {
		return false, uuid.Nil, err
	}
	return true, teamID, nil
}

func (r *PlayerRepo) GetPlayersInTeamForTournament(tournamentID, teamID uuid.UUID) ([]models.Player, error) {
	var players []models.Player
	query := `
		SELECT p.*
		FROM players p
		JOIN tournament_team_players ttp ON p.id = ttp.player_id
		WHERE ttp.tournament_id = $1 AND ttp.team_id = $2
		ORDER BY p.name`
	err := r.db.Select(&players, query, tournamentID, teamID)
	return players, err
}

func (r *PlayerRepo) GetAvailablePlayersForTournament(tournamentID uuid.UUID, sportType string) ([]models.Player, error) {
	var players []models.Player
	query := `
		SELECT p.*
		FROM players p
		WHERE p.sport_type = $1
		AND p.id NOT IN (
			SELECT player_id FROM tournament_team_players WHERE tournament_id = $2
		)
		ORDER BY p.name`
	err := r.db.Select(&players, query, sportType, tournamentID)
	return players, err
}
