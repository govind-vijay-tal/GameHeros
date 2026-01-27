package rules

import "errors"

var (
	ErrInvalidSportType      = errors.New("invalid sport type. Must be CRICKET, FOOTBALL, or BADMINTON")
	ErrDuplicateTournament   = errors.New("tournament with this name already exists")
	ErrTournamentNotFound    = errors.New("tournament not found")
	ErrTournamentCompleted   = errors.New("cannot modify a completed tournament")
	ErrDuplicateTeam         = errors.New("team with this name or short code already exists")
	ErrTeamNotFound          = errors.New("team not found")
	ErrTeamAlreadyInTournament = errors.New("team is already part of this tournament")
	ErrTeamsNotInTournament  = errors.New("one or both teams are not part of this tournament")
	ErrTeamNotInTournament   = errors.New("team is not part of this tournament")
	ErrInvalidTeamID         = errors.New("invalid team ID format")
	ErrInvalidTournamentID   = errors.New("invalid tournament ID format")
	ErrInvalidMatchID        = errors.New("invalid match ID format")
	ErrInvalidPlayerID       = errors.New("invalid player ID format")
	ErrTeamPlayAgainstItself = errors.New("a team cannot play against itself")
	ErrTeamsNotFound         = errors.New("one or both teams not found")
	ErrDuplicateMatchSameDay = errors.New("a match between these teams is already scheduled for this day")
	ErrMatchNotFound         = errors.New("match not found")
	ErrDuplicatePlayer       = errors.New("player with this name already exists in the team")
	ErrPlayerNotFound        = errors.New("player not found")
	ErrInvalidRole           = errors.New("invalid role. Must be BATTER, BOWLER, ALL_ROUNDER, or WICKET_KEEPER")
	ErrInvalidTimeFormat     = errors.New("invalid start_time format. Use ISO 8601 format (e.g., 2024-01-15T10:00:00Z)")
	ErrNameTooShort          = errors.New("name must be at least 2 characters")
	ErrShortCodeInvalid      = errors.New("short code must be 2-10 characters")
)
