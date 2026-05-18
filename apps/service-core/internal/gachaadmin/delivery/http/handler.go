package http

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"fifam/apps/service-core/internal/gachaadmin/domain"
	gachaadminusecase "fifam/apps/service-core/internal/gachaadmin/usecase"

	"github.com/gin-gonic/gin"
)

const imageUploadDir = "uploads/image"

type Handler struct {
	uc *gachaadminusecase.BannerUseCase
}

func NewHandler(uc *gachaadminusecase.BannerUseCase) *Handler {
	return &Handler{uc: uc}
}

type createBannerRequest struct {
	BannerCode      string `json:"bannerCode"`
	BannerName      string `json:"bannerName"`
	BannerImageURL  string `json:"bannerImageUrl"`
	BannerImageData string `json:"bannerImageData"`
	PlayerID        int64  `json:"playerId"`
	TimeEnd         string `json:"timeEnd"`
}

func (h *Handler) UploadImage(c *gin.Context) {
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "image file is required"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !isAllowedImageExt(ext) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported image format"})
		return
	}

	if err := os.MkdirAll(imageUploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare upload directory"})
		return
	}

	fileName := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	dst := filepath.Join(imageUploadDir, fileName)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save image"})
		return
	}

	publicPath := "/uploads/image/" + fileName
	c.JSON(http.StatusCreated, gin.H{
		"message": "image uploaded",
		"data": gin.H{
			"path": publicPath,
			"url":  buildPublicURL(c, publicPath),
		},
	})
}

func (h *Handler) CreateBanner(c *gin.Context) {
	var req createBannerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expiredAt, err := time.Parse(time.RFC3339, strings.TrimSpace(req.TimeEnd))
	if err != nil || expiredAt.IsZero() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "timeEnd is required and must be RFC3339"})
		return
	}

	created, err := h.uc.CreateBanner(c.Request.Context(), domain.BannerConfig{
		BannerCode:     req.BannerCode,
		BannerName:     req.BannerName,
		BannerImageURL: firstNonEmpty(req.BannerImageURL, req.BannerImageData),
		PlayerID:       req.PlayerID,
		ExpiredAt:      &expiredAt,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "gacha banner created",
		"data":    created,
	})
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

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if trimmed := strings.TrimSpace(v); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
