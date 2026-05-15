package sse

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"

	"github.com/gin-gonic/gin"
)

func Handle(c *gin.Context) {
	targetRaw := os.Getenv("SERVICE_REALTIME_URL")
	if targetRaw == "" {
		targetRaw = "http://localhost:8082"
	}

	target, err := url.Parse(targetRaw)
	if err != nil {
		c.JSON(500, gin.H{"error": "invalid SERVICE_REALTIME_URL"})
		return
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.URL.Path = "/sse/match"
		req.URL.RawPath = ""
		req.Host = target.Host
		req.Header.Set("Accept", "text/event-stream")
	}
	proxy.FlushInterval = -1

	proxy.ServeHTTP(c.Writer, c.Request)
}
