package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

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
		errors.Is(err, rules.ErrTeamAlreadyInTournament),
		errors.Is(err, rules.ErrPlayerAlreadyInTeam),
		errors.Is(err, rules.ErrPlayerInDifferentTeam):
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

func (h *Handler) UpdateTournamentConfig(c *gin.Context) {
	var req models.UpdateTournamentConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request: " + err.Error()})
		return
	}

	tournament, err := h.tournamentSvc.UpdateConfig(c.Param("id"), req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, tournament)
}

func (h *Handler) IsTournamentLocked(c *gin.Context) {
	isLocked, err := h.tournamentSvc.IsLocked(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"is_locked": isLocked})
}

func (h *Handler) GetLeaderboard(c *gin.Context) {
	leaderboard, err := h.tournamentSvc.GetLeaderboard(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, leaderboard)
}

func (h *Handler) RecalculateLeaderboard(c *gin.Context) {
	err := h.tournamentSvc.RecalculateLeaderboard(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Leaderboard recalculated successfully",
	})
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

func (h *Handler) GetTeamPlayersInTournament(c *gin.Context) {
	players, err := h.playerSvc.GetTeamPlayersInTournament(
		c.Param("id"),
		c.Param("teamId"),
	)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, players)
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

func (h *Handler) CreatePlayer(c *gin.Context) {
	var req models.CreatePlayerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request: " + err.Error()})
		return
	}

	player, err := h.playerSvc.Create(req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, player)
}

func (h *Handler) ListPlayers(c *gin.Context) {
	sportType := c.Query("sport_type")

	var players []models.Player
	var err error

	if sportType != "" {
		players, err = h.playerSvc.GetBySportType(sportType)
	} else {
		players, err = h.playerSvc.GetAll()
	}

	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, players)
}

func (h *Handler) GetPlayer(c *gin.Context) {
	player, err := h.playerSvc.GetProfile(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, player)
}

func (h *Handler) AddPlayerToTeamInTournament(c *gin.Context) {
	var req models.AddPlayerToTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request: " + err.Error()})
		return
	}

	err := h.playerSvc.AddToTeamInTournament(
		c.Param("id"),
		c.Param("teamId"),
		req.PlayerID,
	)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Player added to team successfully",
	})
}

func (h *Handler) RemovePlayerFromTeamInTournament(c *gin.Context) {
	err := h.playerSvc.RemoveFromTeamInTournament(
		c.Param("id"),
		c.Param("teamId"),
		c.Param("playerId"),
	)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Player removed from team successfully",
	})
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

func (h *Handler) UpdateMatch(c *gin.Context) {
	var req models.UpdateMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request: " + err.Error()})
		return
	}

	match, err := h.matchSvc.Update(c.Param("id"), req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, match)
}

func (h *Handler) DeleteMatch(c *gin.Context) {
	err := h.matchSvc.Delete(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Match deleted successfully"})
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
	CheckOrigin: func(r *http.Request) bool {

		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
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

	messageHandler := func(client *scoring.Client, message []byte) {
		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("[WebSocket] Error parsing message: %v", err)
			return
		}

		msgType, ok := msg["type"].(string)
		if !ok {
			log.Printf("[WebSocket] Invalid message type")
			return
		}

		switch msgType {
		case "RECORD_EVENT":

			eventType, _ := msg["event_type"].(string)
			eventData, _ := msg["event_data"].(map[string]interface{})

			if eventType == "" {
				log.Printf("[WebSocket] Missing event_type in RECORD_EVENT message")
				return
			}

			_, _, err := h.matchSvc.RecordEvent(matchIDStr, eventType, eventData)
			if err != nil {

				errorMsg := scoring.WSMessage{
					Type:      scoring.MsgTypeError,
					MatchID:   matchID.String(),
					Payload:   map[string]interface{}{"message": err.Error()},
					Timestamp: time.Now().UnixMilli(),
				}
				if data, err := json.Marshal(errorMsg); err == nil {
					client.Send <- data
				}
				return
			}

		case "GET_EVENTS":

			events, err := h.matchSvc.GetEvents(matchIDStr)
			if err == nil {
				eventsMsg := scoring.WSMessage{
					Type:      scoring.MsgTypeEventsList,
					MatchID:   matchID.String(),
					Payload:   events,
					Timestamp: time.Now().UnixMilli(),
				}
				if data, err := json.Marshal(eventsMsg); err == nil {
					client.Send <- data
				}
			}
		}
	}

	client := hub.RegisterClient(conn, matchID, messageHandler)

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

	events, err := h.matchSvc.GetEvents(matchIDStr)
	if err == nil {
		eventsMsg := scoring.WSMessage{
			Type:      scoring.MsgTypeEventsList,
			MatchID:   matchID.String(),
			Payload:   events,
			Timestamp: time.Now().UnixMilli(),
		}
		if data, err := json.Marshal(eventsMsg); err == nil {
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

func (h *Handler) GetAvailablePlayersForTournament(c *gin.Context) {
	players, err := h.playerSvc.GetAvailablePlayersForTournament(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, players)
}

func (h *Handler) GetMatchStats(c *gin.Context) {
	stats, err := h.matchSvc.GetMatchStats(c.Param("id"))
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, stats)
}

func (h *Handler) UpdatePlayer(c *gin.Context) {
	var req models.UpdatePlayerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid request: " + err.Error()})
		return
	}

	playerID := c.Param("id")
	var player *models.Player
	var err error

	if req.Name != "" {
		player, err = h.playerSvc.UpdateName(playerID, req.Name)
		if err != nil {
			h.handleError(c, err)
			return
		}
	}

	if req.Role != "" || (req.Role == "" && req.Name == "") {

		if player == nil {
			player, err = h.playerSvc.GetByID(playerID)
			if err != nil {
				h.handleError(c, err)
				return
			}
		}
		player, err = h.playerSvc.UpdateRole(playerID, req.Role)
		if err != nil {
			h.handleError(c, err)
			return
		}
	}

	if player == nil {
		player, err = h.playerSvc.GetByID(playerID)
		if err != nil {
			h.handleError(c, err)
			return
		}
	}

	c.JSON(http.StatusOK, player)
}
