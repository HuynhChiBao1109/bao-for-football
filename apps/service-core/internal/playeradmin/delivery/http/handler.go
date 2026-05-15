package http

import (
	"net/http"

	"fifam/apps/service-core/internal/playeradmin/domain"
	playeradminusecase "fifam/apps/service-core/internal/playeradmin/usecase"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	uc *playeradminusecase.PlayerAdminUseCase
}

func NewHandler(uc *playeradminusecase.PlayerAdminUseCase) *Handler {
	return &Handler{uc: uc}
}

type createPlayerRequest struct {
	Name         string `json:"name"`
	Nationality  string `json:"nationality"`
	BaseClub     string `json:"baseClub"`
	Season       string `json:"season"`
	SourceType   string `json:"sourceType"`
	SpecialSkill string `json:"specialSkill"`
	Shooting     int    `json:"shooting"`
	Passing      int    `json:"passing"`
	Pace         int    `json:"pace"`
	Physical     int    `json:"physical"`
	Defending    int    `json:"defending"`
	Dribbling    int    `json:"dribbling"`
}

func (h *Handler) List(c *gin.Context) {
	players, err := h.uc.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": players})
}

func (h *Handler) Create(c *gin.Context) {
	var req createPlayerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created, err := h.uc.Create(c.Request.Context(), domain.Player{
		Name:         req.Name,
		Nationality:  req.Nationality,
		BaseClub:     req.BaseClub,
		Season:       req.Season,
		SourceType:   req.SourceType,
		SpecialSkill: req.SpecialSkill,
		Shooting:     req.Shooting,
		Passing:      req.Passing,
		Pace:         req.Pace,
		Physical:     req.Physical,
		Defending:    req.Defending,
		Dribbling:    req.Dribbling,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "player added to catalog",
		"data":    created,
	})
}
