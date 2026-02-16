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
		"INSERT INTO tournaments (id, name, sport_type, start_date, status, config) VALUES ($1, $2, $3, $4, $5, $6)",
		t.ID, t.Name, t.SportType, t.StartDate, t.Status, t.Config,
	)
	return err
}

func (r *TournamentRepo) GetByID(id uuid.UUID) (*models.TournamentResponse, error) {
	var tournament models.TournamentResponse
	query := `
		SELECT t.id, t.name, t.sport_type, t.start_date, t.status,
		       COALESCE((SELECT COUNT(*) FROM tournament_teams tt WHERE tt.tournament_id = t.id), 0) as team_count,
		       COALESCE(
		         (SELECT config::jsonb FROM tournaments WHERE id = t.id),
		         '{}'::jsonb
		       ) as config
		FROM tournaments t
		WHERE t.id = $1`
	err := r.db.Get(&tournament, query, id)
	return &tournament, err
}

func (r *TournamentRepo) GetAll() ([]models.TournamentResponse, error) {
	var tournaments []models.TournamentResponse
	query := `
		SELECT t.id, t.name, t.sport_type, t.start_date, t.status,
		       COALESCE((SELECT COUNT(*) FROM tournament_teams tt WHERE tt.tournament_id = t.id), 0) as team_count,
		       COALESCE(
		         (SELECT config::jsonb FROM tournaments WHERE id = t.id),
		         '{}'::jsonb
		       ) as config
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
		JOIN tournament_team_players ttp ON ttp.tournament_id = lb.tournament_id AND ttp.player_id = lb.player_id
		JOIN teams t ON ttp.team_id = t.id
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

func (r *TournamentRepo) CalculateLeaderboard(tournamentID uuid.UUID) error {

	_, err := r.db.Exec("DELETE FROM tournament_leaderboard WHERE tournament_id = $1", tournamentID)
	if err != nil {
		return err
	}

	var players []struct {
		PlayerID uuid.UUID `db:"player_id"`
		TeamID   uuid.UUID `db:"team_id"`
	}
	query := `
		SELECT DISTINCT player_id, team_id
		FROM tournament_team_players
		WHERE tournament_id = $1`
	err = r.db.Select(&players, query, tournamentID)
	if err != nil {
		return err
	}

	var completedMatches []struct {
		MatchID uuid.UUID `db:"match_id"`
		TeamAID uuid.UUID `db:"team_a_id"`
		TeamBID uuid.UUID `db:"team_b_id"`
	}
	matchQuery := `
		SELECT id as match_id, team_a_id, team_b_id
		FROM matches
		WHERE tournament_id = $1 AND status = 'COMPLETED'`
	err = r.db.Select(&completedMatches, matchQuery, tournamentID)
	if err != nil {
		return err
	}

	for _, player := range players {
		stats := make(models.JSONB)
		matchesPlayed := 0
		totalRuns := 0
		totalWickets := 0

		for _, match := range completedMatches {
			if match.TeamAID == player.TeamID || match.TeamBID == player.TeamID {
				matchesPlayed++

				var events []models.MatchEvent
				eventQuery := `SELECT * FROM match_events WHERE match_id = $1 ORDER BY id ASC`
				err = r.db.Select(&events, eventQuery, match.MatchID)
				if err != nil {
					continue
				}

				isTeamABatting := true
				for _, event := range events {

					if event.EventType == "INNINGS_END" {
						isTeamABatting = !isTeamABatting
						continue
					}

					if event.EventType == "BALL_BOWLED" {
						if runs, ok := event.EventData["runs"].(float64); ok {

							if batterIDStr, ok := event.EventData["batter_id"].(string); ok {
								if batterID, err := uuid.Parse(batterIDStr); err == nil && batterID == player.PlayerID {
									totalRuns += int(runs)
								}
							} else {

								if (isTeamABatting && match.TeamAID == player.TeamID) ||
									(!isTeamABatting && match.TeamBID == player.TeamID) {
									totalRuns += int(runs)
								}
							}
						}
					}

					if event.EventType == "WICKET" {

						if bowlerIDStr, ok := event.EventData["bowler_id"].(string); ok {
							if bowlerID, err := uuid.Parse(bowlerIDStr); err == nil && bowlerID == player.PlayerID {
								totalWickets++
							}
						} else {

							if (isTeamABatting && match.TeamBID == player.TeamID) ||
								(!isTeamABatting && match.TeamAID == player.TeamID) {
								totalWickets++
							}
						}
					}
				}
			}
		}

		stats["matches"] = matchesPlayed
		stats["runs"] = totalRuns
		stats["wickets"] = totalWickets

		_, err = r.db.Exec(`
			INSERT INTO tournament_leaderboard (id, tournament_id, player_id, stats)
			VALUES (uuid_generate_v4(), $1, $2, $3)
			ON CONFLICT (tournament_id, player_id)
			DO UPDATE SET stats = $3, updated_at = CURRENT_TIMESTAMP`,
			tournamentID, player.PlayerID, stats)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *TournamentRepo) UpdateConfig(id uuid.UUID, config models.JSONB) error {
	_, err := r.db.Exec(
		"UPDATE tournaments SET config = $1 WHERE id = $2",
		config, id,
	)
	return err
}

func (r *TournamentRepo) HasMatches(id uuid.UUID) (bool, error) {
	var count int
	err := r.db.Get(&count, "SELECT COUNT(*) FROM matches WHERE tournament_id = $1", id)
	return count > 0, err
}
