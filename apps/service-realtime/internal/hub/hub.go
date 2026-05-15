package hub

import "github.com/gorilla/websocket"

type Hub struct {
	clients    map[*websocket.Conn]bool
	sseClients map[chan []byte]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	registerSSE   chan chan []byte
	unregisterSSE chan chan []byte
}

func New() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		sseClients: make(map[chan []byte]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		registerSSE:   make(chan chan []byte),
		unregisterSSE: make(chan chan []byte),
	}
}

func (h *Hub) Register(conn *websocket.Conn) {
	h.register <- conn
}

func (h *Hub) Unregister(conn *websocket.Conn) {
	h.unregister <- conn
}

func (h *Hub) Publish(payload []byte) {
	h.broadcast <- payload
}

func (h *Hub) RegisterSSE() chan []byte {
	ch := make(chan []byte, 16)
	h.registerSSE <- ch
	return ch
}

func (h *Hub) UnregisterSSE(ch chan []byte) {
	h.unregisterSSE <- ch
}

func (h *Hub) Run() {
	for {
		select {
		case conn := <-h.register:
			h.clients[conn] = true
		case conn := <-h.unregister:
			if _, ok := h.clients[conn]; ok {
				delete(h.clients, conn)
				conn.Close()
			}
		case sse := <-h.registerSSE:
			h.sseClients[sse] = true
		case sse := <-h.unregisterSSE:
			if _, ok := h.sseClients[sse]; ok {
				delete(h.sseClients, sse)
				close(sse)
			}
		case payload := <-h.broadcast:
			for conn := range h.clients {
				if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
					delete(h.clients, conn)
					conn.Close()
				}
			}

			for sse := range h.sseClients {
				select {
				case sse <- payload:
				default:
				}
			}
		}
	}
}
