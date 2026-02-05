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

	tournamentSvc := services.NewTournamentService(tournamentRepo, teamRepo)
	teamSvc := services.NewTeamService(teamRepo)
	playerSvc := services.NewPlayerService(playerRepo, teamRepo)
	matchSvc := services.NewMatchService(matchRepo, tournamentRepo, teamRepo)

	h := handlers.NewHandler(tournamentSvc, teamSvc, playerSvc, matchSvc)

	api := r.Group("/api")
	{
		tournaments := api.Group("/tournaments")
		{
			tournaments.POST("", h.CreateTournament)
			tournaments.GET("", h.ListTournaments)
			tournaments.GET("/:id", h.GetTournament)
			tournaments.POST("/:id/matches", h.CreateMatch)
			tournaments.GET("/:id/leaderboard", h.GetLeaderboard)
			tournaments.GET("/:id/teams", h.GetTournamentTeams)
			tournaments.POST("/:id/teams", h.AddTeamToTournament)
		}

		teams := api.Group("/teams")
		{
			teams.POST("", h.CreateTeam)
			teams.GET("", h.ListTeams)
			teams.GET("/:id", h.GetTeam)
			teams.POST("/:id/players", h.AddPlayer)
		}

		matches := api.Group("/matches")
		{
			matches.GET("", h.ListMatches)
			matches.GET("/:id", h.GetMatch)
			matches.POST("/:id/start", h.StartMatch)
			matches.POST("/:id/end", h.EndMatch)
		}

		api.POST("/matches/:id/events", h.RecordEvent)
		api.GET("/matches/:id/events", h.GetMatchEvents)

		api.GET("/matches/:id/score", h.GetLiveScore)
		api.GET("/players/:id/profile", h.GetPlayerProfile)
	}

	r.GET("/ws/matches/:id", h.HandleWebSocket)

	return r
}
