package hub

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

type tickMeta struct {
	Type    string `json:"type"`
	MatchID string `json:"matchId"`
}

type Hub struct {
	clients       map[*websocket.Conn]bool
	sseClients    map[chan []byte]bool
	broadcast     chan []byte
	register      chan *websocket.Conn
	unregister    chan *websocket.Conn
	registerSSE   chan chan []byte
	unregisterSSE chan chan []byte
	recentMu      sync.RWMutex
	recentByMatch map[string][]byte
}

func New() *Hub {
	return &Hub{
		clients:       make(map[*websocket.Conn]bool),
		sseClients:    make(map[chan []byte]bool),
		broadcast:     make(chan []byte),
		register:      make(chan *websocket.Conn),
		unregister:    make(chan *websocket.Conn),
		registerSSE:   make(chan chan []byte),
		unregisterSSE: make(chan chan []byte),
		recentByMatch: make(map[string][]byte),
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

func (h *Hub) Latest(matchID string) []byte {
	h.recentMu.RLock()
	defer h.recentMu.RUnlock()

	payload := h.recentByMatch[matchID]
	if len(payload) == 0 {
		return nil
	}

	cp := make([]byte, len(payload))
	copy(cp, payload)

	return cp
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
			h.rememberTick(payload)

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

func (h *Hub) rememberTick(payload []byte) {
	var meta tickMeta
	if err := json.Unmarshal(payload, &meta); err != nil {
		return
	}
	if meta.Type != "match_tick" || meta.MatchID == "" {
		return
	}

	cp := make([]byte, len(payload))
	copy(cp, payload)

	h.recentMu.Lock()
	defer h.recentMu.Unlock()
	h.recentByMatch[meta.MatchID] = cp
}
