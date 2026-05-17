package mysql

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"fifam/apps/service-core/internal/match/domain"
)

type Repository struct {
	db *sql.DB

	memMu   sync.Mutex
	memData map[string]domain.MatchResult
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db, memData: make(map[string]domain.MatchResult)}
}

func (r *Repository) GetHomeClubName(ctx context.Context, userID uint64) (string, error) {
	if r.db == nil {
		return "FC Navy", nil
	}

	var clubName string
	err := r.db.QueryRowContext(ctx, `
SELECT club_name
FROM teams
WHERE user_id = ?
LIMIT 1`, userID).Scan(&clubName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", errors.New("team not found for current user")
		}
		return "", err
	}

	return clubName, nil
}

func (r *Repository) CreateMatch(ctx context.Context, start domain.MatchStart, userID uint64) error {
	if r.db == nil {
		r.memMu.Lock()
		r.memData[start.MatchID] = domain.MatchResult{
			MatchID:      start.MatchID,
			HomeClubName: start.HomeClubName,
			AwayClubName: start.AwayClubName,
			StartedAt:    start.StartedAt,
		}
		r.memMu.Unlock()
		return nil
	}

	_, err := r.db.ExecContext(ctx, `
INSERT INTO matches (
  match_uuid,
  user_id,
  home_club_name,
  away_club_name,
  mode,
  stage_no,
  status,
  started_at,
  created_at,
  updated_at
) VALUES (?, ?, ?, ?, ?, NULLIF(?, 0), 'running', ?, ?, ?)`,
		start.MatchID,
		userID,
		start.HomeClubName,
		start.AwayClubName,
		start.Mode,
		start.StageNo,
		start.StartedAt,
		start.StartedAt,
		start.StartedAt,
	)
	return err
}

func (r *Repository) FinalizeMatch(ctx context.Context, input domain.FinalizeInput) (*domain.MatchResult, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()

		current, ok := r.memData[input.MatchID]
		if !ok {
			return nil, errors.New("match not found")
		}

		now := time.Now().UTC()
		current.HomeScore = input.HomeScore
		current.AwayScore = input.AwayScore
		current.HomeStats = input.HomeStats
		current.AwayStats = input.AwayStats
		current.Scorers = input.Scorers
		current.EndedAt = now
		r.memData[input.MatchID] = current

		copied := current
		return &copied, nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var matchPK uint64
	var homeClubName string
	var awayClubName string
	var startedAt time.Time
	var status string
	err = tx.QueryRowContext(ctx, `
SELECT id, home_club_name, away_club_name, started_at, status
FROM matches
WHERE match_uuid = ? AND user_id = ?
FOR UPDATE`, input.MatchID, input.UserID).Scan(&matchPK, &homeClubName, &awayClubName, &startedAt, &status)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("match not found")
		}
		return nil, err
	}
	if status == "finished" {
		return nil, errors.New("match already finalized")
	}

	homeStatsJSON, err := json.Marshal(input.HomeStats)
	if err != nil {
		return nil, err
	}
	awayStatsJSON, err := json.Marshal(input.AwayStats)
	if err != nil {
		return nil, err
	}
	endedAt := time.Now().UTC()

	_, err = tx.ExecContext(ctx, `
UPDATE matches
SET home_score = ?,
    away_score = ?,
    home_stats = ?,
    away_stats = ?,
    status = 'finished',
    ended_at = ?,
    updated_at = ?
WHERE id = ?`,
		input.HomeScore,
		input.AwayScore,
		homeStatsJSON,
		awayStatsJSON,
		endedAt,
		endedAt,
		matchPK,
	)
	if err != nil {
		return nil, err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM match_scorers WHERE match_id = ?`, matchPK); err != nil {
		return nil, err
	}

	for _, scorer := range input.Scorers {
		teamSide := "home"
		if scorer.TeamID == "away" {
			teamSide = "away"
		}
		_, err := tx.ExecContext(ctx, `
INSERT INTO match_scorers (
  match_id,
  team_side,
  player_id,
  player_name,
  minute,
  created_at
) VALUES (?, ?, ?, ?, ?, ?)`,
			matchPK,
			teamSide,
			scorer.PlayerID,
			scorer.PlayerName,
			scorer.Minute,
			endedAt,
		)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	result := &domain.MatchResult{
		MatchID:      input.MatchID,
		HomeClubName: homeClubName,
		AwayClubName: awayClubName,
		HomeScore:    input.HomeScore,
		AwayScore:    input.AwayScore,
		StartedAt:    startedAt,
		EndedAt:      endedAt,
		HomeStats:    input.HomeStats,
		AwayStats:    input.AwayStats,
		Scorers:      input.Scorers,
	}
	return result, nil
}
