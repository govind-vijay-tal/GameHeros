package repo

import (
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
		"INSERT INTO players (id, team_id, name, role) VALUES ($1, $2, $3, $4)",
		p.ID, p.TeamID, p.Name, p.Role,
	)
	return err
}

func (r *PlayerRepo) GetByID(id uuid.UUID) (*models.Player, error) {
	var player models.Player
	err := r.db.Get(&player, "SELECT * FROM players WHERE id = $1", id)
	return &player, err
}

func (r *PlayerRepo) GetProfile(id uuid.UUID) (*models.PlayerProfile, error) {
	var profile models.PlayerProfile
	query := `
		SELECT 
			p.*,
			t.name as team_name,
			t.short_code as team_code
		FROM players p
		JOIN teams t ON p.team_id = t.id
		WHERE p.id = $1`
	err := r.db.Get(&profile, query, id)
	return &profile, err
}

func (r *PlayerRepo) ExistsInTeam(teamID uuid.UUID, name string) (bool, error) {
	var count int
	err := r.db.Get(&count,
		"SELECT COUNT(*) FROM players WHERE team_id = $1 AND LOWER(name) = LOWER($2)",
		teamID, name)
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
	return stats, err
}
