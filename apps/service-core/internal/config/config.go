package config

import "os"

type Config struct {
	HTTPPort      string
	MySQLDSN      string
	JWTSecret     string
	AdminUsername string
	AdminPassword string
}

func Load() Config {
	port := os.Getenv("SERVICE_CORE_PORT")
	if port == "" {
		port = "8081"
	}

	dsn := os.Getenv("MYSQL_DSN")
	if dsn == "" {
		dsn = "root:1234@tcp(localhost:3306)/fifam_dev?parseTime=true"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "fifam-dev-secret"
	}

	adminUsername := os.Getenv("ADMIN_USERNAME")
	if adminUsername == "" {
		adminUsername = "admin"
	}

	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "admin123"
	}

	return Config{
		HTTPPort:      port,
		MySQLDSN:      dsn,
		JWTSecret:     jwtSecret,
		AdminUsername: adminUsername,
		AdminPassword: adminPassword,
	}
}
