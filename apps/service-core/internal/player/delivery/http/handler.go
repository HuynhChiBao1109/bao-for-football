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
	GKReach                int `json:"gkReach"`
	AttackingAwareness     int `json:"attackingAwareness"`
	DefensiveAwareness     int `json:"defensiveAwareness"`
	GKParrying             int `json:"gkParrying"`
	GKReflex               int `json:"gkReflex"`

	// Backward-compatibility aliases for older clients.
	CounterAttackAwareness int `json:"counterAttackAwareness"`
	CrossbarHandling   int `json:"crossbarHandling"`
	Reflexes           int `json:"reflexes"`
	Duels              int `json:"duels"`
	Pace               int `json:"pace"`
	Stamina            int `json:"stamina"`
	Balance            int `json:"balance"`
	Technique          int `json:"technique"`
	Determination      int `json:"determination"`
	Strength           int `json:"strength"`
	Physical           int `json:"physical"`
	Defending          int `json:"defending"`
	StandingTackle     int `json:"standingTackle"`
	SlidingTackle      int `json:"slidingTackle"`
	Dribbling          int `json:"dribbling"`
	Curve              int `json:"curve"`
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
		GKReach:                firstNonZero(req.GKReach, req.DefensiveAwareness, req.Defending),
		AttackingAwareness:     firstNonZero(req.AttackingAwareness, req.CounterAttackAwareness),
		DefensiveAwareness:     firstNonZero(req.DefensiveAwareness, req.Defending),
		GKParrying:             firstNonZero(req.GKParrying, req.CrossbarHandling),
		GKReflex:               firstNonZero(req.GKReflex, req.Reflexes),
		Duels:                  req.Duels,
		Pace:                   req.Pace,
		Stamina:                req.Stamina,
		Balance:                req.Balance,
		Technique:              req.Technique,
		Determination:          req.Determination,
		Strength:               firstNonZero(req.Strength, req.Physical),
		StandingTackle:         req.StandingTackle,
		SlidingTackle:          req.SlidingTackle,
		Dribbling:              req.Dribbling,
		Curve:                  req.Curve,
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

func firstNonZero(values ...int) int {
	for _, value := range values {
		if value != 0 {
			return value
		}
	}
	return 0
}
