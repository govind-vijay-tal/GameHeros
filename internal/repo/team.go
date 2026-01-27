package repo

import (
	"gameheros/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type TeamRepo struct {
	db *sqlx.DB
}

func NewTeamRepo(db *sqlx.DB) *TeamRepo {
	return &TeamRepo{db: db}
}

func (r *TeamRepo) Create(t *models.Team) error {
	_, err := r.db.Exec(
		"INSERT INTO teams (id, name, short_code, logo_url) VALUES ($1, $2, $3, $4)",
		t.ID, t.Name, t.ShortCode, t.LogoURL,
	)
	return err
}

func (r *TeamRepo) GetByID(id uuid.UUID) (*models.Team, error) {
	var team models.Team
	err := r.db.Get(&team, "SELECT * FROM teams WHERE id = $1", id)
	return &team, err
}

func (r *TeamRepo) GetByIDWithCount(id uuid.UUID) (*models.TeamResponse, error) {
	var team models.TeamResponse
	query := `
		SELECT t.*, 
		       COALESCE((SELECT COUNT(*) FROM players p WHERE p.team_id = t.id), 0) as player_count
		FROM teams t
		WHERE t.id = $1`
	err := r.db.Get(&team, query, id)
	return &team, err
}

func (r *TeamRepo) GetAll() ([]models.TeamResponse, error) {
	var teams []models.TeamResponse
	query := `
		SELECT t.*, 
		       COALESCE((SELECT COUNT(*) FROM players p WHERE p.team_id = t.id), 0) as player_count
		FROM teams t
		ORDER BY t.name`
	err := r.db.Select(&teams, query)
	return teams, err
}

func (r *TeamRepo) ExistsByNameOrCode(name, shortCode string) (bool, error) {
	var count int
	err := r.db.Get(&count,
		"SELECT COUNT(*) FROM teams WHERE LOWER(name) = LOWER($1) OR UPPER(short_code) = UPPER($2)",
		name, shortCode)
	return count > 0, err
}

func (r *TeamRepo) CountByIDs(ids ...uuid.UUID) (int, error) {
	var count int
	if len(ids) == 2 {
		err := r.db.Get(&count, "SELECT COUNT(*) FROM teams WHERE id IN ($1, $2)", ids[0], ids[1])
		return count, err
	}
	return 0, nil
}

func (r *TeamRepo) GetPlayers(teamID uuid.UUID) ([]models.Player, error) {
	var players []models.Player
	err := r.db.Select(&players, "SELECT * FROM players WHERE team_id = $1 ORDER BY name", teamID)
	return players, err
}
