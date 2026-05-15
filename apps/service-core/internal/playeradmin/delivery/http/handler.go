package http

import (
	"net/http"
	"strconv"

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
	CountryID    int64  `json:"countryId"`
	BaseClub     string `json:"baseClub"`
	Season       string `json:"season"`
	SourceType   string `json:"sourceType"`
	SpecialSkill string `json:"specialSkill"`
	Shooting     int    `json:"shooting"`
	Passing      int    `json:"passing"`
	LongPass     int    `json:"longPass"`
	Vision       int    `json:"vision"`
	DefAwareness int    `json:"defensiveAwareness"`
	CtrAwareness int    `json:"counterAttackAwareness"`
	Crossbar     int    `json:"crossbarHandling"`
	Reflexes     int    `json:"reflexes"`
	AerialCatch  int    `json:"aerialCatching"`
	Duels        int    `json:"duels"`
	Pace         int    `json:"pace"`
	Physical     int    `json:"physical"`
	Defending    int    `json:"defending"`
	Dribbling    int    `json:"dribbling"`
}

func (h *Handler) ListCountries(c *gin.Context) {
	countries, err := h.uc.ListCountries(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": countries})
}

func (h *Handler) List(c *gin.Context) {
	players, err := h.uc.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": players})
}

func (h *Handler) Detail(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	player, err := h.uc.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": player})
}

func (h *Handler) Create(c *gin.Context) {
	var req createPlayerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created, err := h.uc.Create(c.Request.Context(), domain.Player{
		Name:         req.Name,
		CountryID:    req.CountryID,
		BaseClub:     req.BaseClub,
		Season:       req.Season,
		SourceType:   req.SourceType,
		SpecialSkill: req.SpecialSkill,
		Shooting:     req.Shooting,
		Passing:      req.Passing,
		LongPass:     req.LongPass,
		Vision:       req.Vision,
		DefAwareness: req.DefAwareness,
		CtrAwareness: req.CtrAwareness,
		Crossbar:     req.Crossbar,
		Reflexes:     req.Reflexes,
		AerialCatch:  req.AerialCatch,
		Duels:        req.Duels,
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
