# FIFAM

FIFAM la du an game football manager gom backend NestJS va frontend React.

FIFAM không phải game turn-based mà là:

realtime simulation
tactical-driven football engine
event-chain system
animation-first match viewer

## 1) Tech Stack

### Backend (apps/server)

- Node.js + TypeScript
- HTTP framework: NestJS
- ORM + DB driver: TypeORM + mysql2
- Auth: JWT + bcrypt
- Realtime transport: Socket.IO
- Cache/state: Redis

### Frontend (apps/web)

- React 19 + TypeScript + Vite
- Routing: react-router-dom
- Server state: @tanstack/react-query
- Styling: TailwindCSS v4 + CSS modules/page CSS
- Tooling: ESLint + Prettier

### Database

- MySQL 8.x
- Schema migration + bootstrap duoc quan ly boi TypeORM va bootstrap code trong backend

### Infrastructure / DevOps

- Docker Compose dev stack (MySQL + Redis + backend + frontend)

## 2) Source Code Structure

```text
fifam/
|- .env.example
|- README.md
|- apps/
|  |- server/
|  |  |- src/main.ts                       # entrypoint backend
|  |  |- src/app.module.ts                 # root NestJS module
|  |  |- src/modules/                      # domain modules
|  |  |- src/database/                     # datasource + migrations
|  |  |- uploads/image/                    # uploaded image files
|  |- web/
|  |  |- src/
|  |  |  |- App.tsx                        # route + guard
|  |  |  |- layouts/AppLayout.tsx          # app shell + starter team modal
|  |  |  |- pages/                         # user pages (club, players, tactics, ai, pvp, gacha)
|  |  |  |- pages/admin/                   # admin login + admin dashboard
|  |  |  |- hooks/                         # react-query hooks for all APIs
|  |  |  |- components/                    # UI and feature components
|  |  |  |- lib/                           # api client, query client, constants
|  |  |  |- types/                         # shared TS types
|- deployments/docker/
|  |- docker-compose.dev.yml
```

## 3) Current Features

### Authentication & Session

- User register/login
- Admin login route rieng
- JWT auth cho user va admin
- Session endpoint (`/api/v1/auth/me`)
- Starter team assignment cho user moi (`/api/v1/auth/team`)

### Club Hub

- Club dashboard sau login
- Load club detail theo team da gan
- Hien budget, rank point, logo, league

### Players (User)

- List danh sach user player cards
- Auto level-up theo EXP (toi da level 36)
- Allocate/de-allocate stats theo diem hien co
- Validate khong am bonus stat, khong vuot current points

### Tactics

- Support 2 formation: `4-3-3`, `4-4-2`
- Config passRatio/shotRatio/pressure
- Gameplay tuning profile theo mode (`ranked`, `casual`, `ai_campaign`)
- Save lineup (slot + position + userPlayerId)
- Push tactics vao realtime match engine

### AI Campaign

- Campaign 50 stages
- Stage progression: thang moi mo khoa stage tiep theo
- Stage detail (club, enemy stat bonus, reward)
- Submit result stage (win/lose)
- Grant reward money + player exp khi win

### Match & Realtime

- Start match (`/api/v1/matches/start`)
- Finalize match (`/api/v1/matches/:matchId/finalize`)
- Realtime tick stream qua Socket.IO gateway: `/ws`
- Reconnect replay support tick moi nhat theo matchId
- Realtime substitution event: `match.substitute`

### Gacha

- List active banners
- Roll banner (`/api/v1/gacha/roll`)
- Pity logic:
  - Ty le special co ban: 10%
  - Guaranteed special khi >= 80 rolls khong ra special
- Tru budget team moi roll (cost hien tai: 360000)
- Add player card vao user inventory sau roll
- Track progress (`totalRolls`, `rollsSinceSpecial`)

### Admin Features

- Country management: list/create
- League management: list/create/update/delete
- Club management: create
- Player management:
  - list/detail/create/update/delete
  - upload avatar/image
  - stat validation + season validation + position profile
- Skill management:
  - list/create skill
  - assign/remove skill cho player
- Gacha banner management:
  - upload banner image
  - create banner (bannerCode, bannerName, playerId, timeEnd)
  - list banners

### Data & Platform

- Tu dong tao database neu chua ton tai
- AutoMigrate schema khi service startup
- Seed countries mac dinh
- Trigger gioi han user toi da 50 player cards

### Frontend UX Status

- Da co flow day du cho: Auth, Club, Players, Tactics, AI Campaign, Gacha, Admin
- PvP page hien tai o muc lobby/placeholder UI, cho backend matchmaking realtime full flow
- Match viewer co event feed + score + stats + animation layer

## 4) Main API Groups

- Public:
  - `GET /health`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/register`
  - `POST /admin/login`
  - `GET /api/v1/auth/clubs`

- Authenticated user (`/api/v1`):
  - auth/session/team
  - clubs
  - ai stages/result
  - tactics
  - players
  - gacha (roll/progress/banners)
  - matches (start/finalize)

- Admin (`/api/v1/admin`):
  - countries/leagues/clubs
  - players CRUD
  - skills CRUD gan vao player
  - upload image
  - gacha banners

## 5) Run Project

### Option A - Docker (recommended for quick start)

```bash
cd deployments/docker
docker compose --env-file ../../.env -f docker-compose.dev.yml up -d
```

Default services:

- MySQL: `localhost:3306`
- Redis: `localhost:6379`
- Backend: `http://localhost:3001`
- Frontend: `http://localhost:3000`

### Option B - Local dev

1. Start MySQL va tao DB `fifam_dev` (neu chua co)
2. Run backend:

```bash
cd apps/server
npm install
npm run dev
```

3. Run frontend:

```bash
cd apps/web
npm install
npm run dev
```

### Important ENV

Backend (`apps/server`):

- `HOST_PORT` (default `3001` in `.env.example`)
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
- `REDIS_HOST`, `REDIS_PORT`
- `JWT_SECRET` (default `fifam-dev-secret`)

Frontend (`apps/web`):

- `VITE_API_BASE_URL` (default `https://apifootball.b4f.site` in `.env.example`)
- `VITE_SOCKET_BASE_URL` (default `https://apifootball.b4f.site` in `.env.example`)
- `VITE_SOCKET_PATH` (default `/socket.io`)

## 6) Notes

- File `database/schema.sql` chi la note huong dan; schema source of truth dang nam o backend bootstrap/migration code.
- Mot so module nhu `match`, `realtime`, `club`, `gacha` da vao production-shape; `pvp matchmaking` van trong giai doan hoan thien.
