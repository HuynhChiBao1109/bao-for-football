package http

import (
	"net/http"

	gachausecase "fifam/apps/service-core/internal/gacha/usecase"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	roll *gachausecase.RollUseCase
}

func NewHandler(roll *gachausecase.RollUseCase) *Handler {
	return &Handler{roll: roll}
}

type rollRequest struct {
	UserID     uint64 `json:"userId"`
	BannerCode string `json:"bannerCode"`
}

type progressResponse struct {
	TotalRolls        int `json:"totalRolls"`
	RollsSinceSpecial int `json:"rollsSinceSpecial"`
}

func (h *Handler) GetProgress(c *gin.Context) {
	userIDVal, exists := c.Get("authUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing auth user"})
		return
	}
	userID, ok := userIDVal.(uint64)
	if !ok || userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth user"})
		return
	}

	bannerCode := c.Query("bannerCode")
	if bannerCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bannerCode required"})
		return
	}

	total, since, err := h.roll.GetProgress(c.Request.Context(), userID, bannerCode)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": progressResponse{
			TotalRolls:        total,
			RollsSinceSpecial: since,
		},
	})
}

func (h *Handler) Roll(c *gin.Context) {
	var req rollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.roll.Execute(c.Request.Context(), req.UserID, req.BannerCode)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "gacha rolled successfully",
		"data":    result,
	})
}
