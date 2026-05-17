package realtime

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"fifam/apps/service-core/internal/tactics/domain"
)

type Client struct {
	baseURL string
	http    *http.Client
}

type startMatchRequest struct {
	MatchID string `json:"matchId"`
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http: &http.Client{
			Timeout: 3 * time.Second,
		},
	}
}

func (c *Client) Push(ctx context.Context, cfg domain.Config) error {
	payload, err := json.Marshal(cfg)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/v1/tactics", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("realtime service rejected tactics update: status=%d", resp.StatusCode)
	}

	return nil
}

func (c *Client) StartMatch(ctx context.Context, matchID string) error {
	payload, err := json.Marshal(startMatchRequest{MatchID: matchID})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/v1/matches/start", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		if len(body) > 0 {
			return fmt.Errorf("realtime service rejected match start: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
		}
		return fmt.Errorf("realtime service rejected match start: status=%d", resp.StatusCode)
	}

	return nil
}
