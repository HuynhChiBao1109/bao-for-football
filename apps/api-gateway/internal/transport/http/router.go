package http

import (
	"net/http"

	"fifam/apps/api-gateway/internal/middleware"
	ssetransport "fifam/apps/api-gateway/internal/transport/sse"
	wstransport "fifam/apps/api-gateway/internal/transport/ws"

	"github.com/gin-gonic/gin"
)

func NewRouter() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)

	router := gin.New()
	router.Use(gin.Recovery(), middleware.CORS())

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"service": "api-gateway", "status": "ok"})
	})

	router.GET("/ws", wstransport.Handle)
	router.GET("/sse/match", ssetransport.Handle)

	return router
}
