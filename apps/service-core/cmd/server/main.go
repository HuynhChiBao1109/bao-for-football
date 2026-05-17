package main

import (
	"context"
	"log"

	aihttp "fifam/apps/service-core/internal/ai/delivery/http"
	aimysql "fifam/apps/service-core/internal/ai/repository/mysql"
	aiusecase "fifam/apps/service-core/internal/ai/usecase"
	authhttp "fifam/apps/service-core/internal/auth/delivery/http"
	authmiddleware "fifam/apps/service-core/internal/auth/middleware"
	authmysql "fifam/apps/service-core/internal/auth/repository/mysql"
	authusecase "fifam/apps/service-core/internal/auth/usecase"
	clubhttp "fifam/apps/service-core/internal/club/delivery/http"
	clubmysql "fifam/apps/service-core/internal/club/repository/mysql"
	clubusecase "fifam/apps/service-core/internal/club/usecase"
	"fifam/apps/service-core/internal/config"
	gachahttp "fifam/apps/service-core/internal/gacha/delivery/http"
	gachamysql "fifam/apps/service-core/internal/gacha/repository/mysql"
	gachausecase "fifam/apps/service-core/internal/gacha/usecase"
	matchhttp "fifam/apps/service-core/internal/match/delivery/http"
	matchmysql "fifam/apps/service-core/internal/match/repository/mysql"
	matchusecase "fifam/apps/service-core/internal/match/usecase"
	coremiddleware "fifam/apps/service-core/internal/middleware"
	mysqlplatform "fifam/apps/service-core/internal/platform/mysql"
	playerhttp "fifam/apps/service-core/internal/player/delivery/http"
	playermysql "fifam/apps/service-core/internal/player/repository/mysql"
	playerusecase "fifam/apps/service-core/internal/player/usecase"
	playeradminhttp "fifam/apps/service-core/internal/playeradmin/delivery/http"
	playeradminmysql "fifam/apps/service-core/internal/playeradmin/repository/mysql"
	playeradminusecase "fifam/apps/service-core/internal/playeradmin/usecase"
	tacticshttp "fifam/apps/service-core/internal/tactics/delivery/http"
	realtimeclient "fifam/apps/service-core/internal/tactics/integration/realtime"
	tacticsmysql "fifam/apps/service-core/internal/tactics/repository/mysql"
	tacticsusecase "fifam/apps/service-core/internal/tactics/usecase"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	db, gormDB, err := mysqlplatform.New(cfg.MySQLDSN)
	if err != nil {
		log.Printf("mysql connection warning: %v", err)
	} else {
		if err := mysqlplatform.AutoMigrate(context.Background(), gormDB); err != nil {
			log.Printf("mysql migrate warning: %v", err)
		}
		if err := mysqlplatform.EnsureSeedData(context.Background(), db); err != nil {
			log.Printf("mysql seed warning: %v", err)
		}
	}

	authRepo := authmysql.NewRepository(db)
	authUC := authusecase.NewAuthUseCase(authRepo)
	if err := authUC.EnsureAdmin(context.Background()); err != nil {
		log.Printf("admin seed warning: %v", err)
	}
	authHandler := authhttp.NewHandler(authUC)

	clubRepo := clubmysql.NewRepository(db)
	clubUC := clubusecase.NewGetClubUseCase(clubRepo)
	clubHandler := clubhttp.NewHandler(clubUC)

	tacticsRepo := tacticsmysql.NewRepository(db)
	realtimePusher := realtimeclient.NewClient(cfg.RealtimeBaseURL)
	tacticsUC := tacticsusecase.NewSaveTacticsUseCase(tacticsRepo, realtimePusher)
	getTacticsUC := tacticsusecase.NewGetTacticsUseCase(tacticsRepo)
	tacticsHandler := tacticshttp.NewHandler(tacticsUC, getTacticsUC)

	matchRepo := matchmysql.NewRepository(db)
	matchUC := matchusecase.NewMatchUseCase(matchRepo, realtimePusher)
	matchHandler := matchhttp.NewHandler(matchUC)

	gachaRepo := gachamysql.NewRepository(db)
	gachaUC := gachausecase.NewRollUseCase(gachaRepo)
	gachaHandler := gachahttp.NewHandler(gachaUC)

	playerAdminRepo := playeradminmysql.NewRepository(db)
	playerAdminUC := playeradminusecase.NewPlayerAdminUseCase(playerAdminRepo)
	playerAdminHandler := playeradminhttp.NewHandler(playerAdminUC)

	playerRepo := playermysql.NewRepository(db)
	playerUC := playerusecase.NewPlayerCardUseCase(playerRepo)
	playerHandler := playerhttp.NewHandler(playerUC)

	aiRepo := aimysql.NewRepository(db)
	aiUC := aiusecase.NewCampaignUseCase(aiRepo)
	aiHandler := aihttp.NewHandler(aiUC)

	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(coremiddleware.CORS())
	router.Use(gin.Recovery())

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"service": "service-core", "status": "ok"})
	})
	router.GET("/api/v1/auth/clubs", authHandler.ListRegistrationClubs)
	router.POST("/api/v1/auth/login", authHandler.Login)
	router.POST("/api/v1/auth/register", authHandler.Register)
	router.POST("/admin/login", authHandler.AdminLogin)

	api := router.Group("/api/v1")
	api.Use(authmiddleware.RequireJWT(authUC, false))
	api.GET("/auth/me", authHandler.Me)
	api.GET("/clubs/:id", clubHandler.GetClubByID)
	api.GET("/ai/stages", aiHandler.ListStages)
	api.GET("/ai/stages/:stageNo", aiHandler.GetStageDetail)
	api.POST("/ai/stages/:stageNo/result", aiHandler.SubmitResult)
	api.GET("/tactics/:teamId", tacticsHandler.Get)
	api.POST("/tactics", tacticsHandler.Save)
	api.POST("/gacha/roll", gachaHandler.Roll)
	api.GET("/players", playerHandler.ListMyCards)
	api.POST("/players/:id/allocate", playerHandler.AllocateStats)
	api.POST("/matches/start", matchHandler.Start)
	api.POST("/matches/:matchId/finalize", matchHandler.Finalize)

	admin := router.Group("/api/v1/admin")
	admin.Use(authmiddleware.RequireJWT(authUC, true))
	admin.GET("/countries", playerAdminHandler.ListCountries)
	admin.GET("/players", playerAdminHandler.List)
	admin.GET("/players/:id", playerAdminHandler.Detail)
	admin.POST("/players", playerAdminHandler.Create)

	log.Printf("service-core listening on %s", cfg.HTTPPort)
	if err := router.Run(":" + cfg.HTTPPort); err != nil {
		log.Fatal(err)
	}
}
