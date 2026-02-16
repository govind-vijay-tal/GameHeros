package scoring

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	MsgTypeScoreUpdate   = "SCORE_UPDATE"
	MsgTypeEventRecorded = "EVENT_RECORDED"
	MsgTypeMatchStarted  = "MATCH_STARTED"
	MsgTypeMatchEnded    = "MATCH_ENDED"
	MsgTypeError         = "ERROR"
	MsgTypeEventsList    = "EVENTS_LIST"
	MsgTypeEventRecord   = "RECORD_EVENT"
	MsgTypeMatchUpdate   = "MATCH_UPDATE"
)

type WSMessage struct {
	Type      string      `json:"type"`
	MatchID   string      `json:"match_id"`
	Payload   interface{} `json:"payload"`
	Timestamp int64       `json:"timestamp"`
}

type Client struct {
	hub     *Hub
	conn    *websocket.Conn
	Send    chan []byte
	matchID uuid.UUID
	handler func(*Client, []byte)
}

type Hub struct {
	matches map[uuid.UUID]map[*Client]bool

	register chan *Client

	unregister chan *Client

	broadcast chan *BroadcastMessage

	mu sync.RWMutex
}

type BroadcastMessage struct {
	MatchID uuid.UUID
	Message []byte
}

var hub *Hub

func GetHub() *Hub {
	if hub == nil {
		hub = NewHub()
		go hub.Run()
	}
	return hub
}

func NewHub() *Hub {
	return &Hub{
		matches:    make(map[uuid.UUID]map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *BroadcastMessage),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if h.matches[client.matchID] == nil {
				h.matches[client.matchID] = make(map[*Client]bool)
			}
			h.matches[client.matchID][client] = true
			log.Printf("[Hub] Client registered for match %s (total: %d)", client.matchID, len(h.matches[client.matchID]))
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.matches[client.matchID]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.Send)
					log.Printf("[Hub] Client unregistered from match %s (remaining: %d)", client.matchID, len(clients))
					if len(clients) == 0 {
						delete(h.matches, client.matchID)
					}
				}
			}
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.RLock()
			if clients, ok := h.matches[msg.MatchID]; ok {
				for client := range clients {
					select {
					case client.Send <- msg.Message:
					default:

						close(client.Send)
						delete(clients, client)
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) RegisterClient(conn *websocket.Conn, matchID uuid.UUID, handler func(*Client, []byte)) *Client {
	client := &Client{
		hub:     h,
		conn:    conn,
		Send:    make(chan []byte, 256),
		matchID: matchID,
		handler: handler,
	}
	h.register <- client
	return client
}

func (h *Hub) BroadcastToMatch(matchID uuid.UUID, msgType string, payload interface{}) {
	msg := WSMessage{
		Type:      msgType,
		MatchID:   matchID.String(),
		Payload:   payload,
		Timestamp: getCurrentTimestamp(),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[Hub] Error marshaling message: %v", err)
		return
	}

	h.broadcast <- &BroadcastMessage{
		MatchID: matchID,
		Message: data,
	}
}

func (h *Hub) GetViewerCount(matchID uuid.UUID) int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.matches[matchID]; ok {
		return len(clients)
	}
	return 0
}

func (c *Client) WritePump() {
	defer func() {
		c.conn.Close()
	}()

	for message := range c.Send {
		if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
			return
		}
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[Hub] WebSocket error: %v", err)
			}
			break
		}

		if c.handler != nil {
			c.handler(c, message)
		}
	}
}

func getCurrentTimestamp() int64 {
	return time.Now().UnixMilli()
}
