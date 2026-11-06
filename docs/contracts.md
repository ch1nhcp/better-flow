# Các contract cần nhóm thống nhất

Trạng thái: **CHƯA CHỐT**.
Scaffold chưa triển khai schema hoặc API nghiệp vụ.
Nhóm ghi quyết định vào đây trước khi intern bắt đầu các task tương ứng.

## Schema database

- [ ] Bảng user và ràng buộc email.
- [ ] Bảng roadmap, quyền sở hữu và cách lưu graph.
- [ ] Token chia sẻ, cách bật/tắt và thu hồi link.
- [ ] Quy tắc timestamp và xóa dữ liệu.

Quyết định: chưa có.

## API contract

- [ ] Endpoint, request và response cho auth.
- [ ] Endpoint, request và response cho CRUD roadmap.
- [ ] Endpoint private/public cho chia sẻ.
- [ ] Validation, status code và quyền truy cập.

Scaffold đã dùng tiền tố `/api` và success envelope `{ data: ... }`.
Error envelope hiện tại là `{ error: { code, message } }`.
Các health endpoint được mô tả trong README.
Mọi API nghiệp vụ còn lại chờ nhóm thiết kế.

## Định dạng graph dùng chung

- [ ] Kiểu node, label, description, position và ID.
- [ ] Kiểu edge và quy tắc kết nối.
- [ ] Phiên bản dữ liệu và viewport nếu cần.
- [ ] Validation và giới hạn kích thước.

Canvas, Playground và backend phải dùng cùng định dạng sau khi được chốt.

## Markdown Playground

- [ ] Heading, bullet, indent và mô tả.
- [ ] Quy tắc sinh node/edge và ID.
- [ ] Auto layout và xử lý cú pháp lỗi.
- [ ] Khả năng export/import lại graph, đặc biệt với cạnh nối chéo.

Quyết định: chưa có.

## Ghi nhận thống nhất

Bổ sung ngày, người tham gia và quyết định sau buổi kick-off.
