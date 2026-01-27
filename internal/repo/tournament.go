package repo

import (
	"gameheros/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type TournamentRepo struct {
	db *sqlx.DB
}

func NewTournamentRepo(db *sqlx.DB) *TournamentRepo {
	return &TournamentRepo{db: db}
}

func (r *TournamentRepo) Create(t *models.Tournament) error {
	_, err := r.db.Exec(
		"INSERT INTO tournaments (id, name, sport_type, start_date, status) VALUES ($1, $2, $3, $4, $5)",
		t.ID, t.Name, t.SportType, t.StartDate, t.Status,
	)
	return err
}

func (r *TournamentRepo) GetByID(id uuid.UUID) (*models.TournamentResponse, error) {
	var tournament models.TournamentResponse
	query := `
		SELECT t.*, 
		       COALESCE((SELECT COUNT(*) FROM tournament_teams tt WHERE tt.tournament_id = t.id), 0) as team_count
		FROM tournaments t
		WHERE t.id = $1`
	err := r.db.Get(&tournament, query, id)
	return &tournament, err
}

func (r *TournamentRepo) GetAll() ([]models.TournamentResponse, error) {
	var tournaments []models.TournamentResponse
	query := `
		SELECT t.*, 
		       COALESCE((SELECT COUNT(*) FROM tournament_teams tt WHERE tt.tournament_id = t.id), 0) as team_count
		FROM tournaments t
		ORDER BY t.start_date DESC`
	err := r.db.Select(&tournaments, query)
	return tournaments, err
}

func (r *TournamentRepo) ExistsByName(name string) (bool, error) {
	var count int
	err := r.db.Get(&count, "SELECT COUNT(*) FROM tournaments WHERE LOWER(name) = LOWER($1)", name)
	return count > 0, err
}

func (r *TournamentRepo) GetLeaderboard(tournamentID uuid.UUID) ([]models.LeaderboardEntry, error) {
	var leaderboard []models.LeaderboardEntry
	query := `
		SELECT 
			lb.id, lb.tournament_id, lb.player_id, lb.stats,
			p.name as player_name,
			t.name as team_name,
			t.short_code as team_code
		FROM tournament_leaderboard lb
		JOIN players p ON lb.player_id = p.id
		JOIN teams t ON p.team_id = t.id
		WHERE lb.tournament_id = $1
		ORDER BY (lb.stats->>'runs')::int DESC NULLS LAST`
	err := r.db.Select(&leaderboard, query, tournamentID)
	return leaderboard, err
}

func (r *TournamentRepo) AddTeam(tournamentID, teamID uuid.UUID) error {
	_, err := r.db.Exec(
		"INSERT INTO tournament_teams (tournament_id, team_id) VALUES ($1, $2)",
		tournamentID, teamID,
	)
	return err
}

func (r *TournamentRepo) TeamExistsInTournament(tournamentID, teamID uuid.UUID) (bool, error) {
	var count int
	err := r.db.Get(&count,
		"SELECT COUNT(*) FROM tournament_teams WHERE tournament_id = $1 AND team_id = $2",
		tournamentID, teamID)
	return count > 0, err
}

func (r *TournamentRepo) CountTeamsInTournament(tournamentID uuid.UUID, teamIDs ...uuid.UUID) (int, error) {
	var count int
	if len(teamIDs) == 2 {
		err := r.db.Get(&count,
			"SELECT COUNT(*) FROM tournament_teams WHERE tournament_id = $1 AND team_id IN ($2, $3)",
			tournamentID, teamIDs[0], teamIDs[1])
		return count, err
	}
	return 0, nil
}

func (r *TournamentRepo) GetTeams(tournamentID uuid.UUID) ([]models.Team, error) {
	var teams []models.Team
	query := `
		SELECT t.* FROM teams t
		JOIN tournament_teams tt ON t.id = tt.team_id
		WHERE tt.tournament_id = $1
		ORDER BY t.name`
	err := r.db.Select(&teams, query, tournamentID)
	return teams, err
}
