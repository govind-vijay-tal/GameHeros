package repo

import (
	"database/sql"
	"gameheros/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type MatchStatsRepo struct {
	db *sqlx.DB
}

func NewMatchStatsRepo(db *sqlx.DB) *MatchStatsRepo {
	return &MatchStatsRepo{db: db}
}

func (r *MatchStatsRepo) Upsert(matchID uuid.UUID, stats models.JSONB) error {
	query := `
		INSERT INTO match_stats (match_id, stats, updated_at)
		VALUES ($1, $2, CURRENT_TIMESTAMP)
		ON CONFLICT (match_id)
		DO UPDATE SET stats = $2, updated_at = CURRENT_TIMESTAMP`
	_, err := r.db.Exec(query, matchID, stats)
	return err
}

func (r *MatchStatsRepo) GetByMatchID(matchID uuid.UUID) (*models.MatchStats, error) {
	var stats models.MatchStats
	query := `SELECT * FROM match_stats WHERE match_id = $1`
	err := r.db.Get(&stats, query, matchID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &stats, nil
}
