package ws

import (
	"net/http"

	"fifam/apps/service-realtime/internal/broadcaster"
	"fifam/apps/service-realtime/internal/hub"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type updateTacticsRequest struct {
	TeamID    string  `json:"teamId"`
	Formation string  `json:"formation"`
	PassRatio float64 `json:"passRatio"`
	ShotRatio float64 `json:"shotRatio"`
	Pressure  float64 `json:"pressure"`
}

type Handler struct {
	hub    *hub.Hub
	engine *broadcaster.MatchEngine
}

func NewHandler(h *hub.Hub, engine *broadcaster.MatchEngine) *Handler {
	return &Handler{hub: h, engine: engine}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(_ *http.Request) bool {
		return true
	},
}

func (h *Handler) Connect(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	h.hub.Register(conn)
	h.engine.EnsureRunning()

	for {
		_, payload, err := conn.ReadMessage()
		if err != nil {
			h.hub.Unregister(conn)
			return
		}
		h.hub.Publish(payload)
	}
}

func (h *Handler) UpdateTactics(c *gin.Context) {
	var req updateTacticsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.engine.UpdateTeamTactics(broadcaster.UpdateTacticsInput{
		TeamID:    req.TeamID,
		Formation: req.Formation,
		PassRatio: req.PassRatio,
		ShotRatio: req.ShotRatio,
		Pressure:  req.Pressure,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "tactics applied to running match"})
}
