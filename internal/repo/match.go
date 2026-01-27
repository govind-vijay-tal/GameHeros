package repo

import (
	"time"

	"gameheros/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type MatchRepo struct {
	db *sqlx.DB
}

func NewMatchRepo(db *sqlx.DB) *MatchRepo {
	return &MatchRepo{db: db}
}

func (r *MatchRepo) Create(m *models.Match) error {
	_, err := r.db.Exec(`
		INSERT INTO matches (id, tournament_id, team_a_id, team_b_id, start_time, status, score_summary, version) 
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		m.ID, m.TournamentID, m.TeamAID, m.TeamBID, m.StartTime, m.Status, m.ScoreSummary, m.Version,
	)
	return err
}

func (r *MatchRepo) GetByID(id uuid.UUID) (*models.MatchResponse, error) {
	var match models.MatchResponse
	query := `
		SELECT 
			m.*,
			ta.name as team_a_name,
			ta.short_code as team_a_short_code,
			tb.name as team_b_name,
			tb.short_code as team_b_short_code,
			t.name as tournament_name
		FROM matches m
		JOIN teams ta ON m.team_a_id = ta.id
		JOIN teams tb ON m.team_b_id = tb.id
		JOIN tournaments t ON m.tournament_id = t.id
		WHERE m.id = $1`
	err := r.db.Get(&match, query, id)
	return &match, err
}

func (r *MatchRepo) GetAll() ([]models.MatchResponse, error) {
	var matches []models.MatchResponse
	query := `
		SELECT 
			m.*,
			ta.name as team_a_name,
			ta.short_code as team_a_short_code,
			tb.name as team_b_name,
			tb.short_code as team_b_short_code,
			t.name as tournament_name
		FROM matches m
		JOIN teams ta ON m.team_a_id = ta.id
		JOIN teams tb ON m.team_b_id = tb.id
		JOIN tournaments t ON m.tournament_id = t.id
		ORDER BY m.start_time DESC`
	err := r.db.Select(&matches, query)
	return matches, err
}

func (r *MatchRepo) ExistsSameDay(tournamentID, teamAID, teamBID uuid.UUID, startTime time.Time) (bool, error) {
	var count int
	err := r.db.Get(&count, `
		SELECT COUNT(*) FROM matches 
		WHERE tournament_id = $1 
		AND ((team_a_id = $2 AND team_b_id = $3) OR (team_a_id = $3 AND team_b_id = $2))
		AND DATE(start_time) = DATE($4)`,
		tournamentID, teamAID, teamBID, startTime)
	return count > 0, err
}

func (r *MatchRepo) GetEvents(matchID uuid.UUID) ([]models.MatchEvent, error) {
	var events []models.MatchEvent
	query := `SELECT * FROM match_events WHERE match_id = $1 ORDER BY id ASC`
	err := r.db.Select(&events, query, matchID)
	return events, err
}
