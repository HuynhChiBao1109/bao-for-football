package mysql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"time"

	"fifam/apps/service-core/internal/auth/domain"

	"golang.org/x/crypto/bcrypt"
)

type Repository struct {
	db         *sql.DB
	ensureOnce sync.Once
	ensureErr  error
	memMu      sync.Mutex
	memData    map[string]domain.User
	memTeams   map[uint64]domain.ClubOption
	nextID     uint64
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{
		db:       db,
		memData:  make(map[string]domain.User),
		memTeams: make(map[uint64]domain.ClubOption),
		nextID:   1,
	}
}

func (r *Repository) EnsureUserTable(ctx context.Context) error {
	if r.db == nil {
		return nil
	}

	r.ensureOnce.Do(func() {
		_, r.ensureErr = r.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB`)
	})
	return r.ensureErr
}

func (r *Repository) ListRegistrationClubs(ctx context.Context) ([]domain.ClubOption, error) {
	if r.db == nil {
		return defaultClubs(), nil
	}

	if err := r.EnsureUserTable(ctx); err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT id, name, formation, budget, league_name
FROM clubs
ORDER BY id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	clubs := make([]domain.ClubOption, 0, 4)
	for rows.Next() {
		var club domain.ClubOption
		if err := rows.Scan(
			&club.ID,
			&club.Name,
			&club.Formation,
			&club.Budget,
			&club.LeagueName,
		); err != nil {
			return nil, err
		}
		clubs = append(clubs, club)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(clubs) == 0 {
		return defaultClubs(), nil
	}

	return clubs, nil
}

func (r *Repository) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		user, ok := r.memData[username]
		if !ok {
			return nil, nil
		}
		copyUser := user
		return &copyUser, nil
	}

	if err := r.EnsureUserTable(ctx); err != nil {
		return nil, err
	}

	var user domain.User
	err := r.db.QueryRowContext(ctx, `
SELECT id, username, password_hash, created_at
FROM users
WHERE username = ?
LIMIT 1`, username).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&user.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return &user, nil
}

func (r *Repository) Create(ctx context.Context, username, password string) (domain.User, error) {
	if err := r.EnsureUserTable(ctx); err != nil {
		return domain.User{}, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return domain.User{}, err
	}

	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		if _, exists := r.memData[username]; exists {
			return domain.User{}, errors.New("username already exists")
		}
		user := domain.User{ID: r.nextID, Username: username, PasswordHash: string(hash), CreatedAt: time.Now()}
		r.nextID++
		r.memData[username] = user
		return user, nil
	}

	result, err := r.db.ExecContext(ctx, `
INSERT INTO users (username, password_hash)
VALUES (?, ?)`, username, string(hash))
	if err != nil {
		return domain.User{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return domain.User{}, err
	}

	return domain.User{ID: uint64(id), Username: username, PasswordHash: string(hash), CreatedAt: time.Now()}, nil
}

func (r *Repository) EnsureAdmin(ctx context.Context, username, password string) error {
	user, err := r.FindByUsername(ctx, username)
	if err != nil {
		return err
	}
	if user != nil {
		return nil
	}

	_, err = r.Create(ctx, username, password)
	return err
}

func (r *Repository) AssignClubToUser(ctx context.Context, userID uint64, clubID int64) error {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		for _, club := range defaultClubs() {
			if club.ID == clubID {
				r.memTeams[userID] = club
				return nil
			}
		}
		return fmt.Errorf("club id %d not found", clubID)
	}

	var clubName string
	var budget int64
	err := r.db.QueryRowContext(ctx, `
SELECT name, budget
FROM clubs
WHERE id = ?
LIMIT 1`, clubID).Scan(&clubName, &budget)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("club id %d not found", clubID)
		}
		return err
	}

	_, err = r.db.ExecContext(ctx, `
INSERT INTO teams (user_id, club_name, budget, rank_point)
VALUES (?, ?, ?, 0)
ON DUPLICATE KEY UPDATE
  club_name = VALUES(club_name),
  budget = VALUES(budget)`,
		userID,
		clubName,
		budget,
	)
	return err
}

func defaultClubs() []domain.ClubOption {
	return []domain.ClubOption{
		{ID: 1, Name: "FC Navy", Formation: "4-3-3", Budget: 120000000, LeagueName: "Premier League"},
		{ID: 2, Name: "Crimson United", Formation: "4-2-3-1", Budget: 115000000, LeagueName: "Premier League"},
		{ID: 3, Name: "Golden Phoenix", Formation: "3-5-2", Budget: 110000000, LeagueName: "Championship"},
	}
}
