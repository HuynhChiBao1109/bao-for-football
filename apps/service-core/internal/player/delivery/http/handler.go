package http

import (
	"net/http"
	"strconv"

	"fifam/apps/service-core/internal/player/domain"
	playerusecase "fifam/apps/service-core/internal/player/usecase"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	uc *playerusecase.PlayerCardUseCase
}

func NewHandler(uc *playerusecase.PlayerCardUseCase) *Handler {
	return &Handler{uc: uc}
}

type allocateStatsRequest struct {
	Shooting               int `json:"shooting"`
	Passing                int `json:"passing"`
	LongPass               int `json:"longPass"`
	Vision                 int `json:"vision"`
	DefensiveAwareness     int `json:"defensiveAwareness"`
	CounterAttackAwareness int `json:"counterAttackAwareness"`
	CrossbarHandling       int `json:"crossbarHandling"`
	Reflexes               int `json:"reflexes"`
	AerialCatching         int `json:"aerialCatching"`
	Duels                  int `json:"duels"`
	Pace                   int `json:"pace"`
	Physical               int `json:"physical"`
	Defending              int `json:"defending"`
	StandingTackle         int `json:"standingTackle"`
	SlidingTackle          int `json:"slidingTackle"`
	Dribbling              int `json:"dribbling"`
}

func (h *Handler) ListMyCards(c *gin.Context) {
	userID, ok := getAuthUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing auth user"})
		return
	}

	cards, err := h.uc.ListMyCards(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": cards})
}

func (h *Handler) AllocateStats(c *gin.Context) {
	userID, ok := getAuthUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing auth user"})
		return
	}

	userPlayerID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || userPlayerID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid player card id"})
		return
	}

	var req allocateStatsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.uc.AllocateStats(c.Request.Context(), userID, userPlayerID, domain.AllocateStatsInput{
		Shooting:               req.Shooting,
		Passing:                req.Passing,
		LongPass:               req.LongPass,
		Vision:                 req.Vision,
		DefensiveAwareness:     req.DefensiveAwareness,
		CounterAttackAwareness: req.CounterAttackAwareness,
		CrossbarHandling:       req.CrossbarHandling,
		Reflexes:               req.Reflexes,
		AerialCatching:         req.AerialCatching,
		Duels:                  req.Duels,
		Pace:                   req.Pace,
		Physical:               req.Physical,
		Defending:              req.Defending,
		StandingTackle:         req.StandingTackle,
		SlidingTackle:          req.SlidingTackle,
		Dribbling:              req.Dribbling,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "stats allocated",
		"data":    updated,
	})
}

func getAuthUserID(c *gin.Context) (uint64, bool) {
	value, exists := c.Get("authUserID")
	if !exists {
		return 0, false
	}

	userID, ok := value.(uint64)
	if !ok || userID == 0 {
		return 0, false
	}

	return userID, true
}
