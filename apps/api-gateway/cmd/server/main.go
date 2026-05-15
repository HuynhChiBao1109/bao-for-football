package main

import (
	"log"

	"fifam/apps/api-gateway/internal/config"
	httptransport "fifam/apps/api-gateway/internal/transport/http"
)

func main() {
	cfg := config.Load()
	router := httptransport.NewRouter()

	log.Printf("api-gateway listening on %s", cfg.HTTPPort)
	if err := router.Run(":" + cfg.HTTPPort); err != nil {
		log.Fatal(err)
	}
}
