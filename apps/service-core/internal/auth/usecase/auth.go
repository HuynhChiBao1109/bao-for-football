package usecase

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"fifam/apps/service-core/internal/auth/domain"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type repository interface {
	EnsureUserTable(ctx context.Context) error
	FindByUsername(ctx context.Context, username string) (*domain.User, error)
	Create(ctx context.Context, username, password string) (domain.User, error)
	EnsureAdmin(ctx context.Context, username, password string) error
	ListRegistrationClubs(ctx context.Context) ([]domain.ClubOption, error)
	AssignClubToUser(ctx context.Context, userID uint64, clubID int64, clubName string) error
	GetTeamAssignment(ctx context.Context, userID uint64) (*domain.TeamAssignment, error)
}

type AuthUseCase struct {
	repo repository
}

func NewAuthUseCase(repo repository) *AuthUseCase {
	return &AuthUseCase{repo: repo}
}

type TokenPair struct {
	AccessToken string `json:"accessToken"`
}

type UserInfo struct {
	ID       uint64 `json:"id"`
	Username string `json:"username"`
	IsAdmin  bool   `json:"isAdmin"`
}

type SessionInfo struct {
	User UserInfo               `json:"user"`
	Team *domain.TeamAssignment `json:"team,omitempty"`
}

func (u *AuthUseCase) EnsureAdmin(ctx context.Context) error {
	return u.repo.EnsureAdmin(ctx, adminUsername(), adminPassword())
}

func (u *AuthUseCase) ListRegistrationClubs(ctx context.Context) ([]domain.ClubOption, error) {
	return u.repo.ListRegistrationClubs(ctx)
}

func (u *AuthUseCase) Register(ctx context.Context, username, password, clubName string, clubID int64) (UserInfo, error) {
	username = strings.TrimSpace(username)
	password = strings.TrimSpace(password)
	clubName = strings.TrimSpace(clubName)
	if username == "" || password == "" {
		return UserInfo{}, errors.New("username and password are required")
	}
	if clubName == "" {
		return UserInfo{}, errors.New("clubName is required")
	}
	if len(clubName) > 100 {
		return UserInfo{}, errors.New("clubName must be at most 100 characters")
	}
	if len(password) < 4 {
		return UserInfo{}, errors.New("password must be at least 4 characters")
	}
	if username == adminUsername() {
		return UserInfo{}, errors.New("reserved username")
	}

	clubs, err := u.repo.ListRegistrationClubs(ctx)
	if err != nil {
		return UserInfo{}, err
	}
	if len(clubs) == 0 {
		return UserInfo{}, errors.New("no clubs available for registration")
	}

	if clubID == 0 {
		clubID = clubs[0].ID
	}

	clubExists := false
	for _, club := range clubs {
		if club.ID == clubID {
			clubExists = true
			break
		}
	}
	if !clubExists {
		return UserInfo{}, errors.New("invalid clubId")
	}

	user, err := u.repo.Create(ctx, username, password)
	if err != nil {
		return UserInfo{}, err
	}

	if err := u.repo.AssignClubToUser(ctx, user.ID, clubID, clubName); err != nil {
		return UserInfo{}, err
	}

	return UserInfo{ID: user.ID, Username: user.Username, IsAdmin: false}, nil
}

func (u *AuthUseCase) Login(ctx context.Context, username, password string) (TokenPair, UserInfo, error) {
	username = strings.TrimSpace(username)
	password = strings.TrimSpace(password)

	if username == "" || password == "" {
		return TokenPair{}, UserInfo{}, errors.New("username and password are required")
	}
	if username == adminUsername() {
		return TokenPair{}, UserInfo{}, errors.New("admin must use /admin/login")
	}

	user, err := u.repo.FindByUsername(ctx, username)
	if err != nil {
		return TokenPair{}, UserInfo{}, err
	}
	if user == nil {
		return TokenPair{}, UserInfo{}, errors.New("invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return TokenPair{}, UserInfo{}, errors.New("invalid credentials")
	}

	token, err := signToken(domain.TokenClaims{
		UserID:   user.ID,
		Username: user.Username,
		IsAdmin:  false,
	})
	if err != nil {
		return TokenPair{}, UserInfo{}, err
	}

	return TokenPair{AccessToken: token}, UserInfo{ID: user.ID, Username: user.Username, IsAdmin: false}, nil
}

func (u *AuthUseCase) AdminLogin(ctx context.Context, username, password string) (TokenPair, UserInfo, error) {
	username = strings.TrimSpace(username)
	password = strings.TrimSpace(password)

	if username != adminUsername() {
		return TokenPair{}, UserInfo{}, errors.New("invalid admin credentials")
	}

	user, err := u.repo.FindByUsername(ctx, username)
	if err != nil {
		return TokenPair{}, UserInfo{}, err
	}
	if user == nil {
		return TokenPair{}, UserInfo{}, errors.New("admin account not found")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return TokenPair{}, UserInfo{}, errors.New("invalid admin credentials")
	}

	token, err := signToken(domain.TokenClaims{
		UserID:   user.ID,
		Username: user.Username,
		IsAdmin:  true,
	})
	if err != nil {
		return TokenPair{}, UserInfo{}, err
	}

	return TokenPair{AccessToken: token}, UserInfo{ID: user.ID, Username: user.Username, IsAdmin: true}, nil
}

func (u *AuthUseCase) GetSession(ctx context.Context, userID uint64, username string, isAdmin bool) (SessionInfo, error) {
	team, err := u.repo.GetTeamAssignment(ctx, userID)
	if err != nil {
		return SessionInfo{}, err
	}

	if team != nil {
		team.TacticsTeamID = buildTacticsTeamID(userID)
	}

	return SessionInfo{
		User: UserInfo{
			ID:       userID,
			Username: username,
			IsAdmin:  isAdmin,
		},
		Team: team,
	}, nil
}

func buildTacticsTeamID(userID uint64) string {
	return fmt.Sprintf("user-%d", userID)
}

func (u *AuthUseCase) ValidateToken(tokenString string) (*domain.TokenClaims, error) {
	claims := &jwt.MapClaims{}
	parsedToken, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		return []byte(jwtSecret()), nil
	})
	if err != nil || !parsedToken.Valid {
		return nil, errors.New("invalid token")
	}

	userID := uint64((*claims)["userId"].(float64))
	username, _ := (*claims)["username"].(string)
	isAdmin, _ := (*claims)["isAdmin"].(bool)

	return &domain.TokenClaims{UserID: userID, Username: username, IsAdmin: isAdmin}, nil
}

func signToken(claims domain.TokenClaims) (string, error) {
	mapped := jwt.MapClaims{
		"userId":   claims.UserID,
		"username": claims.Username,
		"isAdmin":  claims.IsAdmin,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, mapped).SignedString([]byte(jwtSecret()))
}

func jwtSecret() string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "fifam-dev-secret"
	}
	return secret
}

func adminUsername() string {
	username := os.Getenv("ADMIN_USERNAME")
	if username == "" {
		username = "admin"
	}
	return username
}

func adminPassword() string {
	password := os.Getenv("ADMIN_PASSWORD")
	if password == "" {
		password = "admin123"
	}
	return password
}
