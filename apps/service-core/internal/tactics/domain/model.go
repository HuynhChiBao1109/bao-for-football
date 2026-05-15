package domain

import "time"

type Config struct {
	TeamID    string    `json:"teamId"`
	Formation string    `json:"formation"`
	PassRatio float64   `json:"passRatio"`
	ShotRatio float64   `json:"shotRatio"`
	Pressure  float64   `json:"pressure"`
	UpdatedAt time.Time `json:"updatedAt"`
}
