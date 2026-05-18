package http

import (
	"net/http"

	"fifam/apps/service-core/internal/tactics/domain"
	tacticsusecase "fifam/apps/service-core/internal/tactics/usecase"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	saveTactics *tacticsusecase.SaveTacticsUseCase
	getTactics  *tacticsusecase.GetTacticsUseCase
}

func NewHandler(saveTactics *tacticsusecase.SaveTacticsUseCase, getTactics *tacticsusecase.GetTacticsUseCase) *Handler {
	return &Handler{saveTactics: saveTactics, getTactics: getTactics}
}

type saveRequest struct {
	TeamID    string  `json:"teamId"`
	Formation string  `json:"formation"`
	PassRatio float64 `json:"passRatio"`
	ShotRatio float64 `json:"shotRatio"`
	Pressure  float64 `json:"pressure"`
	Mode      string  `json:"mode"`
	Lineup    []struct {
		SlotID       string `json:"slotId"`
		Position     string `json:"position"`
		UserPlayerID uint64 `json:"userPlayerId"`
	} `json:"lineup"`
	Gameplay struct {
		PassSpeedScale     float64 `json:"passSpeedScale"`
		InterceptionRadius float64 `json:"interceptionRadius"`
		GKBuildUpBias      float64 `json:"gkBuildUpBias"`
		TempoScale         float64 `json:"tempoScale"`
	} `json:"gameplay"`
}

func (h *Handler) Save(c *gin.Context) {
	var req saveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	saved, err := h.saveTactics.Execute(c.Request.Context(), domain.Config{
		TeamID:    req.TeamID,
		Formation: req.Formation,
		PassRatio: req.PassRatio,
		ShotRatio: req.ShotRatio,
		Pressure:  req.Pressure,
		Mode:      req.Mode,
		Lineup:    mapLineup(req.Lineup),
		Gameplay: domain.Gameplay{
			PassSpeedScale:     req.Gameplay.PassSpeedScale,
			InterceptionRadius: req.Gameplay.InterceptionRadius,
			GKBuildUpBias:      req.Gameplay.GKBuildUpBias,
			TempoScale:         req.Gameplay.TempoScale,
		},
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "tactics saved and pushed to match engine",
		"data":    saved,
	})
}

func mapLineup(input []struct {
	SlotID       string `json:"slotId"`
	Position     string `json:"position"`
	UserPlayerID uint64 `json:"userPlayerId"`
}) []domain.LineupSlot {
	if len(input) == 0 {
		return nil
	}

	out := make([]domain.LineupSlot, 0, len(input))
	for _, item := range input {
		out = append(out, domain.LineupSlot{
			SlotID:       item.SlotID,
			Position:     item.Position,
			UserPlayerID: item.UserPlayerID,
		})
	}

	return out
}

func (h *Handler) Get(c *gin.Context) {
	config, err := h.getTactics.Execute(c.Request.Context(), c.Param("teamId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if config == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tactics not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": config})
}
