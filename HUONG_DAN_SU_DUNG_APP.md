# 📘 SỔ TAY HƯỚNG DẪN SỬ DỤNG: C.H.L LOGISTICS - XỬ LÝ SAO KÊ V2.1
*Tài liệu dành cho Kế toán viên / Người dùng mới*

---

## 🌟 1. GIỚI THIỆU CHUNG
**Hệ thống Xử lý Sao kê C.H.L Logistics V2.1** là phiên bản tự động hóa tối thượng, thay thế hoàn toàn cho quy trình Copy/Paste hàm VLOOKUP thủ công cực kỳ vất vả trước đây. 

Phần mềm được thiết kế dưới dạng Web App mang bộ nhận diện thương hiệu Cam đặc trưng của C.H.L. App chạy nội bộ trực tiếp trên trình duyệt, đảm bảo **Bảo mật Tuyệt đối** (Dữ liệu tài chính không bao giờ rời khỏi thiết bị của bạn) và Không phát sinh độ trễ mạng hay chi phí vận hành Server.

### Tính năng Đột phá V2.1:
- **Tự nhận diện Cấu trúc (Dynamic Parsing):** Không phụ thuộc dòng cứng, thả sao kê ngân hàng vào rác cỡ nào phần mềm cũng tự động quét dò tìm trúng vùng dữ liệu chứa tiền.
- **Micro-Rule Engine Đặc Biệt:** Tự động cắt tách chuỗi thông minh (Ví dụ: Trích xuất nội dung gốc của ngân hàng MB Bank, tự động loại bỏ rác hệ thống `CUSTOMER MBCT`).
- **Giao diện Kế toán Hạch Toán (Rule-Builder):** Chức năng cấu hình Tự động nhảy số Tài khoản (Ví dụ: Thấy chữ "TẠM ỨNG" tự nhảy Nợ 141) hoàn toàn bằng chuột mà không phụ thuộc IT.
- **Hoàn tác Tốc độ cao & Chống Tràn RAM:** Hỗ trợ Undo 20 bước chỉnh sửa dạng Delta-Patching (Chỉ lưu vết thay đổi), giúp phần mềm chạy mượt mà ngay cả khi xử lý file lưới lên tới chục ngàn dòng. 
- **Auto-Sync (Đồng bộ hàng loạt):** Sửa một mã lỗi, các dòng chứa cụm từ tương đương lập tức được áp dụng Regex Tiếng Việt chuẩn xác (Chống dò nhầm như lúc dùng VLOOKUP hàm thường).

---

## ⚙️ 2. THIẾT LẬP CẤU HÌNH BAN ĐẦU (Chỉ cần làm 1 lần)
Hệ thống cần nắm được danh mục tài khoản công ty để có thể tự hành.

1. **Nạp Từ Điển Định Danh:**
   - Nhấp **"⚙️ Master Data"** ở góc cao.
   - Nạp tệp Excel **`TEMPLATE_MASTER_DATA.xlsx`** (Chứa danh mục Khách Hàng, Mã Từ Điển, Các quy tắc hạch toán) cho máy học.
2. **Cấu Trúc Tự Định Khoản (Rule-Builder):**
   - Bấm nút **"📋 Quy tắc hạch toán"**.
   - Tại đây, bạn có quyền gán tự động hệ thống Tài khoản Nợ / Có vào một lệnh Thu Hoặc Chi bằng cách gõ 1 chữ khóa (VD `LƯƠNG` ➔ Chi ➔ Nợ: 334, Có: 1121).

---

## 🚀 3. HƯỚNG DẪN SỬ DỤNG VẬN HÀNH (LUỒNG 4 BƯỚC)

### BƯỚC 1: Tải lên Sao Kê Ngân Hàng
- Lấy thẳng file sao kê nguyên bản tải từ BIDV, MB Bank...
- Mở App và Kéo thả file đó vào ô vùng chọn đứt nét.

### BƯỚC 2: Kiểm tra & Lọc lưới Dữ Liệu
- Hệ thống sẽ rải dữ liệu ra lưới màn hình mượt mà.
- **Trạng thái:** Dòng đã ăn khớp tên đối tác biểu thị Vạch lá. Dòng bị thiếu biểu thị dấu **⚠️ CHECK_AGAIN**.
- Lợi dụng khay lọc đa tầng (Lọc Tiền, Lọc File Gốc, Lọc Nội Dung) hoặc dùng nút bấm ✖ Xóa Lọc để dọn màn hình nhanh.

### BƯỚC 3: Dạy Trí Tuệ Nhân Tạo & Sửa Lỗi Ngay (Inline-Edit)
- Nhấp đúp chuột lên mô tả hoặc ô Cờ vàng.
- Nổi lên Form (có hỗ trợ nhún văn bản kéo xuống dài dể đọc). Nhập dòng mã Misa chuẩn và ấn **Lưu lại**. Ngay lập tức đối tác này sẽ được ghi vào bộ nhớ phục vụ luôn lần xử lý sau!
- *Nút Mũi Tên Góc Trái (Undo)* làm "thuốc hồi sinh" nếu bạn trót gõ điền nhầm.

### BƯỚC 4: Xuất Hậu đài cho MISA AMIS
1. Bấm **"Tiếp tục: Xuất AMIS"**. 
2. Điền STT nối tiếp cho 2 cột Báo Có và Báo Nợ (Ví dụ bạn đang làm dở số Phiếu thứ `.03` của sáng nay, thì sẽ nhập số bắt đầu chạy là `4`).
3. Nhấn 2 nút Tải về (Đỏ - Xanh). Có ngay tệp `BAO_NO` và `BAO_CO` cực chuẩn, kéo thả một chạm vào MISA để ghi nhận hạch toán xong trong phút mốt!

---

## 🛠 4. KINH NGHIỆM XỬ LÝ QUAN TRỌNG
- Khi sử dụng dài ngày, **Đừng quên bấm Tải Cấu hình Excel định kỳ** trong mục Setting của App Master Data để Back-up lưu trữ trí tuệ máy do nhân sự dạy cho App.
- Máy bị quá tải giới hạn 5MB cho Trình duyệt web? App đã được trang bị thuật chống Die màn hình, nó sẽ hiện lên *Còi vàng "Cảnh Báo Quota"* để báo hiệu. Tín hiệu này khuyên bạn nên Refresh giải phóng tải file lại để tránh hiện tượng mất dữ liệu (Session Save Disabled)!
