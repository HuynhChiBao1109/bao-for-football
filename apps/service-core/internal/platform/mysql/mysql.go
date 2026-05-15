package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	mysqldriver "github.com/go-sql-driver/mysql"
)

func New(dsn string) (*sql.DB, error) {
	if err := ensureDatabaseExists(dsn); err != nil {
		return nil, err
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func ensureDatabaseExists(dsn string) error {
	cfg, err := mysqldriver.ParseDSN(dsn)
	if err != nil {
		return err
	}

	if cfg.DBName == "" {
		return nil
	}

	serverCfg := *cfg
	serverCfg.DBName = ""

	serverDB, err := sql.Open("mysql", serverCfg.FormatDSN())
	if err != nil {
		return err
	}
	defer serverDB.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := serverDB.PingContext(ctx); err != nil {
		return err
	}

	query := fmt.Sprintf(
		"CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
		escapeIdentifier(cfg.DBName),
	)
	if _, err := serverDB.ExecContext(ctx, query); err != nil {
		return err
	}

	return nil
}

func escapeIdentifier(value string) string {
	return strings.ReplaceAll(value, "`", "``")
}
