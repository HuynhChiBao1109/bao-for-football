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

## Thông tin thẻ cầu thủ

- Tên cầu thủ, avatar, quốc tịch, câu lạc bộ, mùa giải (bình thường hay đặc biệt)
- Chỉ số cơ bản (không thể chỉnh sửa): Chiều cao, độ dài chân, format body type (dựa trên chiều cao và độ dài chân),
- Chỉ số kỹ năng (có thể tăng khi lên level): Dứt điểm, chuyền ngắn, chuyền dài, tầm nhìn, GK REACH, nhận thức tấn công, nhận thức phòng thủ, GK parrying, GK reflexes, tranh chấp, tắc bóng, xoạc bóng, tốc độ, thể lực, thăng bằng, kỹ thuật, quyết đoán, sức mạnh, rê bóng, sút xoáy
- Kỹ năng đặc biệt (admin sẽ thêm vào) và có thể chỉnh sửa: Bao gồm image kỹ năng và hiệu ứng buff chỉ số (ví dụ: +5 tốc độ, +3 dứt điểm, ...)

## Event trong trận

### giao banh khi bắt đầu trận, sau ghi bàn, sang hiệp 2

### Logic Phạm Lỗi (Foul & Card Simulation Logic)

Match Engine Core xử lý logic phạm lỗi dựa trên các thông số chiến thuật (Pressing, Aggression), chỉ số ẩn của cầu thủ, và trạng thái va chạm vật lý trên sân.

#### 1. Điều kiện kích hoạt Phạm lỗi (Trigger Conditions)

- **Tỷ lệ phạm lỗi (Foul Probability):** Phụ thuộc trực tiếp vào mức độ **Pressing/Áp lực** trong cài đặt chiến thuật của đội phòng ngự và chỉ số **Phòng ngự (Defense/Tackling)** của cầu thủ tranh chấp.
- **Công thức gợi ý cho Match Engine:**
  $$P(foul) = \text{Base\_Rate} \times \text{Tactical\_Pressing\_Modifier} \times (1 - \text{Tackling\_Attribute})$$
- Nếu Random Chance trúng tỷ lệ phạm lỗi khi 2 cầu thủ vòng tròn va chạm (Collision) gần bóng, trận đấu tạm dừng để xử lý Foul Event.

#### 2. Phân loại lỗi và Thẻ phạt (Foul Severity & Cards)

Khi xảy ra phạm lỗi, Match Engine sẽ tính toán mức độ nghiêm trọng (Severity Score từ `0.0` đến `1.0`):

- **Lỗi nhẹ (Minor Foul - `Score < 0.5`):**
  - Trọng tài thổi còi phạt đền/phạt trực tiếp/phạt gián tiếp.
  - Nhắc nhở (No card).
- **Thẻ vàng (Yellow Card - `0.5 <= Score < 0.85`):**
  - Phạt thẻ vàng cho cầu thủ phạm lỗi.
  - **Logic cộng dồn:** Nếu cầu thủ đã có 1 thẻ vàng trước đó $\rightarrow$ Tự động chuyển thành **Thẻ đỏ (Red Card)** và đuổi khỏi sân.
- **Thẻ đỏ trực tiếp (Straight Red Card - `Score >= 0.85`):**
  - Phạm lỗi nghiêm trọng (xoạc bóng từ phía sau, ngăn chặn cơ hội ghi bàn mười mươi).
  - Cầu thủ bị truất quyền thi đấu ngay lập tức.

#### 3. Hệ quả sau khi dính Thẻ đỏ (Red Card Consequences)

- **Frontend (UI/UX):**
  - Vòng tròn avatar của cầu thủ bị thẻ đỏ sẽ **bị xóa khỏi sa bàn 2D** (Sân bóng chỉ còn di chuyển 10 cầu thủ hoặc ít hơn).
  - Hiện thông báo Event Log ở sidebar bên phải: `[Phút X] - [Tên cầu thủ] nhận thẻ đỏ và rời sân!`
- **Backend (Match Engine):**
  - Cập nhật mảng danh sách cầu thủ đang thi đấu trên sân (Active Players).
  - **Ảnh hưởng chiến thuật:** AI di chuyển của các cầu thủ còn lại phải tự động co cụm hoặc dãn đội hình để bù đắp vào vị trí trống (Zone) của cầu thủ bị đuổi, dẫn đến giảm chỉ số phòng thủ chung của toàn đội.

#### 4. Trạng thái bóng chết sau Phạm lỗi (Set Pieces Trigger)

Tùy thuộc vào vị trí (Tọa độ X, Y) xảy ra va chạm trên sa bàn:

- **Ngoài vòng cấm (Outside Penalty Area):** Khởi động trạng thái **Đá phạt (Free Kick)**. Cầu thủ sút phạt tốt nhất sẽ thực hiện chuyền bóng hoặc sút thẳng (tùy khoảng cách đến khung thành).
- **Trong vòng cấm đội phòng ngự (Inside Penalty Area):** Khởi động trạng thái **Phạt đền (Penalty Kick)**.
  - Chuyển màn hình về trạng thái 1v1 (Thủ môn vs Cầu thủ sút phạt).
  - Tỷ lệ ghi bàn dựa trên: `Chỉ số Sút của Tiền đạo` vs `Chỉ số Thủ môn`.

#### 5. Logic VAR (Video Assistant Referee)

- **Tỷ lệ xuất hiện:** `5% - 10%` đối với các tình huống nhạy cảm (Phạt đền Penalty hoặc Thẻ đỏ trực tiếp).
- **Trạng thái Game Loop:**
  1.  Trận đấu tạm dừng $\rightarrow$ Hiển thị icon VAR trên màn hình.
  2.  Event log thông báo: _"Trọng tài đang kiểm tra VAR..."_
  3.  Sau 3 giây delay, đưa ra quyết định cuối cùng (Bẻ còi hủy phạt đền/thẻ phạt hoặc giữ nguyên quyết định).
