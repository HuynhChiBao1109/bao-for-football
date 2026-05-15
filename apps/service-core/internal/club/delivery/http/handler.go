package http

import (
	"net/http"
	"strconv"

	clubusecase "fifam/apps/service-core/internal/club/usecase"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	getClub *clubusecase.GetClubUseCase
}

func NewHandler(getClub *clubusecase.GetClubUseCase) *Handler {
	return &Handler{getClub: getClub}
}

func (h *Handler) GetClubByID(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	club, err := h.getClub.Execute(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if club == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "club not found"})
		return
	}

	c.JSON(http.StatusOK, club)
}
