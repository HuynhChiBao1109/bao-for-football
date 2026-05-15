package usecase

import (
	"errors"
	"regexp"
	"strings"
)

var teamIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,31}$`)

func normalizeTeamID(raw string) (string, error) {
	teamID := strings.ToLower(strings.TrimSpace(raw))
	if teamID == "" {
		return "", errors.New("teamId is required")
	}

	if !teamIDPattern.MatchString(teamID) {
		return "", errors.New("teamId must match ^[a-z0-9][a-z0-9_-]{0,31}$")
	}

	return teamID, nil
}
