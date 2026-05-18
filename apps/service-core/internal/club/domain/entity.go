package domain

type Club struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Logo       string `json:"logo"`
	CountryID  *int64 `json:"countryId,omitempty"`
	LeagueID   *int64 `json:"leagueId,omitempty"`
	Budget     int64  `json:"budget"`
	LeagueName string `json:"leagueName"`
}
