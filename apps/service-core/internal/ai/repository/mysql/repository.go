package mysql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"time"

	"fifam/apps/service-core/internal/ai/domain"
)

type Repository struct {
	db *sql.DB

	memMu   sync.Mutex
	memData map[uint64][]domain.Stage
}

type clubSeed struct {
	ID   int64
	Name string
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{
		db:      db,
		memData: make(map[uint64][]domain.Stage),
	}
}

func (r *Repository) EnsureUserStages(ctx context.Context, userID uint64) error {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		if _, exists := r.memData[userID]; exists {
			return nil
		}

		stages := make([]domain.Stage, 0, domain.TotalStages)
		for stageNo := 1; stageNo <= domain.TotalStages; stageNo++ {
			stages = append(stages, buildStageMetadata(userID, stageNo, []clubSeed{{ID: 1, Name: "FC Navy"}, {ID: 2, Name: "Crimson United"}, {ID: 3, Name: "Golden Phoenix"}}))
		}
		r.memData[userID] = stages
		return nil
	}

	clubs, err := r.listClubs(ctx)
	if err != nil {
		return err
	}
	if len(clubs) == 0 {
		return errors.New("no clubs available for AI stages")
	}

	now := time.Now()
	for stageNo := 1; stageNo <= domain.TotalStages; stageNo++ {
		meta := buildStageMetadata(userID, stageNo, clubs)
		isUnlocked := stageNo == 1
		var unlockedAt any
		if isUnlocked {
			unlockedAt = now
		}

		_, err := r.db.ExecContext(ctx, `
INSERT INTO ai_user_stages (
  user_id,
  stage_no,
  club_id,
  club_name,
  reward_money,
  reward_exp,
  enemy_stat_bonus,
  is_unlocked,
  is_cleared,
  attempts,
  wins,
  unlocked_at,
  created_at,
  updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  club_id = club_id`,
			userID,
			stageNo,
			meta.ClubID,
			meta.ClubName,
			meta.RewardMoney,
			meta.RewardExp,
			meta.EnemyStatBonus,
			isUnlocked,
			unlockedAt,
			now,
			now,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func (r *Repository) ListStages(ctx context.Context, userID uint64) ([]domain.Stage, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		stages := r.memData[userID]
		out := make([]domain.Stage, len(stages))
		copy(out, stages)
		return out, nil
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT
  stage_no,
  club_id,
  club_name,
  reward_money,
  reward_exp,
  enemy_stat_bonus,
  is_unlocked,
  is_cleared,
  attempts,
  wins,
  unlocked_at,
  last_cleared_at,
  updated_at
FROM ai_user_stages
WHERE user_id = ?
ORDER BY stage_no ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stages := make([]domain.Stage, 0, domain.TotalStages)
	for rows.Next() {
		var stage domain.Stage
		var unlockedAt sql.NullTime
		var clearedAt sql.NullTime
		var updatedAt sql.NullTime

		if err := rows.Scan(
			&stage.StageNo,
			&stage.ClubID,
			&stage.ClubName,
			&stage.RewardMoney,
			&stage.RewardExp,
			&stage.EnemyStatBonus,
			&stage.IsUnlocked,
			&stage.IsCleared,
			&stage.Attempts,
			&stage.Wins,
			&unlockedAt,
			&clearedAt,
			&updatedAt,
		); err != nil {
			return nil, err
		}

		if unlockedAt.Valid {
			stage.UnlockedAt = unlockedAt.Time
		}
		if clearedAt.Valid {
			stage.LastClearedAt = clearedAt.Time
		}
		if updatedAt.Valid {
			stage.LastUpdatedAt = updatedAt.Time
		}

		stages = append(stages, stage)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return stages, nil
}

func (r *Repository) GetStageDetail(ctx context.Context, userID uint64, stageNo int) (*domain.StageDetail, error) {
	stages, err := r.ListStages(ctx, userID)
	if err != nil {
		return nil, err
	}

	var target *domain.Stage
	for idx := range stages {
		if stages[idx].StageNo == stageNo {
			target = &stages[idx]
			break
		}
	}
	if target == nil {
		return nil, nil
	}

	opponent := make([]domain.OpponentPlayer, 0, 22)
	if r.db != nil {
		rows, err := r.db.QueryContext(ctx, `
SELECT name, base_shooting, base_passing, base_pace, base_physical, base_defending, base_dribbling
FROM player_templates
WHERE club_id = ? AND season = 'normal'
ORDER BY id ASC
LIMIT 22`, target.ClubID)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		for rows.Next() {
			var p domain.OpponentPlayer
			if err := rows.Scan(
				&p.Name,
				&p.Shooting,
				&p.Passing,
				&p.Pace,
				&p.Physical,
				&p.Defending,
				&p.Dribbling,
			); err != nil {
				return nil, err
			}
			opponent = append(opponent, applyBonus(p, target.EnemyStatBonus, len(opponent)))
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
	}

	if len(opponent) == 0 {
		for i := 0; i < 22; i++ {
			base := domain.OpponentPlayer{
				Name:      fmt.Sprintf("%s Opponent %02d", target.ClubName, i+1),
				Shooting:  62 + (i % 11),
				Passing:   60 + ((i + 2) % 11),
				Pace:      59 + ((i + 4) % 11),
				Physical:  58 + ((i + 6) % 11),
				Defending: 57 + ((i + 8) % 11),
				Dribbling: 61 + ((i + 10) % 11),
			}
			opponent = append(opponent, applyBonus(base, target.EnemyStatBonus, i))
		}
	}

	return &domain.StageDetail{Stage: *target, Opponent: opponent}, nil
}

func (r *Repository) ApplyStageResult(ctx context.Context, userID uint64, stageNo int, isWin bool) (domain.StageResult, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()

		stages := r.memData[userID]
		if len(stages) == 0 {
			return domain.StageResult{}, errors.New("stages not initialized")
		}

		idx := stageNo - 1
		if idx < 0 || idx >= len(stages) {
			return domain.StageResult{}, errors.New("stage not found")
		}
		if !stages[idx].IsUnlocked {
			return domain.StageResult{}, errors.New("stage is locked")
		}

		stages[idx].Attempts++
		result := domain.StageResult{StageNo: stageNo, IsWin: isWin, IsCleared: stages[idx].IsCleared}

		if isWin {
			result.GrantedMoney = stages[idx].RewardMoney
			result.GrantedExpPerPlayer = stages[idx].RewardExp
			result.RewardedPlayers = 22

			stages[idx].Wins++
			if !stages[idx].IsCleared {
				stages[idx].IsCleared = true
				result.IsCleared = true
				if stageNo < domain.TotalStages {
					nextIdx := idx + 1
					if !stages[nextIdx].IsUnlocked {
						stages[nextIdx].IsUnlocked = true
						result.UnlockedNext = true
						result.NextUnlockedStage = stageNo + 1
					}
				}
			}
		}

		r.memData[userID] = stages
		return result, nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.StageResult{}, err
	}
	defer tx.Rollback()

	var isUnlocked bool
	var isCleared bool
	var rewardMoney int64
	var rewardExp int
	err = tx.QueryRowContext(ctx, `
SELECT is_unlocked, is_cleared, reward_money, reward_exp
FROM ai_user_stages
WHERE user_id = ? AND stage_no = ?
FOR UPDATE`, userID, stageNo).Scan(&isUnlocked, &isCleared, &rewardMoney, &rewardExp)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.StageResult{}, errors.New("stage not found")
		}
		return domain.StageResult{}, err
	}
	if !isUnlocked {
		return domain.StageResult{}, errors.New("stage is locked")
	}

	if _, err := tx.ExecContext(ctx, `
UPDATE ai_user_stages
SET attempts = attempts + 1,
    wins = wins + CASE WHEN ? THEN 1 ELSE 0 END,
    is_cleared = CASE WHEN ? THEN 1 ELSE is_cleared END,
    last_cleared_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE last_cleared_at END,
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = ? AND stage_no = ?`, isWin, isWin, isWin, userID, stageNo); err != nil {
		return domain.StageResult{}, err
	}

	result := domain.StageResult{StageNo: stageNo, IsWin: isWin, IsCleared: isCleared || isWin}

	if isWin {
		result.GrantedMoney = rewardMoney
		result.GrantedExpPerPlayer = rewardExp

		if _, err := tx.ExecContext(ctx, `
UPDATE teams
SET budget = budget + ?
WHERE user_id = ?`, rewardMoney, userID); err != nil {
			return domain.StageResult{}, err
		}

		res, err := tx.ExecContext(ctx, `
UPDATE user_players
SET exp = exp + ?
WHERE id IN (
  SELECT id
  FROM (
    SELECT id
    FROM user_players
    WHERE user_id = ?
    ORDER BY id ASC
    LIMIT 22
  ) picked
)`, rewardExp, userID)
		if err != nil {
			return domain.StageResult{}, err
		}

		affected, err := res.RowsAffected()
		if err != nil {
			return domain.StageResult{}, err
		}
		result.RewardedPlayers = int(affected)
	}

	if isWin && !isCleared && stageNo < domain.TotalStages {
		res, err := tx.ExecContext(ctx, `
UPDATE ai_user_stages
SET is_unlocked = 1,
    unlocked_at = COALESCE(unlocked_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
WHERE user_id = ? AND stage_no = ? AND is_unlocked = 0`, userID, stageNo+1)
		if err != nil {
			return domain.StageResult{}, err
		}

		affected, err := res.RowsAffected()
		if err != nil {
			return domain.StageResult{}, err
		}
		if affected > 0 {
			result.UnlockedNext = true
			result.NextUnlockedStage = stageNo + 1
		}
	}

	if err := tx.Commit(); err != nil {
		return domain.StageResult{}, err
	}

	return result, nil
}

func (r *Repository) listClubs(ctx context.Context) ([]clubSeed, error) {
	if r.db == nil {
		return []clubSeed{
			{ID: 1, Name: "FC Navy"},
			{ID: 2, Name: "Crimson United"},
			{ID: 3, Name: "Golden Phoenix"},
		}, nil
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT id, name
FROM clubs
ORDER BY id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	clubs := make([]clubSeed, 0, 8)
	for rows.Next() {
		var c clubSeed
		if err := rows.Scan(&c.ID, &c.Name); err != nil {
			return nil, err
		}
		clubs = append(clubs, c)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return clubs, nil
}

func buildStageMetadata(userID uint64, stageNo int, clubs []clubSeed) domain.Stage {
	idx := stageClubIndex(userID, stageNo, len(clubs))
	club := clubs[idx]

	return domain.Stage{
		StageNo:        stageNo,
		ClubID:         club.ID,
		ClubName:       club.Name,
		RewardMoney:    int64(3000 + stageNo*850),
		RewardExp:      100 + stageNo*22,
		EnemyStatBonus: (stageNo - 1) / 2,
		IsUnlocked:     stageNo == 1,
	}
}

func stageClubIndex(userID uint64, stageNo int, totalClubs int) int {
	if totalClubs <= 1 {
		return 0
	}

	hash := int((userID*131 + uint64(stageNo*stageNo*17) + uint64(stageNo*29)) % uint64(totalClubs))
	if hash < 0 {
		return 0
	}
	return hash
}

func applyBonus(p domain.OpponentPlayer, bonus int, idx int) domain.OpponentPlayer {
	p.Role = roleByIndex(idx)
	p.Shooting = bounded(p.Shooting + bonus)
	p.Passing = bounded(p.Passing + bonus)
	p.Pace = bounded(p.Pace + bonus)
	p.Physical = bounded(p.Physical + bonus)
	p.Defending = bounded(p.Defending + bonus)
	p.Dribbling = bounded(p.Dribbling + bonus)
	return p
}

func roleByIndex(idx int) string {
	roles := []string{"GK", "LB", "LCB", "RCB", "RB", "LCM", "CM", "RCM", "LW", "ST", "RW"}
	if idx < len(roles) {
		return roles[idx]
	}
	return fmt.Sprintf("SUB-%02d", idx-len(roles)+1)
}

func bounded(v int) int {
	if v < 1 {
		return 1
	}
	if v > 99 {
		return 99
	}
	return v
}
