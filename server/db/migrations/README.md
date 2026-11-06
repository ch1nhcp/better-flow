# SQL migrations

Chưa có domain migration vì schema cần được nhóm thống nhất.
Checklist để nhóm ghi quyết định nằm trong `docs/contracts.md` ở root repo.

- Tạo file `001_create_users.sql`, `002_create_roadmaps.sql` sau khi chốt thiết kế.
- Tên file phải đúng `NNN_snake_case.sql`, mỗi số thứ tự chỉ dùng một lần.
- Runner tự bọc mỗi file trong transaction, không viết `BEGIN` hoặc `COMMIT` trong file.
- Không dùng `CREATE INDEX CONCURRENTLY` trong migration vì câu lệnh này không chạy trong transaction.
- Không sửa hoặc xóa migration đã chạy và merge, thêm file có số lớn hơn để đổi schema.
- Runner dùng SHA-256 để phát hiện file đã chạy bị sửa và advisory lock để tránh chạy đồng thời.
- Chạy runner bằng connection trực tiếp, không dùng connection transaction pooling.
- Không đặt dữ liệu người dùng, mật khẩu hoặc secret trong migration.

Chạy từ root repo:

```sh
npm run db:check
npm run db:migrate
```

Runner chỉ tạo bảng hạ tầng `schema_migrations`, không tự tạo bảng nghiệp vụ.
