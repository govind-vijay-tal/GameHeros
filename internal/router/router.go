package router

import (
	"gameheros/internal/config"
	"gameheros/internal/handlers"
	"gameheros/internal/middleware"
	"gameheros/internal/repo"
	"gameheros/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
)

func SetupRouter(db *sqlx.DB, cfg *config.Config) *gin.Engine {
	r := gin.Default()

	r.Use(middleware.CORS())
	r.Use(middleware.ErrorHandler())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	tournamentRepo := repo.NewTournamentRepo(db)
	teamRepo := repo.NewTeamRepo(db)
	playerRepo := repo.NewPlayerRepo(db)
	matchRepo := repo.NewMatchRepo(db)
	statsRepo := repo.NewMatchStatsRepo(db)

	statsSvc := services.NewMatchStatsService(statsRepo, matchRepo)
	tournamentSvc := services.NewTournamentService(tournamentRepo, teamRepo)
	teamSvc := services.NewTeamService(teamRepo)
	playerSvc := services.NewPlayerService(playerRepo, teamRepo, tournamentRepo)
	matchSvc := services.NewMatchService(matchRepo, tournamentRepo, teamRepo, playerRepo, statsSvc)

	h := handlers.NewHandler(tournamentSvc, teamSvc, playerSvc, matchSvc)

	api := r.Group("/api")
	{
		tournaments := api.Group("/tournaments")
		{
			tournaments.POST("", h.CreateTournament)
			tournaments.GET("", h.ListTournaments)
			tournaments.GET("/:id", h.GetTournament)
			tournaments.PUT("/:id/config", h.UpdateTournamentConfig)
			tournaments.GET("/:id/locked", h.IsTournamentLocked)
			tournaments.POST("/:id/matches", h.CreateMatch)
			tournaments.GET("/:id/leaderboard", h.GetLeaderboard)
			tournaments.POST("/:id/leaderboard/recalculate", h.RecalculateLeaderboard)
			tournaments.GET("/:id/teams", h.GetTournamentTeams)
			tournaments.POST("/:id/teams", h.AddTeamToTournament)
			tournaments.GET("/:id/available-players", h.GetAvailablePlayersForTournament)
			tournaments.GET("/:id/teams/:teamId/players", h.GetTeamPlayersInTournament)
			tournaments.POST("/:id/teams/:teamId/players", h.AddPlayerToTeamInTournament)
			tournaments.DELETE("/:id/teams/:teamId/players/:playerId", h.RemovePlayerFromTeamInTournament)
		}

		teams := api.Group("/teams")
		{
			teams.POST("", h.CreateTeam)
			teams.GET("", h.ListTeams)
		}

		matches := api.Group("/matches")
		{
			matches.GET("", h.ListMatches)
			matches.GET("/:id", h.GetMatch)
			matches.PUT("/:id", h.UpdateMatch)
			matches.DELETE("/:id", h.DeleteMatch)
			matches.POST("/:id/start", h.StartMatch)
			matches.POST("/:id/end", h.EndMatch)
		}

		api.POST("/matches/:id/events", h.RecordEvent)
		api.GET("/matches/:id/events", h.GetMatchEvents)

		api.GET("/matches/:id/score", h.GetLiveScore)
		api.GET("/matches/:id/stats", h.GetMatchStats)

		players := api.Group("/players")
		{
			players.POST("", h.CreatePlayer)
			players.GET("", h.ListPlayers)
			players.GET("/:id", h.GetPlayer)
			players.PUT("/:id", h.UpdatePlayer)
			players.GET("/:id/profile", h.GetPlayerProfile)
		}
	}

	r.GET("/ws/matches/:id", h.HandleWebSocket)

	return r
}
