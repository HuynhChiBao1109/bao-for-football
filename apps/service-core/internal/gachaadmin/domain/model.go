package domain

import "time"

type BannerConfig struct {
	ID             uint64    `json:"id"`
	BannerCode     string    `json:"bannerCode"`
	BannerName     string    `json:"bannerName"`
	BannerImageURL string    `json:"bannerImageUrl"`
	PlayerID       int64     `json:"playerId"`
	CreatedAt      time.Time `json:"createdAt"`
}
