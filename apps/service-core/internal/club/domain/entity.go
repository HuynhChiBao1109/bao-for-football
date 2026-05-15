package domain

type Club struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Formation  string `json:"formation"`
	Budget     int64  `json:"budget"`
	LeagueName string `json:"leagueName"`
}
