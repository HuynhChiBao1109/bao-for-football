package main

import (
	"log"
	"os"

	"fifam/apps/service-realtime/internal/broadcaster"
	"fifam/apps/service-realtime/internal/hub"
	wshandler "fifam/apps/service-realtime/internal/transport/ws"

	"github.com/gin-gonic/gin"
)

func main() {
	port := os.Getenv("SERVICE_REALTIME_PORT")
	if port == "" {
		port = "8082"
	}

	h := hub.New()
	go h.Run()

	engine := broadcaster.NewMatchEngine(h)
	handler := wshandler.NewHandler(h, engine)

	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"service": "service-realtime", "status": "ok"})
	})
	router.GET("/ws", handler.Connect)
	router.GET("/sse/match", handler.StreamMatchSSE)
	router.POST("/api/v1/tactics", handler.UpdateTactics)
	router.POST("/api/v1/matches/start", handler.StartMatch)

	log.Printf("service-realtime listening on %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
