package main

import (
	"log"

	"gameheros/internal/config"
	"gameheros/internal/db"
	"gameheros/internal/router"

	"github.com/gin-gonic/gin"
)

func main() {

	cfg := config.Load()

	database, err := db.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := router.SetupRouter(database, cfg)

	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
