package http

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

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
	Name         string `json:"name" form:"name"`
	CountryID    int64  `json:"countryId" form:"countryId"`
	Avatar       string `json:"avatar" form:"avatar"`
	BaseClub     string `json:"baseClub" form:"baseClub"`
	Season       string `json:"season" form:"season"`
	SourceType   string `json:"sourceType" form:"sourceType"`
	SpecialSkill string `json:"specialSkill" form:"specialSkill"`
	Shooting     int    `json:"shooting" form:"shooting"`
	Passing      int    `json:"passing" form:"passing"`
	LongPass     int    `json:"longPass" form:"longPass"`
	Vision       int    `json:"vision" form:"vision"`
	GKReach      int    `json:"gkReach" form:"gkReach"`
	CtrAwareness int    `json:"counterAttackAwareness" form:"counterAttackAwareness"`
	GKParrying   int    `json:"gkParrying" form:"gkParrying"`
	GKReflex     int    `json:"gkReflex" form:"gkReflex"`
	GKCatching   int    `json:"gkCatching" form:"gkCatching"`

	// Backward-compatibility aliases for older admin clients.
	DefAwareness   int `json:"defensiveAwareness" form:"defensiveAwareness"`
	Crossbar       int `json:"crossbarHandling" form:"crossbarHandling"`
	Reflexes       int `json:"reflexes" form:"reflexes"`
	AerialCatch    int `json:"aerialCatching" form:"aerialCatching"`
	Duels          int `json:"duels" form:"duels"`
	Pace           int `json:"pace" form:"pace"`
	Physical       int `json:"physical" form:"physical"`
	Defending      int `json:"defending" form:"defending"`
	StandingTackle int `json:"standingTackle" form:"standingTackle"`
	SlidingTackle  int `json:"slidingTackle" form:"slidingTackle"`
	Dribbling      int `json:"dribbling" form:"dribbling"`
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
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	avatarURL, err := h.saveAvatarIfPresent(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if avatarURL != "" {
		req.Avatar = avatarURL
	}

	created, err := h.uc.Create(c.Request.Context(), domain.Player{
		Name:           req.Name,
		CountryID:      req.CountryID,
		Avatar:         stringToPtr(req.Avatar),
		BaseClub:       req.BaseClub,
		Season:         req.Season,
		SourceType:     req.SourceType,
		SpecialSkill:   req.SpecialSkill,
		Shooting:       req.Shooting,
		Passing:        req.Passing,
		LongPass:       req.LongPass,
		Vision:         req.Vision,
		GKReach:        firstNonZero(req.GKReach, req.DefAwareness),
		CtrAwareness:   req.CtrAwareness,
		GKParrying:     firstNonZero(req.GKParrying, req.Crossbar),
		GKReflex:       firstNonZero(req.GKReflex, req.Reflexes),
		GKCatching:     firstNonZero(req.GKCatching, req.AerialCatch),
		Duels:          req.Duels,
		Pace:           req.Pace,
		Physical:       req.Physical,
		Defending:      req.Defending,
		StandingTackle: req.StandingTackle,
		SlidingTackle:  req.SlidingTackle,
		Dribbling:      req.Dribbling,
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

func (h *Handler) saveAvatarIfPresent(c *gin.Context) (string, error) {
	contentType := strings.ToLower(strings.TrimSpace(c.GetHeader("Content-Type")))
	if !strings.HasPrefix(contentType, "multipart/form-data") {
		return "", nil
	}

	file, err := c.FormFile("avatar")
	if err != nil {
		if errors.Is(err, http.ErrMissingFile) || strings.Contains(strings.ToLower(err.Error()), "no such file") {
			return "", nil
		}
		return "", err
	}

	if file == nil {
		return "", nil
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !isAllowedImageExt(ext) {
		return "", fmt.Errorf("unsupported avatar format")
	}

	if err := os.MkdirAll("uploads/image", 0755); err != nil {
		return "", fmt.Errorf("failed to prepare avatar directory")
	}

	fileName := fmt.Sprintf("player-avatar-%d%s", time.Now().UnixNano(), ext)
	dst := filepath.Join("uploads/image", fileName)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		return "", fmt.Errorf("failed to save avatar")
	}

	return buildPublicURL(c, "/uploads/image/"+fileName), nil
}

func firstNonZero(primary int, fallback int) int {
	if primary != 0 {
		return primary
	}
	return fallback
}

func stringToPtr(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func isAllowedImageExt(ext string) bool {
	switch ext {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return true
	default:
		return false
	}
}

func buildPublicURL(c *gin.Context, path string) string {
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if forwarded := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); forwarded != "" {
		scheme = forwarded
	}

	return fmt.Sprintf("%s://%s%s", scheme, c.Request.Host, path)
}
