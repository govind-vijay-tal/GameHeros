package rules

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

var validSports = map[string]bool{
	"CRICKET":   true,
	"FOOTBALL":  true,
	"BADMINTON": true,
}

var cricketRoles = map[string]bool{
	"BATTER":        true,
	"BOWLER":        true,
	"ALL_ROUNDER":   true,
	"WICKET_KEEPER": true,
}

var footballRoles = map[string]bool{
	"GOALKEEPER": true,
	"DEFENDER":   true,
	"MIDFIELDER": true,
	"FORWARD":    true,
}

var badmintonRoles = map[string]bool{
	"SINGLES":       true,
	"DOUBLES":       true,
	"MIXED_DOUBLES": true,
}

var validRoles = map[string]bool{

	"BATTER":        true,
	"BOWLER":        true,
	"ALL_ROUNDER":   true,
	"WICKET_KEEPER": true,

	"GOALKEEPER": true,
	"DEFENDER":   true,
	"MIDFIELDER": true,
	"FORWARD":    true,

	"SINGLES":       true,
	"DOUBLES":       true,
	"MIXED_DOUBLES": true,
}

func ValidateSportType(sportType string) error {
	if !validSports[strings.ToUpper(sportType)] {
		return ErrInvalidSportType
	}
	return nil
}

func ValidateRole(role string) error {
	if role == "" {
		return nil
	}
	if !validRoles[strings.ToUpper(role)] {
		return ErrInvalidRole
	}
	return nil
}

func ValidateRoleForSport(role, sportType string) error {
	if role == "" {
		return nil
	}

	normalizedRole := strings.ToUpper(role)
	normalizedSport := strings.ToUpper(sportType)

	switch normalizedSport {
	case "CRICKET":
		if !cricketRoles[normalizedRole] {
			return ErrInvalidRole
		}
	case "FOOTBALL":
		if !footballRoles[normalizedRole] {
			return ErrInvalidRole
		}
	case "BADMINTON":
		if !badmintonRoles[normalizedRole] {
			return ErrInvalidRole
		}
	default:
		return ErrInvalidRole
	}

	return nil
}

func ValidateUUID(id, fieldName string) (uuid.UUID, error) {
	parsed, err := uuid.Parse(id)
	if err != nil {
		switch fieldName {
		case "tournament":
			return uuid.Nil, ErrInvalidTournamentID
		case "team":
			return uuid.Nil, ErrInvalidTeamID
		case "match":
			return uuid.Nil, ErrInvalidMatchID
		case "player":
			return uuid.Nil, ErrInvalidPlayerID
		default:
			return uuid.Nil, err
		}
	}
	return parsed, nil
}

func ValidateName(name string, minLen int) error {
	if len(strings.TrimSpace(name)) < minLen {
		return ErrNameTooShort
	}
	return nil
}

func ValidateShortCode(code string) error {
	trimmed := strings.TrimSpace(code)
	if len(trimmed) < 2 || len(trimmed) > 10 {
		return ErrShortCodeInvalid
	}
	return nil
}

func ParseTime(timeStr string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339, timeStr)
	if err != nil {
		t, err = time.Parse("2006-01-02T15:04:05", timeStr)
		if err != nil {
			return time.Time{}, ErrInvalidTimeFormat
		}
	}
	return t, nil
}

func NormalizeSportType(sportType string) string {
	return strings.ToUpper(strings.TrimSpace(sportType))
}

func NormalizeName(name string) string {
	return strings.TrimSpace(name)
}

func NormalizeShortCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func NormalizeRole(role string) string {
	return strings.ToUpper(strings.TrimSpace(role))
}
