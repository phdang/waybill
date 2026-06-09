#!/bin/bash

# =========================================================================
# WAYBILL DEPLOYMENT SCRIPT WITH PM2
# =========================================================================

# Đóng script ngay lập tức nếu có bất kỳ lệnh nào bị lỗi
set -e

PROJECT_DIR="/home/waybill"
APP_NAME="waybill-expense-tracker"
MAIN_SCRIPT="dist/index.js"

echo "🚀 [Waybill] Bắt đầu quá trình khởi chạy/cập nhật dự án..."

# Di chuyển vào thư mục dự án
cd "$PROJECT_DIR" || { echo "❌ Không tìm thấy thư mục dự án tại $PROJECT_DIR"; exit 1; }

# 1. Cài đặt/Cập nhật Dependencies
echo "📦 [1/4] Kiểm tra và cài đặt các gói phụ thuộc (Dependencies)..."
npm install --quiet

# 2. Đồng bộ cấu hình Database Schema với PostgreSQL via Drizzle
echo "🗄️ [2/4] Đang đồng bộ Database Schema (Drizzle Push)..."
npm run db:push

# 3. Biên dịch source code từ TypeScript sang JavaScript
echo "🏗️ [3/4] Biên dịch mã nguồn TypeScript sang Production-ready JS..."
npm run build

# Kiểm tra xem file build có tồn tại không trước khi ném cho PM2
if [ ! -f "$MAIN_SCRIPT" ]; then
    echo "❌ Lỗi: Không tìm thấy file biên dịch tại $MAIN_SCRIPT!"
    exit 1
fi
npm run start
