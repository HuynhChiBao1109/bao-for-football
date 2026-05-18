package http

import (
	"net/http"

	authusecase "fifam/apps/service-core/internal/auth/usecase"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	uc *authusecase.AuthUseCase
}

func NewHandler(uc *authusecase.AuthUseCase) *Handler {
	return &Handler{uc: uc}
}

type registerRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	ClubID   int64  `json:"clubId"`
	ClubName string `json:"clubName"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type assignClubRequest struct {
	ClubID int64 `json:"clubId"`
}

func (h *Handler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.uc.Register(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "registered successfully", "data": user})
}

func (h *Handler) ListRegistrationClubs(c *gin.Context) {
	clubs, err := h.uc.ListRegistrationClubs(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": clubs})
}

func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, user, err := h.uc.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "login successful", "token": token.AccessToken, "user": user})
}

func (h *Handler) AdminLogin(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	token, user, err := h.uc.AdminLogin(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "login successful", "token": token.AccessToken, "user": user})
}

func (h *Handler) Me(c *gin.Context) {
	userIDValue, exists := c.Get("authUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing auth user"})
		return
	}

	username, _ := c.Get("authUsername")
	isAdmin, _ := c.Get("authIsAdmin")

	userID, ok := userIDValue.(uint64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth user"})
		return
	}

	session, err := h.uc.GetSession(c.Request.Context(), userID, toString(username), toBool(isAdmin))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": session})
}

func (h *Handler) AssignClub(c *gin.Context) {
	userIDValue, exists := c.Get("authUserID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing auth user"})
		return
	}

	userID, ok := userIDValue.(uint64)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid auth user"})
		return
	}

	var req assignClubRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	team, err := h.uc.AssignClub(c.Request.Context(), userID, req.ClubID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "club assigned", "data": team})
}

func toString(value any) string {
	text, _ := value.(string)
	return text
}

func toBool(value any) bool {
	flag, _ := value.(bool)
	return flag
}
