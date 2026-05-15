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

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"service": "service-realtime", "status": "ok"})
	})
	router.GET("/ws", handler.Connect)
	router.POST("/api/v1/tactics", handler.UpdateTactics)

	log.Printf("service-realtime listening on %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
