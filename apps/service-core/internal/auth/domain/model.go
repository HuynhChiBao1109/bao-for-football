package domain

import "time"

type User struct {
	ID           uint64    `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
}

type TeamAssignment struct {
	UserID    uint64 `json:"userId"`
	ClubID    *int64 `json:"clubId,omitempty"`
	ClubName  string `json:"clubName"`
	Budget    int64  `json:"budget"`
	RankPoint int    `json:"rankPoint"`
}

type ClubOption struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Formation  string `json:"formation"`
	Budget     int64  `json:"budget"`
	LeagueName string `json:"leagueName"`
}

type TokenClaims struct {
	UserID   uint64 `json:"userId"`
	Username string `json:"username"`
	IsAdmin  bool   `json:"isAdmin"`
}
