package middleware

import (
	"net/http"
	"strings"

	authusecase "fifam/apps/service-core/internal/auth/usecase"

	"github.com/gin-gonic/gin"
)

func RequireJWT(authUC *authusecase.AuthUseCase, requireAdmin bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header"})
			return
		}

		claims, err := authUC.ValidateToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		if requireAdmin && !claims.IsAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}

		c.Set("authUserID", claims.UserID)
		c.Set("authUsername", claims.Username)
		c.Set("authIsAdmin", claims.IsAdmin)
		c.Next()
	}
}
