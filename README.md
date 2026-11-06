# Betterflow

Nền tảng cho công cụ tạo roadmap học tập và onboarding nội bộ, theo Project Brief Phase 1.
Repo này dựng sẵn môi trường phát triển để nhóm có thể chia việc theo tính năng.

## Phạm vi hiện tại

Đã có:

- npm workspaces gồm `client/` và `server/`, dùng chung lockfile.
- React, Vite, TypeScript strict, React Router và TanStack Query.
- Trang khởi động responsive và trang 404.
- API client, error boundary và trạng thái kết nối FE/BE.
- Express 5, CORS, Helmet, giới hạn JSON payload, format lỗi và shutdown.
- PostgreSQL pool, kiểm tra phiên bản 18, migration runner có transaction, checksum và advisory lock.
- ESLint, Prettier, Vitest, Playwright và GitHub Actions.
- Các dependency theo brief: `@xyflow/react`, `html-to-image`, `@dagrejs/dagre`, `pg`, `bcrypt`, `jsonwebtoken`.

Chưa triển khai: đăng ký/đăng nhập, JWT middleware, CRUD roadmap, chỉnh sửa/nối node, persistence, chia sẻ, markdown parser, auto layout và xuất file.
Không có schema nghiệp vụ, tài khoản mẫu hoặc dữ liệu giả được lưu trên backend.
Các tính năng được để lại cho intern triển khai theo từng task.
Checklist contract cần nhóm chốt nằm trong [docs/contracts.md](docs/contracts.md).

## Design system frontend

FE dùng preset **AI Labs**, tải bằng `npx designdotmd add ai-labs` và lưu nguyên bản tại [design.md](design.md).
CSS tokens dùng chung nằm trong `client/src/styles/tokens.css`, gồm màu, typography, khoảng cách và bo góc.
IBM Plex Sans và IBM Plex Mono được đóng gói local để không cần tải font từ dịch vụ bên ngoài lúc mở trang.
Dùng nền trắng giấy, viền mảnh, màu phẳng và một hành động chính màu xanh trên mỗi màn hình.
Nhãn nút xanh dùng chữ đen để giữ độ tương phản ở cỡ chữ nhỏ.
Intern nên tái sử dụng các tokens này khi triển khai các màn hình Phase 1.

## Yêu cầu

- Node.js 24.x và npm 11 trở lên (`.nvmrc` đã chỉ định Node 24).
- PostgreSQL 18.x mới nhất trong major 18 và CLI `psql` nếu làm việc với database.
- Git.

FE và API liveness chạy được khi chưa cấu hình database.
Các lệnh `db:*` và readiness cần PostgreSQL thật.

Toolchain dùng override `minimatch >=11.0.1` để tránh [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) trong dependency của ESLint.
Gỡ override khi các dependency cha đã nâng lên bản vá tương ứng.

## Chạy từ đầu

Tại root repo:

```sh
nvm use
npm ci
cp client/.env.example client/.env
cp server/.env.example server/.env
npm run dev
```

- Frontend: `http://127.0.0.1:5173`.
- API: `http://localhost:3001/api/health`.
- Vite proxy `/api/*` sang backend local, nên không cần điền `VITE_API_URL` khi phát triển.
- Các giá trị trống trong `.env.example` dùng default local, trừ các biến secret/database không có default.
- Nếu cổng 5173 bị chiếm, Vite báo lỗi thay vì âm thầm đổi cổng.

Không commit các file `.env` vừa tạo.
Các file này đã được đưa vào `.gitignore`.

## Database local

Cài PostgreSQL 18 và khởi động dịch vụ theo hệ điều hành của bạn.
Kiểm tra CLI và tạo database bằng tài khoản PostgreSQL local của bạn:

```sh
psql --version
createdb betterflow
psql -d betterflow -c 'SELECT version();'
```

Điền vào `server/.env` với thông tin local thực tế:

```dotenv
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/betterflow
```

Chạy từ root:

```sh
npm run db:check
npm run db:migrate
curl http://localhost:3001/api/health/ready
```

Chưa có domain migration; runner chỉ tạo bảng theo dõi `schema_migrations`.
Sau khi nhóm chốt schema, thêm file SQL theo [quy ước migration](server/db/migrations/README.md).
Chạy migration bằng connection trực tiếp, đặc biệt khi dùng Neon, để advisory lock nằm trên cùng session.
Không chạy migration tự động lúc khởi động API hoặc trong request serverless.
`server/db/seed.sql` hiện chỉ là nơi dành cho fixtures local sau khi schema được duyệt.

## Biến môi trường

| File          | Biến             | Default local / mục đích                                         |
| ------------- | ---------------- | ---------------------------------------------------------------- |
| `client/.env` | `VITE_API_URL`   | `/api`; khi deploy dùng URL đầy đủ của backend, có hậu tố `/api` |
| `server/.env` | `NODE_ENV`       | `development`; production yêu cầu DB và JWT secret               |
| `server/.env` | `PORT`           | `3001`                                                           |
| `server/.env` | `CLIENT_ORIGIN`  | `http://localhost:5173`; khi deploy đặt đúng origin của FE       |
| `server/.env` | `DATABASE_URL`   | Không có default; PostgreSQL 18 local hoặc Neon                  |
| `server/.env` | `JWT_SECRET`     | Không có default; ít nhất 32 ký tự, dành cho tính năng auth      |
| `server/.env` | `JWT_EXPIRES_IN` | `1d`; chưa được sử dụng cho đến khi triển khai auth              |

`CLIENT_ORIGIN` là một origin duy nhất, không phải danh sách phân tách bằng dấu phẩy.
Ở local, khi gọi API trực tiếp qua trình duyệt tại `127.0.0.1`, đặt `CLIENT_ORIGIN=http://127.0.0.1:5173` nếu không đi qua Vite proxy.
Không đưa secret vào biến `VITE_*` vì Vite nhúng chúng vào bundle trình duyệt.
Để tạo secret local cho tính năng auth, có thể dùng:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

## Lệnh hằng ngày

| Lệnh tại root          | Chức năng                                        |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Chạy đồng thời frontend và backend               |
| `npm run typecheck`    | Kiểm tra kiểu ở hai workspace và browser tests   |
| `npm run lint`         | ESLint, không chấp nhận warning                  |
| `npm run format`       | Định dạng các file bằng Prettier                 |
| `npm run format:check` | Kiểm tra format                                  |
| `npm test`             | Test HTTP API và cấu hình, không cần DB          |
| `npm run build`        | Build FE vào `client/dist`, BE vào `server/dist` |
| `npm run check`        | Format, lint, typecheck, test và build           |
| `npm run test:e2e`     | Browser smoke tests trên desktop và mobile       |

Chuẩn bị browser một lần trước khi chạy E2E:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright tự khởi động FE/BE khi chưa có dev server.
Smoke tests kiểm tra API qua Vite proxy, routing, reload URL và tràn chiều ngang.
API tests mock lớp database để chạy độc lập, không thay thế kiểm thử PostgreSQL thật.
Kiểm tra production build local bằng `npm run start -w server` và `npm run preview -w client` ở hai terminal, đồng thời đặt `VITE_API_URL=http://localhost:3001/api` trước khi build FE vì preview không dùng dev proxy.
Khi mở preview tại `http://127.0.0.1:4173`, cấu hình backend `CLIENT_ORIGIN=http://127.0.0.1:4173`.

## Cấu trúc

```text
betterflow/
├── client/
│   ├── src/
│   │   ├── app/                # Router, layout, page shells
│   │   ├── features/           # Hiện chỉ có system health API
│   │   └── lib/                # API client, query client
│   └── vercel.json             # SPA fallback
├── server/
│   ├── src/
│   │   ├── app.ts              # Express app, không listen
│   │   ├── index.ts            # Local listener
│   │   ├── config/             # Environment validation
│   │   ├── db/                 # PostgreSQL pool
│   │   ├── middleware/         # Error handler
│   │   └── routes/             # Health endpoints
│   ├── db/
│   │   ├── migrations/         # SQL đánh số, chưa có domain schema
│   │   ├── migrate.ts
│   │   └── seed.sql
│   └── tests/
├── docs/contracts.md           # Checklist để nhóm tự chốt thiết kế
├── e2e/
├── .github/workflows/ci.yml
└── AGENTS.md
```

## API đã triển khai

| Method | Endpoint            | Response                                                                                      |
| ------ | ------------------- | --------------------------------------------------------------------------------------------- |
| GET    | `/api/health`       | `200`, `{ "data": { "status": "ok", "service": "betterflow-api" } }`                          |
| GET    | `/api/health/ready` | `200` khi PostgreSQL 18 sẵn sàng; `503` nếu chưa cấu hình, không truy cập được hoặc sai major |

Thành công dùng envelope `{ data: ... }`.
Lỗi dùng `{ error: { code, message } }`, không trả stack trace hoặc connection string.
Endpoint chưa có trả `404 NOT_FOUND`, không trả dữ liệu giả cho các tính năng chưa xây dựng.
Trạng thái API trên UI là liveness, không đại diện cho database đã sẵn sàng.

## Phát triển theo nhóm

Đọc `AGENTS.md` và chốt các mục trong `docs/contracts.md` trước khi bắt đầu tính năng.
Phân công dự kiến từ brief: Quang phụ trách auth/API/share, Thắng phụ trách canvas/danh sách/xem share/PNG, Huy phụ trách markdown/auto layout/export markdown.
Tạo `develop` và các nhánh `feature/<tên-tính-năng>` theo Gitflow của nhóm.
Mỗi PR chỉ nên giải quyết một phần nhỏ, kèm cách test và ảnh UI khi có thay đổi giao diện.
Cần ít nhất một peer approve, sau đó mentor review trước khi merge.
Repo có PR template và CI; branch protection cùng GitHub Projects cần được thiết lập trên GitHub bởi người quản lý repo.

## Chuẩn bị deploy

Chưa có bản deploy trong scaffold này.
Khi triển khai sản phẩm, tạo hai project Vercel từ cùng repo, Root Directory là `client` và `server`.
Cho phép đọc file ngoài Root Directory vì hai workspace dùng `tsconfig.base.json` tại root.
Giữ npm workspace detection và lockfile tại root repo.

- FE: framework Vite, build `npm run build`, output `dist`; đặt `VITE_API_URL=https://<backend-domain>/api` trước khi build.
- BE: framework Express, entrypoint `server/src/app.ts` export default app; không dùng `dist/index.js` làm serverless handler.
- BE production: đặt `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN` và `JWT_EXPIRES_IN` trong dashboard Vercel.
- Neon: chọn PostgreSQL 18, dùng pooled connection string cho runtime API; giữ thông số TLS từ Neon.
- Migration: chạy ngoài request bằng direct connection string trước khi đưa API mới vào sử dụng.
- CORS: `CLIENT_ORIGIN` phải khớp domain FE, không có dấu `/` cuối URL.
- Kiểm tra refresh URL, liveness và readiness sau deploy.

Tài liệu tham khảo: [Vite](https://vite.dev/guide/), [React Flow](https://reactflow.dev/learn), [Express trên Vercel](https://vercel.com/docs/frameworks/backend/express).
