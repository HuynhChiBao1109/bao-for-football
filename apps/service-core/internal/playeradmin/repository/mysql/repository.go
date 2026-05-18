package mysql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"fifam/apps/service-core/internal/playeradmin/domain"
)

type Repository struct {
	db            *sql.DB
	ensureOnce    sync.Once
	ensureErr     error
	memMu         sync.Mutex
	memData       []domain.Player
	memCountries  []domain.Country
	memClubs      []domain.Club
	nextID        int64
	nextCountryID int64
	nextClubID    int64
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db, nextID: 1, nextCountryID: 1, nextClubID: 1}
}

func (r *Repository) List(ctx context.Context, filter domain.PlayerFilter) ([]domain.Player, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		out := make([]domain.Player, 0, len(r.memData))
		for _, item := range r.memData {
			if filter.Name != "" && !strings.Contains(strings.ToLower(item.Name), strings.ToLower(filter.Name)) {
				continue
			}
			if filter.CountryID != nil && item.CountryID != *filter.CountryID {
				continue
			}
			if filter.BaseClub != "" && !strings.EqualFold(item.BaseClub, filter.BaseClub) {
				continue
			}
			out = append(out, item)
		}
		return out, nil
	}

	if err := r.ensureTable(ctx); err != nil {
		return nil, err
	}

whereClauses := make([]string, 0, 3)
	args := make([]any, 0, 3)

	if filter.Name != "" {
		whereClauses = append(whereClauses, "LOWER(pt.name) LIKE ?")
		args = append(args, "%"+strings.ToLower(filter.Name)+"%")
	}
	if filter.CountryID != nil {
		whereClauses = append(whereClauses, "pt.country_id = ?")
		args = append(args, *filter.CountryID)
	}
	if filter.BaseClub != "" {
		whereClauses = append(whereClauses, "pt.base_club = ?")
		args = append(args, filter.BaseClub)
	}

	query := `
SELECT pt.id, pt.name, pt.country_id, pt.club_id, pt.image_url,
	COALESCE(c.id, 0) AS country_row_id,
	COALESCE(c.name, ''),
	COALESCE(c.code, ''),
	COALESCE(c.flag, ''),
	COALESCE(cl.id, 0) AS club_row_id,
	COALESCE(cl.name, pt.base_club),
	COALESCE(cl.logo, ''),
	pt.base_club, pt.season,
	pt.base_shooting, pt.base_passing, pt.base_long_pass, pt.base_vision, pt.base_gk_reach, pt.base_counter_attack_awareness, pt.base_defending, pt.base_gk_parrying, pt.base_gk_reflex, pt.base_duels, pt.base_pace, pt.base_stamina, pt.base_balance, pt.base_technique, pt.base_determination, pt.base_physical, pt.base_standing_tackle, pt.base_sliding_tackle, pt.base_dribbling, pt.base_curve, pt.created_at
FROM player_templates pt
LEFT JOIN countries c ON c.id = pt.country_id
LEFT JOIN clubs cl ON cl.id = pt.club_id
`
	if len(whereClauses) > 0 {
		query += " WHERE " + strings.Join(whereClauses, " AND ")
	}
	query += " ORDER BY pt.id DESC"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	players := make([]domain.Player, 0, 32)
	playerIDs := make([]int64, 0, 32)
	for rows.Next() {
		var p domain.Player
		var countryRowID int64
		var clubRowID int64
		var avatar sql.NullString
		var createdAt sql.NullTime
		if err := rows.Scan(
			&p.ID,
			&p.Name,
			&p.CountryID,
			&p.ClubID,
			&avatar,
			&countryRowID,
			&p.Country.Name,
			&p.Country.Code,
			&p.Country.Flag,
			&clubRowID,
			&p.Club.Name,
			&p.Club.Logo,
			&p.BaseClub,
			&p.Season,
			&p.Shooting,
			&p.Passing,
			&p.LongPass,
			&p.Vision,
			&p.GKReach,
			&p.AttAwareness,
			&p.DefAwareness,
			&p.GKParrying,
			&p.GKReflex,
			&p.Duels,
			&p.Pace,
			&p.Stamina,
			&p.Balance,
			&p.Technique,
			&p.Determination,
			&p.Strength,
			&p.StandingTackle,
			&p.SlidingTackle,
			&p.Dribbling,
			&p.Curve,
			&createdAt,
		); err != nil {
			return nil, err
		}
		if avatar.Valid {
			avatarValue := avatar.String
			p.Avatar = &avatarValue
		}
		if createdAt.Valid {
			p.CreatedAt = createdAt.Time
		}
		if countryRowID > 0 {
			p.Country.ID = countryRowID
		}
		if clubRowID > 0 {
			p.Club.ID = clubRowID
		}
		players = append(players, p)
		playerIDs = append(playerIDs, p.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := r.loadPlayerSkills(ctx, &players, playerIDs); err != nil {
		return nil, err
	}

	return players, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (domain.Player, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		for _, item := range r.memData {
			if item.ID == id {
				return item, nil
			}
		}
		return domain.Player{}, errors.New("player not found")
	}

	if err := r.ensureTable(ctx); err != nil {
		return domain.Player{}, err
	}

	row := r.db.QueryRowContext(ctx, `
SELECT pt.id, pt.name, pt.country_id, pt.club_id, pt.image_url,
	COALESCE(c.id, 0) AS country_row_id,
	COALESCE(c.name, ''),
	COALESCE(c.code, ''),
	COALESCE(c.flag, ''),
  COALESCE(cl.id, 0) AS club_row_id,
	COALESCE(cl.name, pt.base_club),
	COALESCE(cl.logo, ''),
	pt.base_club, pt.season,
	pt.base_shooting, pt.base_passing, pt.base_long_pass, pt.base_vision, pt.base_gk_reach, pt.base_counter_attack_awareness, pt.base_defending, pt.base_gk_parrying, pt.base_gk_reflex, pt.base_duels, pt.base_pace, pt.base_stamina, pt.base_balance, pt.base_technique, pt.base_determination, pt.base_physical, pt.base_standing_tackle, pt.base_sliding_tackle, pt.base_dribbling, pt.base_curve, pt.created_at
FROM player_templates pt
LEFT JOIN countries c ON c.id = pt.country_id
LEFT JOIN clubs cl ON cl.id = pt.club_id
WHERE pt.id = ?
LIMIT 1`, id)

	var p domain.Player
	var countryRowID int64
	var clubRowID int64
	var avatar sql.NullString
	var createdAt sql.NullTime
	if err := row.Scan(
		&p.ID,
		&p.Name,
		&p.CountryID,
		&p.ClubID,
		&avatar,
		&countryRowID,
		&p.Country.Name,
		&p.Country.Code,
		&p.Country.Flag,
		&clubRowID,
		&p.Club.Name,
		&p.Club.Logo,
		&p.BaseClub,
		&p.Season,
		&p.Shooting,
		&p.Passing,
		&p.LongPass,
		&p.Vision,
		&p.GKReach,
		&p.AttAwareness,
		&p.DefAwareness,
		&p.GKParrying,
		&p.GKReflex,
		&p.Duels,
		&p.Pace,
		&p.Stamina,
		&p.Balance,
		&p.Technique,
		&p.Determination,
		&p.Strength,
		&p.StandingTackle,
		&p.SlidingTackle,
		&p.Dribbling,
		&p.Curve,
		&createdAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Player{}, errors.New("player not found")
		}
		return domain.Player{}, err
	}
	if avatar.Valid {
		avatarValue := avatar.String
		p.Avatar = &avatarValue
	}
	if createdAt.Valid {
		p.CreatedAt = createdAt.Time
	}

	if countryRowID > 0 {
		p.Country.ID = countryRowID
	}
	if clubRowID > 0 {
		p.Club.ID = clubRowID
	}

	tmp := []domain.Player{p}
	if err := r.loadPlayerSkills(ctx, &tmp, []int64{p.ID}); err != nil {
		return domain.Player{}, err
	}
	if len(tmp) > 0 {
		p = tmp[0]
	}

	return p, nil
}

func (r *Repository) ListCountries(ctx context.Context) ([]domain.Country, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		out := make([]domain.Country, len(r.memCountries))
		copy(out, r.memCountries)
		return out, nil
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT id, name, COALESCE(code, ''), COALESCE(flag, '')
FROM countries
ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.Country, 0, 64)
	for rows.Next() {
		var item domain.Country
		if err := rows.Scan(&item.ID, &item.Name, &item.Code, &item.Flag); err != nil {
			return nil, err
		}
		out = append(out, item)
	}

	return out, rows.Err()
}

func (r *Repository) CreateCountry(ctx context.Context, input domain.Country) (domain.Country, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		input.ID = r.nextCountryID
		r.nextCountryID++
		r.memCountries = append([]domain.Country{input}, r.memCountries...)
		return input, nil
	}

	if err := r.ensureTable(ctx); err != nil {
		return domain.Country{}, err
	}

	result, err := r.db.ExecContext(ctx, `
INSERT INTO countries (name, code, flag)
VALUES (?, ?, ?)`, input.Name, input.Code, input.Flag)
	if err != nil {
		return domain.Country{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return domain.Country{}, err
	}
	input.ID = id
	return input, nil
}

func (r *Repository) CreateClub(ctx context.Context, input domain.Club) (domain.Club, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		input.ID = r.nextClubID
		r.nextClubID++
		r.memClubs = append([]domain.Club{input}, r.memClubs...)
		return input, nil
	}

	if err := r.ensureTable(ctx); err != nil {
		return domain.Club{}, err
	}

	result, err := r.db.ExecContext(ctx, `
INSERT INTO clubs (name, logo, country_id, league_name)
VALUES (?, ?, ?, ?)`, input.Name, input.Logo, input.CountryID, input.LeagueName)
	if err != nil {
		return domain.Club{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return domain.Club{}, err
	}
	input.ID = id
	return input, nil
}

func (r *Repository) Create(ctx context.Context, input domain.Player) (domain.Player, error) {
	input.CreatedAt = time.Now()

	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		input.ID = r.nextID
		r.nextID++
		r.memData = append([]domain.Player{input}, r.memData...)
		return input, nil
	}

	if err := r.ensureTable(ctx); err != nil {
		return domain.Player{}, err
	}

	if input.CountryID > 0 {
		countryRow := r.db.QueryRowContext(ctx, `
SELECT id, name, COALESCE(code, ''), COALESCE(flag, '')
FROM countries
WHERE id = ?
LIMIT 1`, input.CountryID)
		if err := countryRow.Scan(&input.Country.ID, &input.Country.Name, &input.Country.Code, &input.Country.Flag); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return domain.Player{}, errors.New("country not found")
			}
			return domain.Player{}, err
		}
	}

	if input.ClubID > 0 {
		clubRow := r.db.QueryRowContext(ctx, `
SELECT id, name, COALESCE(logo, '')
FROM clubs
WHERE id = ?
LIMIT 1`, input.ClubID)
		if err := clubRow.Scan(&input.Club.ID, &input.Club.Name, &input.Club.Logo); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return domain.Player{}, errors.New("club not found")
			}
			return domain.Player{}, err
		}
		input.BaseClub = input.Club.Name
	}

	result, err := r.db.ExecContext(ctx, `
INSERT INTO player_templates (
  name, height_cm, country_id, club_id, base_club, season, image_url,
	base_shooting, base_passing, base_long_pass, base_vision, base_gk_reach, base_counter_attack_awareness, base_defending, base_gk_parrying, base_gk_reflex, base_duels, base_pace, base_stamina, base_balance, base_technique, base_determination, base_physical, base_standing_tackle, base_sliding_tackle, base_dribbling, base_curve
) VALUES (?, 170, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
		input.Name,
		input.CountryID,
		input.ClubID,
		input.BaseClub,
		input.Season,
		avatarValue(input.Avatar),
		input.Shooting,
		input.Passing,
		input.LongPass,
		input.Vision,
		input.GKReach,
		input.AttAwareness,
		input.DefAwareness,
		input.GKParrying,
		input.GKReflex,
		input.Duels,
		input.Pace,
		input.Stamina,
		input.Balance,
		input.Technique,
		input.Determination,
		input.Strength,
		input.StandingTackle,
		input.SlidingTackle,
		input.Dribbling,
		input.Curve,
	)
	if err != nil {
		return domain.Player{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return domain.Player{}, err
	}
	input.ID = id

	if loaded, err := r.GetByID(ctx, input.ID); err == nil {
		return loaded, nil
	}

	return input, nil
}

func avatarValue(value *string) sql.NullString {
	if value == nil {
		return sql.NullString{}
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: trimmed, Valid: true}
}

func (r *Repository) ListSkills(ctx context.Context) ([]domain.SpecialSkill, error) {
	if r.db == nil {
		return []domain.SpecialSkill{}, nil
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT id, name, COALESCE(icon_url, ''), buff_type, buff_value, created_at
FROM skills
ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.SpecialSkill, 0, 64)
	for rows.Next() {
		var item domain.SpecialSkill
		var createdAt sql.NullTime
		if err := rows.Scan(&item.ID, &item.Name, &item.IconURL, &item.BuffType, &item.BuffValue, &createdAt); err != nil {
			return nil, err
		}
		if createdAt.Valid {
			item.CreatedAt = createdAt.Time
		}
		out = append(out, item)
	}

	return out, rows.Err()
}

func (r *Repository) CreateSkill(ctx context.Context, input domain.SpecialSkill) (domain.SpecialSkill, error) {
	if r.db == nil {
		return domain.SpecialSkill{}, errors.New("database is not configured")
	}

	result, err := r.db.ExecContext(ctx, `
INSERT INTO skills (name, icon_url, buff_type, buff_value)
VALUES (?, ?, ?, ?)`, input.Name, input.IconURL, input.BuffType, input.BuffValue)
	if err != nil {
		return domain.SpecialSkill{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return domain.SpecialSkill{}, err
	}
	input.ID = id
	input.CreatedAt = time.Now()
	return input, nil
}

func (r *Repository) AssignSkillToPlayer(ctx context.Context, playerID int64, skillName string) (domain.Player, error) {
	if r.db == nil {
		return domain.Player{}, errors.New("database is not configured")
	}

	var existingSkillID int64
	if err := r.db.QueryRowContext(ctx, `SELECT id FROM skills WHERE name = ? LIMIT 1`, skillName).Scan(&existingSkillID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Player{}, errors.New("skill not found")
		}
		return domain.Player{}, err
	}

	var existingPlayerID int64
	if err := r.db.QueryRowContext(ctx, `SELECT id FROM player_templates WHERE id = ? LIMIT 1`, playerID).Scan(&existingPlayerID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Player{}, errors.New("player not found")
		}
		return domain.Player{}, err
	}

	if _, err := r.db.ExecContext(ctx, `
INSERT IGNORE INTO player_skills (player_id, skill_id)
VALUES (?, ?)`, playerID, existingSkillID); err != nil {
		return domain.Player{}, err
	}

	updated, err := r.GetByID(ctx, playerID)
	if err != nil {
		return domain.Player{}, err
	}
	return updated, nil
}

func (r *Repository) ensureTable(ctx context.Context) error {
	r.ensureOnce.Do(func() {
		if r.db == nil {
			return
		}

		queries := []string{
			`CREATE TABLE IF NOT EXISTS player_skills (
				id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
				player_id BIGINT UNSIGNED NOT NULL,
				skill_id BIGINT UNSIGNED NOT NULL,
				created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (id),
				UNIQUE KEY uk_player_skills_player_skill (player_id, skill_id),
				KEY idx_player_skills_player_id (player_id),
				KEY idx_player_skills_skill_id (skill_id),
				CONSTRAINT fk_player_skills_player FOREIGN KEY (player_id) REFERENCES player_templates(id) ON DELETE CASCADE,
				CONSTRAINT fk_player_skills_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
			) ENGINE=InnoDB`,
		}

		for _, query := range queries {
			if _, err := r.db.ExecContext(ctx, query); err != nil {
				r.ensureErr = err
				return
			}
		}
	})

	return r.ensureErr
}

func (r *Repository) loadPlayerSkills(ctx context.Context, players *[]domain.Player, playerIDs []int64) error {
	if players == nil {
		return nil
	}
	if len(*players) == 0 || len(playerIDs) == 0 || r.db == nil {
		return nil
	}

	placeholders := make([]string, 0, len(playerIDs))
	args := make([]any, 0, len(playerIDs))
	for _, id := range playerIDs {
		placeholders = append(placeholders, "?")
		args = append(args, id)
	}

	query := fmt.Sprintf(`
SELECT ps.player_id, s.id, s.name, COALESCE(s.icon_url, ''), s.buff_type, s.buff_value, s.created_at
FROM player_skills ps
INNER JOIN skills s ON s.id = ps.skill_id
WHERE ps.player_id IN (%s)
ORDER BY ps.player_id ASC, s.name ASC`, strings.Join(placeholders, ","))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	skillMap := make(map[int64][]domain.SpecialSkill, len(playerIDs))
	for rows.Next() {
		var playerID int64
		var skill domain.SpecialSkill
		var createdAt sql.NullTime
		if err := rows.Scan(&playerID, &skill.ID, &skill.Name, &skill.IconURL, &skill.BuffType, &skill.BuffValue, &createdAt); err != nil {
			return err
		}
		if createdAt.Valid {
			skill.CreatedAt = createdAt.Time
		}
		skillMap[playerID] = append(skillMap[playerID], skill)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for i := range *players {
		skills := skillMap[(*players)[i].ID]
		(*players)[i].Skills = skills
		names := make([]string, 0, len(skills))
		for _, skill := range skills {
			names = append(names, skill.Name)
		}
		(*players)[i].SpecialSkill = strings.Join(names, ", ")
	}

	return nil
}

func parseSkillNames(raw string) []string {
	parts := strings.Split(raw, ",")
	set := make(map[string]struct{}, len(parts))
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, exists := set[key]; exists {
			continue
		}
		set[key] = struct{}{}
		out = append(out, trimmed)
	}
	return out
}
