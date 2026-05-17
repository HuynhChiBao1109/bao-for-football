package ws

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(_ *http.Request) bool {
		return true
	},
}

func Handle(c *gin.Context) {
	target, err := realtimeWSURL(c.Request.URL.RawQuery)
	if err != nil {
		log.Printf("resolve realtime websocket url failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid realtime websocket target"})
		return
	}

	backendConn, _, err := websocket.DefaultDialer.Dial(target.String(), buildBackendHeaders(c.Request.Header))
	if err != nil {
		log.Printf("dial realtime websocket failed: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "unable to connect realtime websocket"})
		return
	}

	clientConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("upgrade websocket failed: %v", err)
		backendConn.Close()
		return
	}

	errCh := make(chan error, 2)
	go proxyMessages(clientConn, backendConn, errCh)
	go proxyMessages(backendConn, clientConn, errCh)

	if err := <-errCh; err != nil && !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		log.Printf("websocket proxy closed: %v", err)
	}

	backendConn.Close()
	clientConn.Close()
}

func proxyMessages(src *websocket.Conn, dst *websocket.Conn, errCh chan<- error) {
	for {
		messageType, payload, err := src.ReadMessage()
		if err != nil {
			errCh <- err
			return
		}

		if err := dst.WriteMessage(messageType, payload); err != nil {
			errCh <- err
			return
		}
	}
}

func realtimeWSURL(rawQuery string) (*url.URL, error) {
	targetRaw := os.Getenv("SERVICE_REALTIME_URL")
	if targetRaw == "" {
		targetRaw = os.Getenv("REALTIME_BASE_URL")
	}
	if targetRaw == "" {
		targetRaw = "http://localhost:8082"
	}

	target, err := url.Parse(targetRaw)
	if err != nil {
		return nil, err
	}

	switch target.Scheme {
	case "http":
		target.Scheme = "ws"
	case "https":
		target.Scheme = "wss"
	case "ws", "wss":
	default:
		return nil, fmt.Errorf("unsupported scheme %q", target.Scheme)
	}

	target.Path = path.Join(target.Path, "/ws")
	target.RawPath = ""
	target.RawQuery = rawQuery

	return target, nil
}

func buildBackendHeaders(source http.Header) http.Header {
	headers := make(http.Header)
	for _, key := range []string{"Authorization", "Cookie", "Origin", "Sec-WebSocket-Protocol"} {
		for _, value := range source.Values(key) {
			headers.Add(key, value)
		}
	}
	return headers
}
