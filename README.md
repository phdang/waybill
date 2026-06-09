# Waybill - Trình Quản Lý Chi Tiêu Chuyến Đi (Discord Bot & REST API)

Dự án này là một ứng dụng Node.js kết hợp giữa **Discord Bot** và **REST API** để giúp bạn theo dõi chi tiêu cá nhân/nhóm trong các chuyến đi một cách tự động và thông minh. 

Dự án sử dụng **PostgreSQL** để lưu trữ dữ liệu, **Drizzle ORM** để quản lý cơ sở dữ liệu, **OpenRouter (Gemini 3.1 Flash)** cho việc phân tích ngôn ngữ tự nhiên (AI Mode) cũng như đọc ảnh hóa đơn (OCR Vision), và **Pino** để ghi log cấu trúc.

---

## 🚀 Các Tính Năng Chính

### 1. Quản lý chuyến đi (Trip Management)
- Bắt đầu một chuyến đi mới (Ví dụ: `japan-2026`). Khi bắt đầu chuyến đi mới, bot sẽ tự động đánh dấu hoàn thành chuyến đi cũ.
- Kết thúc chuyến đi hiện tại.

### 2. Ghi nhận chi tiêu thông minh (AI Mode)
- **Bằng văn bản tự do**: Không cần nhập lệnh phức tạp, chỉ cần gõ nội dung như `Ăn sáng bún bò 120k`, `Taxi đi sân bay 250k`, hoặc `Vé Disney 1800 JPY`. AI sẽ tự động phân tích để trích xuất: số tiền, loại tiền tệ, phân loại (Category) và ngày chi tiêu.
- **Bằng ảnh hóa đơn (OCR Receipts)**: Tải trực tiếp ảnh hóa đơn/biên lai lên Discord hoặc qua API. AI Vision sẽ quét ảnh hóa đơn, đọc số tiền, loại tiền tệ và lưu trữ tệp tin hóa đơn một cách bảo mật trên máy chủ local (`storage/receipts/`).

### 3. Báo cáo chi tiết (Reporting)
- Xem chi tiết danh sách chi tiêu và phân loại trong ngày (`/report today`).
- Xem báo cáo tổng hợp chi phí của chuyến đi hiện tại (`/report trip`).
- Hỗ trợ báo cáo **đa tiền tệ**: Các khoản chi tiêu bằng các đồng tiền khác nhau (ví dụ: VND, JPY, USD) sẽ được gom nhóm và tính tổng riêng biệt cho từng loại tiền, giúp quản lý chính xác hơn.

### 4. REST API cho Nhà phát triển
- Tích hợp đầy đủ các API endpoint phục vụ việc tích hợp hệ thống khác hoặc viết giao diện riêng.

---

## 🛠️ Yêu cầu hệ thống
- **Node.js**: Phiên bản `v18.x` trở lên (Khuyến nghị `v22.x` trở lên)
- **npm**: Phiên bản `10.x` trở lên
- **PostgreSQL**: Cơ sở dữ liệu đang chạy và cho phép kết nối.

---

## ⚙️ Cấu hình file `.env`

Tạo file `.env` ở thư mục gốc của dự án và điền đầy đủ các thông tin cấu hình sau:

```env
PORT=5600
DATABASE_URL=postgresql://postgresUser:postgresUserPassword@localhost:5432/waybill_agent
DISCORD_TOKEN=your_discord_bot_token
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=google/gemini-3.1-flash
DISCORD_GUILD_ID=1245941253233705010
DISCORD_CHANNEL_ID=1513761937748525167
```

### Giải thích các biến môi trường:
- `PORT`: Cổng chạy ứng dụng Express server (Mặc định: `5600`).
- `DATABASE_URL`: Đường dẫn kết nối cơ sở dữ liệu PostgreSQL. *Lưu ý: Mật khẩu có chứa ký tự đặc biệt như `@` hay `!` cần được URL-encoded (ví dụ: `@` thành `%40`, `!` thành `%21`).*
- `DISCORD_TOKEN`: Token của Discord Bot của bạn.
- `OPENROUTER_API_KEY`: API Key kết nối với hệ thống OpenRouter để gọi các mô hình AI.
- `OPENROUTER_MODEL`: Model LLM sử dụng cho việc nhận diện chi tiêu và quét ảnh (Mặc định: `google/gemini-3.1-flash`).
- `DISCORD_GUILD_ID`: ID của Server Discord mà bot được phép hoạt động (ví dụ: `1245941253233705010`).
- `DISCORD_CHANNEL_ID`: ID của Channel chat trong Server Discord mà bot được phép hoạt động và ghi nhận chi tiêu (ví dụ: `1513761937748525167`).

---

## 🏁 Hướng dẫn cài đặt và khởi động dự án

### Bước 1: Tải dependencies
```bash
npm install
```

### Bước 2: Tạo và đẩy cấu trúc bảng vào Database (Drizzle Push)
Dự án sử dụng Drizzle Kit để đồng bộ schema trực tiếp với database mà không cần viết SQL thủ công:
```bash
npm run db:push
```

### Bước 3: Chạy dự án
**Chạy môi trường phát triển (Development):**
```bash
npm run dev
```

**Chạy môi trường Production:**
```bash
npm run build
npm start
```

---

## 📖 Hướng dẫn sử dụng chi tiết

### A. Qua Discord Bot

#### 1. Các lệnh Explicit (Lệnh Slash `/`)
- `/trip start name:<tên_chuyến_đi> country:<quốc_gia> currency:<tiền_tệ_cơ_sở>`: Bắt đầu chuyến đi mới.
  - *Ví dụ:* `/trip start name:japan-2026 country:Japan currency:JPY`
- `/trip end`: Kết thúc chuyến đi đang hoạt động.
- `/report today`: Hiển thị báo cáo chi tiêu ngày hôm nay.
- `/report trip id:<trip_id_tùy_chọn>`: Xem báo cáo của chuyến đi hiện tại (hoặc điền ID để xem chuyến đi cũ).

#### 2. Chat tự do (AI Mode)
Chỉ cần nhắn tin trực tiếp trong kênh chat mà bot đang lắng nghe.
- *Ví dụ 1:* `Ăn sáng bún bò 120k` -> Bot tự hiểu ghi nhận: 120,000 VND, phân loại `food`.
- *Ví dụ 2:* `Taxi sân bay 250.000` -> Bot tự hiểu ghi nhận: 250,000 VND, phân loại `transport`.
- *Ví dụ 3:* `Vé Disney 1800 JPY` -> Bot tự hiểu ghi nhận: 1,800 JPY, phân loại `ticket`.

#### 3. Quét ảnh hóa đơn
- Tải lên một hình ảnh hóa đơn/biên lai trong kênh Discord (bản thân ảnh đính kèm).
- Bot sẽ tự nhận diện hình ảnh, quét OCR các thông tin, ghi nhận chi phí và tự động tải lưu ảnh về máy chủ tại thư mục `/home/waybill/storage/receipts/`.

---

### B. Qua REST API

Mọi API đều lắng nghe mặc định trên localhost (`http://127.0.0.1:5600` hoặc cổng được định nghĩa trong `.env`).

#### 1. Tạo chuyến đi
- **Endpoint**: `POST /trips`
- **Body (JSON)**:
```json
{
  "name": "japan-2026",
  "country": "Japan",
  "base_currency": "JPY"
}
```

#### 2. Tạo chi tiêu thủ công
- **Endpoint**: `POST /expenses`
- **Body (JSON)**:
```json
{
  "amount": 120000,
  "currency": "VND",
  "category": "food",
  "description": "Ăn sáng bún cá",
  "source_type": "manual",
  "expense_date": "2026-06-09"
}
```
*Lưu ý: Phân loại (`category`) hợp lệ bao gồm: `food`, `hotel`, `transport`, `ticket`, `shopping`, `entertainment`, `medical`, `other`.*

#### 3. Tải lên hóa đơn để quét tự động (API)
- **Endpoint**: `POST /receipts/upload`
- **Body (multipart/form-data)**:
  - Key: `receipt` (Chọn File ảnh hóa đơn định dạng `.jpg`, `.png`, hoặc `.webp`, dung lượng tối đa 10MB).
- **Phản hồi**: Trả về thông tin chi tiêu đã tạo kèm đường dẫn file ảnh đã lưu trữ (UUID ngẫu nhiên).

#### 4. Xem báo cáo hôm nay
- **Endpoint**: `GET /reports/today`

#### 5. Xem báo cáo chuyến đi cụ thể
- **Endpoint**: `GET /reports/trip/:id`

---

## 🔒 An Toàn & Bảo Mật
- Các file ảnh đính kèm tải lên máy chủ đều được lọc loại bỏ các ký tự có hành vi tấn công truyền thư mục (Directory Traversal Bypass) và lưu ở một thư mục cách biệt độc lập với mã nguồn.
- Database query được viết hoàn toàn bằng ORM Drizzle, loại bỏ nguy cơ bị tấn công SQL Injection.
