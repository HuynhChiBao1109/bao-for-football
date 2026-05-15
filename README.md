# FIFAM 11v11 - Full-stack Boilerplate

Web game boilerplate for football management 11v11.

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Golang + Gin
- Database: MySQL (local dev default `root/1234`)
- Real-time: WebSocket

## Repository Layout

- `apps/web`: Frontend client
- `apps/api-gateway`: Gateway service + websocket entry
- `apps/service-core`: Core domain APIs (Clean Architecture style)
- `apps/service-realtime`: Realtime broadcast hub
- `deployments/docker`: Local Docker Compose files
- `database/migrations`: SQL migrations

## Quick Start (Local)

1. Run MySQL (Docker):

```bash
docker compose -f deployments/docker/docker-compose.dev.yml up -d mysql
```

2. Start frontend:

```bash
cd apps/web
npm run dev
```

3. Start backend services in separate terminals:

```bash
cd apps/api-gateway && go run ./cmd/server
cd apps/service-core && go run ./cmd/server
cd apps/service-realtime && go run ./cmd/server
```

## API Endpoints

- `GET /health`
- `GET /api/v1/clubs/:id` (service-core)
- `GET /ws` (gateway and realtime)
- `POST /api/v1/tactics` (service-core, auto-push to realtime)
- `POST /api/v1/gacha/roll` (service-core, 90/10 + pity 51)


### Feature
- Đăng ký, đăng nhập , khi mới tạo account sẽ được chọn đội bóng, đặt tên CLB => bao gồm 22 thẻ cầu thủ mùa thường, tối đa 1 user có thể có 50 cầu thủ

- main page sẽ bao gồm quản lí đội bóng, chiến thuật, đấu với máy, đấu với người, gacha cầu thủ, và admin page ( chỉ admin mới có quyền truy cập )

- Thẻ cầu thủ bao gồm chiều cao, chuyền sút, và các chỉ số cơ bản của cầu và kĩ năng ( các kĩ năng đặc biệt có thể buff chỉ số ), câu lạc bộ ( gốc ), quốc gia. Tất cả cầu thủ có các field chỉ số cơ bản giống nhau chỉ có kĩ năng đặc biệt là có thể khác. Tổng chỉ số cầu thủ bằng tất cả + lại và chia ra. Và có các thẻ cầu thủ mùa đặc biệt và các mùa thường. Cầu thủ sẽ có 36 level, mỗi level tăng có thể tăng chỉ số ( tùy ý hoặc nhấn tự động )

- Các kĩ năng đặc biệt bao gồm các hình ảnh hoặc icon đại diện

- Các chế độ thi đấu:

+ đấu với máy theo từng màn , mỗi màn sẽ có phần thưởng tiền + exp tăng cho mỗi cầu thủ thi đấu.

+ đấu với người ( rank) : ghép trận tự động => và thắng sẽ phân hạng từ nghiệp dư, bán chuyên, chuyên nghiệp, hạng 3, hạng 2, hạng 1 và siêu sao. 10 trận nếu thắng 6 sẽ lên hạng

- Màn hình thi đấu ( quan trọng nhất )

+ tổng trận đấu : 2p

+ tự động thi đấu và show tình huống bên phải

+ màn hình sân banh sẽ gồm 22 cầu thủ ( các hình tròn - avatar cầu thủ - tên ) sẽ di chuyển, chuyền , sút hay các tính huống đá phạt, var, phạt góc , phạm lỗi, thẻ vàng. thẻ đỏ , sẽ đầy đủ.

+ các hình tròn ( đại diện cho mỗi cầu thủ ) hãy chỉnh logic di chuyển cho thực tế vận tốc, chuyền banh ....

- Chỉnh chiến thuật các thông số chiến thuật như sơ đồ, pressing, tỉ lệ chuyền, sút , phòng thủ tấn công , áp lực. sẽ ảnh hưởng đến AI di chuyển của cầu thủ.

- Thêm chức năng quay gacha các cầu thủ mùa giải đặc biệt ( 50 - 60 ) lần roll sẽ chắc chắn ra 1 cầu thủ trong gói

- tạo 1 admin page để thêm cầu thủ đặc biệt hoặc cầu thủ thường