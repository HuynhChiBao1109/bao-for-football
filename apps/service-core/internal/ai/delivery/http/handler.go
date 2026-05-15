package http

import (
	"net/http"
	"strconv"

	aiusecase "fifam/apps/service-core/internal/ai/usecase"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	uc *aiusecase.CampaignUseCase
}

func NewHandler(uc *aiusecase.CampaignUseCase) *Handler {
	return &Handler{uc: uc}
}

func (h *Handler) ListStages(c *gin.Context) {
	userID, ok := authUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth user"})
		return
	}

	stages, err := h.uc.ListStages(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": stages})
}

func (h *Handler) GetStageDetail(c *gin.Context) {
	userID, ok := authUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth user"})
		return
	}

	stageNo, err := strconv.Atoi(c.Param("stageNo"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid stageNo"})
		return
	}

	detail, err := h.uc.GetStageDetail(c.Request.Context(), userID, stageNo)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if detail == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "stage not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": detail})
}

type resultRequest struct {
	IsWin bool `json:"isWin"`
}

func (h *Handler) SubmitResult(c *gin.Context) {
	userID, ok := authUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth user"})
		return
	}

	stageNo, err := strconv.Atoi(c.Param("stageNo"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid stageNo"})
		return
	}

	var req resultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.uc.SubmitStageResult(c.Request.Context(), userID, stageNo, req.IsWin)
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
