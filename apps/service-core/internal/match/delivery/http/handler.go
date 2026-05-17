package http

import (
	"net/http"

	"fifam/apps/service-core/internal/match/domain"
	matchusecase "fifam/apps/service-core/internal/match/usecase"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	uc *matchusecase.MatchUseCase
}

func NewHandler(uc *matchusecase.MatchUseCase) *Handler {
	return &Handler{uc: uc}
}

type startRequest struct {
	AwayClubName string `json:"awayClubName"`
	Mode         string `json:"mode"`
	StageNo      int    `json:"stageNo"`
}

func (h *Handler) Start(c *gin.Context) {
	userID, ok := authUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth user"})
		return
	}

	var req startRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	started, err := h.uc.Start(c.Request.Context(), domain.StartInput{
		UserID:       userID,
		AwayClubName: req.AwayClubName,
		Mode:         req.Mode,
		StageNo:      req.StageNo,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": started})
}

type finalizeRequest struct {
	HomeScore int              `json:"homeScore"`
	AwayScore int              `json:"awayScore"`
	HomeStats domain.TeamStats `json:"homeStats"`
	AwayStats domain.TeamStats `json:"awayStats"`
	Scorers   []domain.Scorer  `json:"scorers"`
}

func (h *Handler) Finalize(c *gin.Context) {
	userID, ok := authUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth user"})
		return
	}

	var req finalizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.uc.Finalize(c.Request.Context(), domain.FinalizeInput{
		UserID:    userID,
		MatchID:   c.Param("matchId"),
		HomeScore: req.HomeScore,
		AwayScore: req.AwayScore,
		HomeStats: req.HomeStats,
		AwayStats: req.AwayStats,
		Scorers:   req.Scorers,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

func authUserID(c *gin.Context) (uint64, bool) {
	value, exists := c.Get("authUserID")
	if !exists {
		return 0, false
	}

	userID, ok := value.(uint64)
	if !ok {
		return 0, false
	}

	return userID, true
}
