package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"gameheros/internal/models"
	"gameheros/internal/rules"
	"gameheros/internal/scoring"
	"gameheros/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Handler struct {
	tournamentSvc *services.TournamentService
	teamSvc       *services.TeamService
	playerSvc     *services.PlayerService
	matchSvc      *services.MatchService
}

func NewHandler(
	tournamentSvc *services.TournamentService,
	teamSvc *services.TeamService,
	playerSvc *services.PlayerService,
	matchSvc *services.MatchService,
) *Handler {
	return &Handler{
		tournamentSvc: tournamentSvc,
		teamSvc:       teamSvc,
		playerSvc:     playerSvc,
		matchSvc:      matchSvc,
	}
}

func (h *Handler) handleError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, rules.ErrInvalidSportType),
		errors.Is(err, rules.ErrInvalidRole),
		errors.Is(err, rules.ErrInvalidTeamID),
		errors.Is(err, rules.ErrInvalidTournamentID),
		errors.Is(err, rules.ErrInvalidMatchID),
		errors.Is(err, rules.ErrInvalidPlayerID),
		errors.Is(err, rules.ErrTeamPlayAgainstItself),
		errors.Is(err, rules.ErrTeamsNotInTournament),
		errors.Is(err, rules.ErrTournamentCompleted),
		errors.Is(err, rules.ErrInvalidTimeFormat),
		errors.Is(err, rules.ErrNameTooShort),
		errors.Is(err, rules.ErrShortCodeInvalid),
		errors.Is(err, rules.ErrInvalidEventType),
		errors.Is(err, rules.ErrMatchNotLive),
		errors.Is(err, rules.ErrMatchAlreadyLive),
		errors.Is(err, rules.ErrMatchAlreadyCompleted):
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})

	case errors.Is(err, rules.ErrTournamentNotFound),
		errors.Is(err, rules.ErrTeamNotFound),
		errors.Is(err, rules.ErrMatchNotFound),
		errors.Is(err, rules.ErrPlayerNotFound),
		errors.Is(err, rules.ErrTeamsNotFound):
		c.JSON(http.StatusNotFound, models.ErrorResponse{Error: err.Error()})

	case errors.Is(err, rules.ErrDuplicateTournament),
		errors.Is(err, rules.ErrDuplicateTeam),
		errors.Is(err, rules.ErrDuplicatePlayer),
		errors.Is(err, rules.ErrDuplicateMatchSameDay),
		errors.Is(err, rules.ErrTeamAlreadyInTournament):
		c.JSON(http.StatusConflict, models.ErrorResponse{Error: err.Error()})

	default:
		log.Printf("[Handler] Unhandled error: %v", err)
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Internal server error"})
	}
}

func (h *Handler) CreateTournament(c *gin.Context) {
	var req models.CreateTournamentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request: " + err.Error()})
		return
	}

	tournament, err := h.tournamentSvc.Create(req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, tournament)
}

func (h *Handler) ListTournaments(c *gin.Context) {
	tournaments, err := h.tournamentSvc.GetAll()
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, tournaments)
}

func (h *Handler) GetTournament(c *gin.Context) {
	tournament, err := h.tournamentSvc.GetByID(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, tournament)
}

func (h *Handler) GetLeaderboard(c *gin.Context) {
	leaderboard, err := h.tournamentSvc.GetLeaderboard(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, leaderboard)
}

func (h *Handler) AddTeamToTournament(c *gin.Context) {
	var req models.AddTeamToTournamentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request: " + err.Error()})
		return
	}

	team, err := h.tournamentSvc.AddTeam(c.Param("id"), req.TeamID)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Team added to tournament successfully",
		"tournament_id": c.Param("id"),
		"team_id":       team.ID,
		"team_name":     team.Name,
		"team_code":     team.ShortCode,
	})
}

func (h *Handler) GetTournamentTeams(c *gin.Context) {
	teams, err := h.tournamentSvc.GetTeams(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, teams)
}

func (h *Handler) CreateTeam(c *gin.Context) {
	var req models.CreateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request: " + err.Error()})
		return
	}

	team, err := h.teamSvc.Create(req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, team)
}

func (h *Handler) ListTeams(c *gin.Context) {
	teams, err := h.teamSvc.GetAll()
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, teams)
}

func (h *Handler) GetTeam(c *gin.Context) {
	team, err := h.teamSvc.GetByID(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, team)
}

func (h *Handler) AddPlayer(c *gin.Context) {
	var req models.AddPlayerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request: " + err.Error()})
		return
	}

	player, err := h.playerSvc.AddToTeam(c.Param("id"), req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, player)
}

func (h *Handler) CreateMatch(c *gin.Context) {
	var req models.CreateMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request: " + err.Error()})
		return
	}

	match, err := h.matchSvc.Create(c.Param("id"), req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, match)
}

func (h *Handler) ListMatches(c *gin.Context) {
	matches, err := h.matchSvc.GetAll()
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, matches)
}

func (h *Handler) GetMatch(c *gin.Context) {
	match, err := h.matchSvc.GetByID(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, match)
}

func (h *Handler) GetMatchEvents(c *gin.Context) {
	events, err := h.matchSvc.GetEvents(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, events)
}

func (h *Handler) GetLiveScore(c *gin.Context) {
	match, err := h.matchSvc.GetLiveScore(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	response := gin.H{
		"match_id":     match.ID,
		"status":       match.Status,
		"team_a":       match.TeamAName,
		"team_a_code":  match.TeamAShortCode,
		"team_b":       match.TeamBName,
		"team_b_code":  match.TeamBShortCode,
		"tournament":   match.TournamentName,
		"score_detail": match.ScoreSummary,
		"is_live":      match.Status == "LIVE",
	}

	if match.ScoreSummary != nil {
		if runs, ok := match.ScoreSummary["runs"]; ok {
			wickets := match.ScoreSummary["wickets"]
			overs := match.ScoreSummary["overs"]
			response["score"] = gin.H{
				"runs":    runs,
				"wickets": wickets,
				"overs":   overs,
			}
		}
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) StartMatch(c *gin.Context) {
	match, state, err := h.matchSvc.StartMatch(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Match started successfully",
		"match":      match,
		"score":      state.GetScore(),
		"live_state": state,
	})
}

func (h *Handler) EndMatch(c *gin.Context) {
	match, state, err := h.matchSvc.EndMatch(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	response := gin.H{
		"message": "Match ended successfully",
		"match":   match,
	}

	if state != nil {
		response["final_score"] = state.GetScore()
		response["final_state"] = state
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) RecordEvent(c *gin.Context) {
	var req models.RecordEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request: " + err.Error()})
		return
	}

	match, state, err := h.matchSvc.RecordEvent(c.Param("id"), req.EventType, req.EventData)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "Event recorded successfully",
		"event_type": req.EventType,
		"score":      state.GetScore(),
		"is_over":    state.IsGameOver(),
		"state":      state,
		"match":      match,
	})
}


var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true 
	},
}


func (h *Handler) HandleWebSocket(c *gin.Context) {
	matchIDStr := c.Param("id")
	matchID, err := uuid.Parse(matchIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid match ID"})
		return
	}

	
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[WebSocket] Upgrade error: %v", err)
		return
	}

	
	hub := scoring.GetHub()
	client := hub.RegisterClient(conn, matchID)

	
	manager := scoring.GetMatchManager()
	if state, err := manager.GetLiveState(matchID); err == nil {
		initialMsg := map[string]interface{}{
			"type":     "INITIAL_STATE",
			"match_id": matchID.String(),
			"state":    state,
			"score":    state.GetScore(),
		}
		if data, err := json.Marshal(initialMsg); err == nil {
			client.Send <- data
		}
	}

	
	go client.WritePump()
	go client.ReadPump()
}

func (h *Handler) GetPlayerProfile(c *gin.Context) {
	profile, err := h.playerSvc.GetProfile(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, profile)
}
