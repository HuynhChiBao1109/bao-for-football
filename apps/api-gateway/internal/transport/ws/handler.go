package ws

import (
	"log"
	"net/http"

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
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("upgrade websocket failed: %v", err)
		return
	}
	defer conn.Close()

	for {
		messageType, payload, err := conn.ReadMessage()
		if err != nil {
			return
		}

		if err := conn.WriteMessage(messageType, payload); err != nil {
			return
		}
	}
}
