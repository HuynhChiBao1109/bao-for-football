package domain

import "time"

const (
	BannerStatusRunning   = 1
	BannerStatusScheduled = 2
	BannerStatusPaused    = 3
	BannerStatusExpired   = 4
)

type BannerConfig struct {
	ID             uint64     `json:"id"`
	BannerCode     string     `json:"bannerCode"`
	BannerName     string     `json:"bannerName"`
	BannerImageURL string     `json:"bannerImageUrl"`
	PlayerID       int64      `json:"playerId"`
	ExpiredAt      *time.Time `json:"expiredAt,omitempty"`
	Status         int        `json:"status"`
	StatusLabel    string     `json:"statusLabel,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}

func BannerStatusText(status int) string {
	switch status {
	case BannerStatusRunning:
		return "running"
	case BannerStatusScheduled:
		return "scheduled"
	case BannerStatusPaused:
		return "paused"
	case BannerStatusExpired:
		return "expired"
	default:
		return "unknown"
	}
}
