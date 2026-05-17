package ws

import (
	"fmt"
	"net/http"

	"fifam/apps/service-core/internal/realtime/broadcaster"
	"fifam/apps/service-core/internal/realtime/hub"
	"fifam/apps/service-core/internal/realtime/rooms"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type updateTacticsRequest struct {
	TeamID    string  `json:"teamId"`
	Formation string  `json:"formation"`
	PassRatio float64 `json:"passRatio"`
	ShotRatio float64 `json:"shotRatio"`
	Pressure  float64 `json:"pressure"`
	Mode      string  `json:"mode"`
	Gameplay  struct {
		PassSpeedScale     float64 `json:"passSpeedScale"`
		InterceptionRadius float64 `json:"interceptionRadius"`
		GKBuildUpBias      float64 `json:"gkBuildUpBias"`
		TempoScale         float64 `json:"tempoScale"`
	} `json:"gameplay"`
	Players []struct {
		CardID         uint64 `json:"cardId"`
		Pace           int    `json:"pace"`
		Passing        int    `json:"passing"`
		LongPass       int    `json:"longPass"`
		Vision         int    `json:"vision"`
		Shooting       int    `json:"shooting"`
		Defending      int    `json:"defending"`
		StandingTackle int    `json:"standingTackle"`
		SlidingTackle  int    `json:"slidingTackle"`
		Mental         int    `json:"mental"`
	} `json:"players"`
}

type startMatchRequest struct {
	MatchID string `json:"matchId"`
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

	for {
		_, payload, err := conn.ReadMessage()
		if err != nil {
			h.hub.Unregister(conn)
			return
		}
		h.hub.Publish(payload)
	}
}

func (h *Handler) StreamMatchSSE(c *gin.Context) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "streaming unsupported"})
		return
	}

	subscriber := h.hub.RegisterSSE()
	defer h.hub.UnregisterSSE(subscriber)

	if _, err := fmt.Fprint(c.Writer, ": connected\n\n"); err != nil {
		return
	}
	flusher.Flush()

	ctx := c.Request.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case payload, ok := <-subscriber:
			if !ok {
				return
			}

			if _, err := fmt.Fprintf(c.Writer, "event: match_tick\ndata: %s\n\n", payload); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func (h *Handler) StartMatch(c *gin.Context) {
	var req startMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.engine.StartMatch(req.MatchID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "match started", "matchId": req.MatchID})
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
		Mode:      req.Mode,
		Gameplay: broadcaster.GameplayTuningInput{
			PassSpeedScale:     req.Gameplay.PassSpeedScale,
			InterceptionRadius: req.Gameplay.InterceptionRadius,
			GKBuildUpBias:      req.Gameplay.GKBuildUpBias,
			TempoScale:         req.Gameplay.TempoScale,
		},
		Players: mapPlayers(req.Players),
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "tactics accepted"})
}

func mapPlayers(input []struct {
	CardID         uint64 `json:"cardId"`
	Pace           int    `json:"pace"`
	Passing        int    `json:"passing"`
	LongPass       int    `json:"longPass"`
	Vision         int    `json:"vision"`
	Shooting       int    `json:"shooting"`
	Defending      int    `json:"defending"`
	StandingTackle int    `json:"standingTackle"`
	SlidingTackle  int    `json:"slidingTackle"`
	Mental         int    `json:"mental"`
}) []rooms.PlayerStatsInput {
	if len(input) == 0 {
		return nil
	}

	out := make([]rooms.PlayerStatsInput, 0, len(input))
	for _, p := range input {
		out = append(out, rooms.PlayerStatsInput{
			CardID:         p.CardID,
			Pace:           p.Pace,
			Passing:        p.Passing,
			LongPass:       p.LongPass,
			Vision:         p.Vision,
			Shooting:       p.Shooting,
			Defending:      p.Defending,
			StandingTackle: p.StandingTackle,
			SlidingTackle:  p.SlidingTackle,
			Mental:         p.Mental,
		})
	}

	return out
}
