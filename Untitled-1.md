fifam/
├─ apps/
│  ├─ web/                              # React + Tailwind client
│  │  ├─ public/
│  │  └─ src/
│  │     ├─ app/                        # routing, providers, app bootstrap
│  │     ├─ assets/                     # icons, images, fonts
│  │     ├─ components/                 # shared UI components
│  │     ├─ features/
│  │     │  ├─ auth/
│  │     │  ├─ club-management/
│  │     │  ├─ squad-management/
│  │     │  ├─ tactics/
│  │     │  ├─ transfer-market/
│  │     │  ├─ match-center/
│  │     │  ├─ league/
│  │     │  └─ finance/
│  │     ├─ hooks/
│  │     ├─ layouts/
│  │     ├─ services/                   # api client, websocket client
│  │     ├─ store/                      # redux/zustand
│  │     ├─ styles/
│  │     │  ├─ globals.css
│  │     │  └─ theme.css
│  │     ├─ types/
│  │     ├─ utils/
│  │     └─ main.tsx
│  │
│  ├─ api-gateway/                      # Gin gateway: auth, rate-limit, routing
│  │  ├─ cmd/
│  │  │  └─ server/
│  │  ├─ internal/
│  │  │  ├─ config/
│  │  │  ├─ middleware/
│  │  │  ├─ transport/http/
│  │  │  └─ transport/ws/
│  │  └─ pkg/
│  │
│  ├─ service-core/                     # Domain chính (monolith module-first)
│  │  ├─ cmd/
│  │  │  └─ server/
│  │  ├─ internal/
│  │  │  ├─ auth/
│  │  │  ├─ club/
│  │  │  ├─ player/
│  │  │  ├─ tactics/
│  │  │  ├─ transfer/
│  │  │  ├─ match/
│  │  │  ├─ league/
│  │  │  └─ finance/
│  │  │
│  │  │  # mỗi module theo clean architecture:
│  │  │  # domain/      -> entity, repository interface
│  │  │  # usecase/     -> business rules
│  │  │  # repository/  -> mysql implementation
│  │  │  # delivery/    -> gin handlers, ws handlers
│  │  └─ pkg/
│  │
│  └─ service-realtime/                 # Xử lý websocket scaling riêng
│     ├─ cmd/server/
│     ├─ internal/
│     │  ├─ hub/                        # connection manager
│     │  ├─ rooms/                      # match rooms
│     │  ├─ events/                     # event definitions
│     │  ├─ broadcaster/
│     │  └─ transport/ws/
│     └─ pkg/
│
├─ packages/
│  ├─ contracts/                        # API contracts, event schemas
│  ├─ ui/                               # shared UI library (optional)
│  ├─ config/                           # eslint, tsconfig, prettier, tailwind presets
│  └─ utils/                            # shared helper
│
├─ deployments/
│  ├─ docker/
│  │  ├─ docker-compose.dev.yml
│  │  └─ docker-compose.prod.yml
│  ├─ k8s/                              # manifests nếu lên Kubernetes
│  └─ nginx/
│
├─ database/
│  ├─ migrations/
│  ├─ seeds/
│  └─ docs/
│
├─ scripts/
│  ├─ dev/
│  ├─ build/
│  └─ ci/
│
├─ docs/
│  ├─ architecture/
│  ├─ api/
│  ├─ realtime/
│  └─ product/
│
├─ .env.example
├─ Makefile
├─ README.md
└─ go.work                              # nếu dùng multi-module Go