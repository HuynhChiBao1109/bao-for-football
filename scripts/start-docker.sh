#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
COMPOSE_FILE="$PROJECT_ROOT/deployments/docker/docker-compose.yml"

compose() {
  if [ -f "$PROJECT_ROOT/.env" ]; then
    docker compose --env-file "$PROJECT_ROOT/.env" -f "$COMPOSE_FILE" "$@"
  else
    docker compose -f "$COMPOSE_FILE" "$@"
  fi
}

echo "Starting MySQL with bind-address=0.0.0.0..."
compose up -d mysql

attempt=1
until compose exec -T mysql sh -c \
  'mysqladmin ping --protocol=socket -uroot --password="$MYSQL_ROOT_PASSWORD" --silent' \
  > /dev/null 2>&1; do
  if [ "$attempt" -ge 60 ]; then
    echo "MySQL did not become ready in time"
    compose logs --tail=200 mysql
    exit 1
  fi

  echo "Waiting for MySQL: $attempt/60"
  attempt=$((attempt + 1))
  sleep 2
done

echo "Ensuring the database and root@% permissions exist..."
compose exec -T mysql sh <<'MYSQL_SETUP'
set -eu

case "$MYSQL_DATABASE" in
  ""|*[!A-Za-z0-9_]* )
    echo "MYSQL_DATABASE may only contain letters, numbers and underscores"
    exit 1
    ;;
esac

escaped_password=$(printf '%s' "$MYSQL_ROOT_PASSWORD" | sed "s/\\\\/\\\\\\\\/g; s/'/''/g")

mysql --protocol=socket -uroot --password="$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS \`$MYSQL_DATABASE\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '$escaped_password';
ALTER USER 'root'@'%' IDENTIFIED BY '$escaped_password';
GRANT CREATE ON *.* TO 'root'@'%';
GRANT ALL PRIVILEGES ON \`$MYSQL_DATABASE\`.* TO 'root'@'%';
FLUSH PRIVILEGES;
SQL
MYSQL_SETUP

echo "Starting the complete application stack..."
compose up --build -d
compose ps
