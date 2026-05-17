# FIFAM 11v11 - Full-stack Boilerplate

Web game boilerplate for football management 11v11.

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Golang + Gin
- Database: MySQL (local dev default `root/1234`)
- Real-time: WebSocket

## Repository Layout

- `apps/web`: Frontend client
- `apps/service-core`: Core domain APIs + realtime match engine + websocket/sse
- `deployments/docker`: Local Docker Compose files
- `database`: SQL helper files

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

3. Start backend service:

```bash
cd apps/service-core && go run ./cmd/server
```

## API Endpoints

- `GET /health`
- `GET /api/v1/clubs/:id` (service-core)
- `GET /ws` (service-core)
- `GET /sse/match` (service-core)
- `POST /api/v1/tactics` (service-core, auto-push to in-process match engine)
- `POST /api/v1/gacha/roll` (service-core, 90/10 + pity 51)
- `GET /api/v1/ai/stages` (service-core, danh sách 50 màn + trạng thái khóa/mở)
- `GET /api/v1/ai/stages/:stageNo` (service-core, chi tiết màn + đội hình 22 cầu thủ đối thủ)
- `POST /api/v1/ai/stages/:stageNo/result` (service-core, cập nhật kết quả thắng/thua để mở màn mới)

### Feature

- Đăng ký, đăng nhập , khi mới tạo account sẽ được chọn đội bóng, đặt tên CLB => bao gồm 22 thẻ cầu thủ mùa thường, tối đa 1 user có thể có 50 cầu thủ

- main page sẽ bao gồm quản lí đội bóng, chiến thuật, đấu với máy, đấu với người, gacha cầu thủ, và admin page ( chỉ admin mới có quyền truy cập )

- Thẻ cầu thủ bao gồm chiều cao, chuyền sút, và các chỉ số cơ bản của cầu thủ + kĩ năng (các kĩ năng đặc biệt có thể buff chỉ số), câu lạc bộ gốc và quốc gia theo `country_id`. Dữ liệu quốc gia lưu ở bảng `countries` theo format `name`, `code`, `flag` và khi lấy chi tiết cầu thủ sẽ map để hiển thị ảnh cờ quốc gia. Tất cả cầu thủ có các field chỉ số cơ bản giống nhau, chỉ có kĩ năng đặc biệt là có thể khác. Tổng chỉ số cầu thủ bằng trung bình các chỉ số. Có các thẻ mùa đặc biệt và mùa thường. Cầu thủ có 36 level, mỗi level tăng có thể tăng chỉ số (tùy ý hoặc tự động).

- Các kĩ năng đặc biệt bao gồm các hình ảnh hoặc icon đại diện

- Các chế độ thi đấu:

* đấu với máy theo từng màn: tạo sẵn 50 màn (màn 1 -> màn 50), mỗi màn có phần thưởng tiền + EXP tăng cho mỗi cầu thủ thi đấu.
* phải thắng màn hiện tại mới mở màn kế tiếp.
* chỉ khi người chơi bấm nút "Thi đấu" thì mới mở màn hình thi đấu.
* mỗi màn sẽ random CLB đối thủ và đội hình 22 cầu thủ của CLB đó; chỉ số cầu thủ đối thủ tăng dần khi qua màn mới.

* đấu với người ( rank) : ghép trận tự động => và thắng sẽ phân hạng từ nghiệp dư, bán chuyên, chuyên nghiệp, hạng 3, hạng 2, hạng 1 và siêu sao. 10 trận nếu thắng 6 sẽ lên hạng

- Màn hình thi đấu ( quan trọng nhất )

* tổng trận đấu : 2p

* tự động thi đấu và show tình huống bên phải

* màn hình sân banh sẽ gồm 22 cầu thủ ( các hình tròn - avatar cầu thủ - tên ) sẽ di chuyển, chuyền , sút hay các tính huống đá phạt, var, phạt góc , phạm lỗi, thẻ vàng. thẻ đỏ , sẽ đầy đủ.

* các hình tròn ( đại diện cho mỗi cầu thủ ) hãy chỉnh logic di chuyển cho thực tế vận tốc, chuyền banh ....

- Chỉnh chiến thuật các thông số chiến thuật như sơ đồ, pressing, tỉ lệ chuyền, sút , phòng thủ tấn công , áp lực. sẽ ảnh hưởng đến AI di chuyển của cầu thủ.

- Thêm chức năng quay gacha các cầu thủ mùa giải đặc biệt ( 50 - 60 ) lần roll sẽ chắc chắn ra 1 cầu thủ trong gói

- tạo 1 admin page để thêm cầu thủ đặc biệt hoặc cầu thủ thường

- Event trong trận

* giao banh khi bắt đầu trận, sau ghi bàn, sang hiệp 2
