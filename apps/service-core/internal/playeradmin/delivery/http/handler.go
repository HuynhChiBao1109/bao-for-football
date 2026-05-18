package http

import (
	"encoding/json"
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
	ClubID       int64  `json:"clubId" form:"clubId"`
	BaseClub     string `json:"baseClub" form:"baseClub"`
	Season       string `json:"season" form:"season"`
	SourceType   string `json:"sourceType" form:"sourceType"`
	SpecialSkill string `json:"specialSkill" form:"specialSkill"`
	Positions    string `json:"positions" form:"positions"`
	Shooting     int    `json:"shooting" form:"shooting"`
	Passing      int    `json:"passing" form:"passing"`
	LongPass     int    `json:"longPass" form:"longPass"`
	Vision       int    `json:"vision" form:"vision"`
	GKReach      int    `json:"gkReach" form:"gkReach"`
	AttAwareness int    `json:"attackingAwareness" form:"attackingAwareness"`
	DefAwareness int    `json:"defensiveAwareness" form:"defensiveAwareness"`
	GKParrying   int    `json:"gkParrying" form:"gkParrying"`
	GKReflex     int    `json:"gkReflex" form:"gkReflex"`

	// Backward-compatibility aliases for older admin clients.
	CtrAwareness   int `json:"counterAttackAwareness" form:"counterAttackAwareness"`
	Crossbar       int `json:"crossbarHandling" form:"crossbarHandling"`
	Reflexes       int `json:"reflexes" form:"reflexes"`
	GKCatching     int `json:"gkCatching" form:"gkCatching"`
	Duels          int `json:"duels" form:"duels"`
	Pace           int `json:"pace" form:"pace"`
	Stamina        int `json:"stamina" form:"stamina"`
	Balance        int `json:"balance" form:"balance"`
	Technique      int `json:"technique" form:"technique"`
	Determination  int `json:"determination" form:"determination"`
	Strength       int `json:"strength" form:"strength"`
	Physical       int `json:"physical" form:"physical"`
	Defending      int `json:"defending" form:"defending"`
	StandingTackle int `json:"standingTackle" form:"standingTackle"`
	SlidingTackle  int `json:"slidingTackle" form:"slidingTackle"`
	Dribbling      int `json:"dribbling" form:"dribbling"`
	Curve          int `json:"curve" form:"curve"`
}

type createSkillRequest struct {
	Name      string `json:"name" form:"name"`
	IconURL   string `json:"iconUrl" form:"iconUrl"`
	BuffType  string `json:"buffType" form:"buffType"`
	BuffValue int    `json:"buffValue" form:"buffValue"`
}

type assignSkillRequest struct {
	SkillID   int64  `json:"skillId" form:"skillId"`
	SkillName string `json:"skillName" form:"skillName"`
}

type createCountryRequest struct {
	Name string `json:"name" form:"name"`
	Code string `json:"code" form:"code"`
	Flag string `json:"flag" form:"flag"`
}

type createClubRequest struct {
	Name       string `json:"name" form:"name"`
	Logo       string `json:"logo" form:"logo"`
	CountryID  int64  `json:"countryId" form:"countryId"`
	LeagueName string `json:"leagueName" form:"leagueName"`
}

func (h *Handler) ListCountries(c *gin.Context) {
	countries, err := h.uc.ListCountries(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": countries})
}

func (h *Handler) CreateCountry(c *gin.Context) {
	var req createCountryRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created, err := h.uc.CreateCountry(c.Request.Context(), domain.Country{
		Name: req.Name,
		Code: req.Code,
		Flag: req.Flag,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "country created", "data": created})
}

func (h *Handler) CreateClub(c *gin.Context) {
	var req createClubRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	countryID := req.CountryID
	created, err := h.uc.CreateClub(c.Request.Context(), domain.Club{
		Name:       req.Name,
		Logo:       req.Logo,
		CountryID:  &countryID,
		LeagueName: req.LeagueName,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "club created", "data": created})
}

func (h *Handler) List(c *gin.Context) {
	var countryIDPtr *int64
	countryIDQuery := strings.TrimSpace(c.Query("countryId"))
	if countryIDQuery != "" {
		countryID, err := strconv.ParseInt(countryIDQuery, 10, 64)
		if err != nil || countryID <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "countryId must be a positive integer"})
			return
		}
		countryIDPtr = &countryID
	}

	players, err := h.uc.List(c.Request.Context(), domain.PlayerFilter{
		Name:      c.Query("name"),
		CountryID: countryIDPtr,
		BaseClub:  c.Query("baseClub"),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": players})
}

func (h *Handler) ListSkills(c *gin.Context) {
	skills, err := h.uc.ListSkills(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": skills})
}

func (h *Handler) CreateSkill(c *gin.Context) {
	var req createSkillRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created, err := h.uc.CreateSkill(c.Request.Context(), domain.SpecialSkill{
		Name:      req.Name,
		IconURL:   req.IconURL,
		BuffType:  req.BuffType,
		BuffValue: req.BuffValue,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "skill created", "data": created})
}

func (h *Handler) AssignSkill(c *gin.Context) {
	playerID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || playerID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var req assignSkillRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.uc.AssignSkillToPlayer(c.Request.Context(), playerID, req.SkillID, req.SkillName)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "skill assigned", "data": updated})
}

func (h *Handler) RemoveSkill(c *gin.Context) {
	playerID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || playerID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	skillID, err := strconv.ParseInt(c.Param("skillId"), 10, 64)
	if err != nil || skillID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid skillId"})
		return
	}

	updated, err := h.uc.RemoveSkillFromPlayer(c.Request.Context(), playerID, skillID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "skill removed", "data": updated})
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

	if countryID, ok := parseFormInt64(c, "countryId", "country_id"); ok {
		req.CountryID = countryID
	}
	if clubID, ok := parseFormInt64(c, "clubId", "club_id"); ok {
		req.ClubID = clubID
	}

	avatarURL, err := h.saveAvatarIfPresent(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	created, err := h.uc.Create(c.Request.Context(), domain.Player{
		Name:           req.Name,
		CountryID:      req.CountryID,
		ClubID:         req.ClubID,
		Avatar:         stringToPtr(avatarURL),
		BaseClub:       req.BaseClub,
		Season:         req.Season,
		SourceType:     req.SourceType,
		SpecialSkill:   req.SpecialSkill,
		Shooting:       req.Shooting,
		Passing:        req.Passing,
		LongPass:       req.LongPass,
		Vision:         req.Vision,
		GKReach:        firstNonZero(req.GKReach, req.DefAwareness, req.Defending),
		AttAwareness:   firstNonZero(req.AttAwareness, req.CtrAwareness),
		DefAwareness:   firstNonZero(req.DefAwareness, req.Defending),
		GKParrying:     firstNonZero(req.GKParrying, req.Crossbar),
		GKReflex:       firstNonZero(req.GKReflex, req.Reflexes),
		Duels:          req.Duels,
		Pace:           req.Pace,
		Stamina:        req.Stamina,
		Balance:        req.Balance,
		Technique:      req.Technique,
		Determination:  req.Determination,
		Strength:       firstNonZero(req.Strength, req.Physical),
		StandingTackle: req.StandingTackle,
		SlidingTackle:  req.SlidingTackle,
		Dribbling:      req.Dribbling,
		Curve:          req.Curve,
		Positions:      parsePositionProfiles(req.Positions),
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

func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	current, err := h.uc.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	var req createPlayerRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if countryID, ok := parseFormInt64(c, "countryId", "country_id"); ok {
		req.CountryID = countryID
	}
	if clubID, ok := parseFormInt64(c, "clubId", "club_id"); ok {
		req.ClubID = clubID
	}

	avatarURL, err := h.saveAvatarIfPresent(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	avatarPtr := current.Avatar
	if trimmed := strings.TrimSpace(avatarURL); trimmed != "" {
		avatarPtr = &trimmed
	}

	updated, err := h.uc.Update(c.Request.Context(), id, domain.Player{
		Name:           req.Name,
		CountryID:      req.CountryID,
		ClubID:         req.ClubID,
		Avatar:         avatarPtr,
		BaseClub:       req.BaseClub,
		Season:         req.Season,
		SourceType:     req.SourceType,
		SpecialSkill:   req.SpecialSkill,
		Shooting:       req.Shooting,
		Passing:        req.Passing,
		LongPass:       req.LongPass,
		Vision:         req.Vision,
		GKReach:        firstNonZero(req.GKReach, req.DefAwareness, req.Defending),
		AttAwareness:   firstNonZero(req.AttAwareness, req.CtrAwareness),
		DefAwareness:   firstNonZero(req.DefAwareness, req.Defending),
		GKParrying:     firstNonZero(req.GKParrying, req.Crossbar),
		GKReflex:       firstNonZero(req.GKReflex, req.Reflexes),
		Duels:          req.Duels,
		Pace:           req.Pace,
		Stamina:        req.Stamina,
		Balance:        req.Balance,
		Technique:      req.Technique,
		Determination:  req.Determination,
		Strength:       firstNonZero(req.Strength, req.Physical),
		StandingTackle: req.StandingTackle,
		SlidingTackle:  req.SlidingTackle,
		Dribbling:      req.Dribbling,
		Curve:          req.Curve,
		Positions:      parsePositionProfiles(req.Positions),
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "player updated", "data": updated})
}

func (h *Handler) Delete(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	if err := h.uc.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "player deleted"})
}

func parsePositionProfiles(raw string) []domain.PositionProfile {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}

	type payload struct {
		Position    string  `json:"position"`
		Description string  `json:"description"`
		Effect      float64 `json:"effect"`
	}

	var input []payload
	if err := json.Unmarshal([]byte(trimmed), &input); err != nil {
		return nil
	}

	out := make([]domain.PositionProfile, 0, len(input))
	for _, item := range input {
		position := strings.ToUpper(strings.TrimSpace(item.Position))
		if position == "" {
			continue
		}
		description := strings.TrimSpace(item.Description)
		effect := item.Effect
		if effect <= 0 {
			effect = 0.5
		}
		if effect > 1 {
			effect = 1
		}
		out = append(out, domain.PositionProfile{
			Position:    position,
			Description: description,
			Effect:      effect,
		})
	}

	return out
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

func firstNonZero(values ...int) int {
	for _, value := range values {
		if value != 0 {
			return value
		}
	}
	return 0
}

func stringToPtr(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func parseFormInt64(c *gin.Context, keys ...string) (int64, bool) {
	for _, key := range keys {
		value := strings.TrimSpace(c.PostForm(key))
		if value == "" {
			continue
		}

		parsed, err := strconv.ParseInt(value, 10, 64)
		if err == nil {
			return parsed, true
		}
	}

	return 0, false
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
