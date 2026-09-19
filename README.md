# 農情「AI」語（Nong-Qing AI Yu）

為臺灣小農與中高齡農民設計的行動優先智慧農務系統。使用者可用文字、瀏覽器錄音或圖片附件建立農務紀錄，經過「AI 擷取 → 人工修正 → 草稿生成 → 再次確認」後，保存、查詢與匯出資料。

> 所有 AI 內容都只是協助整理的草稿。AI 推論與未知來源欄位不會直接成為正式資料；農場日誌與產銷履歷申報草稿必須由農民或授權人員確認。

## 文件入口

- 一般使用者、農民與農會人員：[完整使用說明書](docs/使用說明書.md)
- 線上正式網站：<https://nong-qing-ai-yu.vercel.app>
- 本 README 以下內容為開發、測試與部署文件。

## 已實作功能

- Email／密碼註冊、登入、登出，bcrypt 雜湊與 HttpOnly session cookie
- FARMER、COOPERATIVE、ADMIN 角色與農場層級權限
- 多農場、田區、作物、品種、種植資料與品牌資料
- 文字、MediaRecorder 錄音、語音轉文字 provider、圖片附件
- JPEG／PNG／WebP MIME 與大小驗證；本機或 S3 相容物件儲存
- 逐欄標示 `USER_INPUT`、`USER_PROFILE`、`OPEN_DATA`、`AI_INFERENCE`、`UNKNOWN`
- mock AI 與 Gemini provider；Zod 驗證、一次 JSON 修復、安全宣稱檢查、呼叫紀錄
- 農業問答助手：先搜尋管理員核准網站，再以引用來源回答並保存對話
- 農場日誌、產銷履歷申報草稿與七類品牌文案
- 紀錄／文案版本、外部資料快照、稽核紀錄
- 農務 CSV、日誌 PDF、品牌純文字與列印版
- 行動底部導覽、桌面側欄、高對比大按鈕、空白／錯誤／載入狀態
- 免登入 Demo Mode（只在瀏覽器記憶體運作）
- SQLite 開發資料庫與 PostgreSQL schema 產生工具
- Vitest 單元／整合測試與 Playwright E2E

## 技術架構

- Next.js 15 App Router、React 19、TypeScript strict mode
- Tailwind CSS 4、可存取性導向的自製 UI 元件
- Prisma 6；SQLite（開發）與 PostgreSQL（部署）
- Zod、bcryptjs、AWS S3 SDK、原生 Fetch、MediaRecorder
- Vitest、Playwright

## 系統流程

```mermaid
flowchart LR
  A[文字／語音／圖片] --> B[AI Provider 擷取 JSON]
  B --> C[Zod 驗證]
  C --> D[逐欄顯示來源與可信度]
  D --> E[使用者修正與補充]
  E --> F[日誌／申報／品牌草稿]
  F --> G[再次人工確認]
  G --> H[版本保存／PDF／CSV]
  I[開放資料 Provider] --> J[EvidenceSnapshot]
  J --> D
```

外部資料與 AI 輸出都不會覆蓋使用者原始資料。原始輸入、辨識文字、結構化 JSON、provider、模型、提示詞版本、原始回應、版本、佐證與最終狀態分開保存。

## 資料模型摘要

核心關聯為 `User → Farm → Plot → Planting → FarmRecord`。`FarmRecord` 連接 `RecordVersion`、`Attachment` 與 `EvidenceSnapshot`；品牌內容以 `BrandProfile → GeneratedContent → GeneratedContentVersion` 保存。`PromptTemplate`、`AIRequestLog`、`AgriculturalTerm` 與 `AuditLog` 支援管理與追溯。完整定義見 [`prisma/schema.prisma`](prisma/schema.prisma)。

## 本機安裝

需要 Node.js 22（建議 LTS）與 Corepack。此工作區在 Node.js 24 也已完成驗證。

```bash
corepack enable
corepack pnpm install
cp .env.example .env
corepack pnpm prisma migrate dev
corepack pnpm db:seed
corepack pnpm dev
```

Windows PowerShell 請用 `Copy-Item .env.example .env`。開啟 <http://localhost:3000>。

目前 repo 已包含初始 migration；一般使用者執行 `prisma migrate dev` 即可套用。若只需快速同步本機開發資料庫，可用 `corepack pnpm db:push`。

## 示範帳號

執行 seed 後可使用：

| 角色 | Email | 密碼 |
| --- | --- | --- |
| 管理員 | `admin@nongqing.local` | `Demo1234!` |
| 農民 | `farmer@nongqing.local` | `Demo1234!` |
| 農會 | `coop@nongqing.local` | `Demo1234!` |

這些帳密只能用於本機／示範環境。正式環境必須刪除或立即更換。

## 環境變數

完整範本見 [`.env.example`](.env.example)。至少需要：

```dotenv
DATABASE_URL="file:./dev.db"
SESSION_SECRET="至少 32 字元的隨機值"
AI_PROVIDER=mock
TRANSCRIPTION_PROVIDER=mock
UPLOAD_PROVIDER=local
OPEN_DATA_MODE=mock
```

### Gemini

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your-server-only-key
GEMINI_MODEL=gemini-3.8-flash
```

模型名稱完全由環境變數指定。Key 只在 route handler 使用，不會送到瀏覽器。provider 要求 JSON、以 Zod 驗證；失敗時只修復一次，第二次失敗會回傳可理解錯誤並保留安全的呼叫紀錄。

### 語音辨識

- `TRANSCRIPTION_PROVIDER=mock`：回傳固定示範辨識結果。
- `TRANSCRIPTION_PROVIDER=gemini`：使用既有 `GEMINI_API_KEY` 將錄音轉為文字；模型預設沿用 `GEMINI_MODEL`，也可用 `GEMINI_TRANSCRIPTION_MODEL` 覆寫。
- `TRANSCRIPTION_PROVIDER=external`：將 multipart `file` 送到 `TRANSCRIPTION_API_URL`，可用 `TRANSCRIPTION_API_KEY` Bearer 驗證。
- 瀏覽器錄音會轉為單聲道 16kHz WAV，最長 60 秒；辨識後會依啟用的 `AgriculturalTerm` 修正，並同時回傳修正前文字、修正後文字與差異。

### 檔案儲存

- `UPLOAD_PROVIDER=local`：存入 `uploads/`。
- `UPLOAD_PROVIDER=s3`：設定 `S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_ACCESS_KEY`、`S3_SECRET_KEY`。已啟用 path-style，可搭配 MinIO 等 S3 相容服務。
- `UPLOAD_PROVIDER=vercel-blob`：設定或由 Vercel 自動注入 `BLOB_READ_WRITE_TOKEN`，檔案使用私有 Blob 儲存。

### 可信網站搜尋佐證

管理員可在「管理後台 → 可信網站來源」新增單一網頁或允許搜尋整個同網域網站。使用者在「資料佐證」輸入問題後，搜尋代理只會接受核准來源的結果，並保存原始網址、相關段落、相關度與查詢時間。

- `WEB_SEARCH_PROVIDER=direct`：不需金鑰，直接讀取指定頁面；若選擇同網域搜尋，最多跟隨少量與問題相關的站內連結。
- `WEB_SEARCH_PROVIDER=auto`：有 `TAVILY_API_KEY` 時使用 Tavily，失敗則退回直接搜尋。
- `WEB_SEARCH_PROVIDER=tavily`：優先使用 Tavily 的網域限制搜尋，仍會驗證結果是否屬於核准來源。

搜尋結果只是佐證候選，系統不會把關鍵字相符直接判定為事實，也不會覆蓋農民資料。直接搜尋會封鎖本機／私人網路位址、限制重新導向、回應大小與逾時，以降低 SSRF 與資源耗用風險。

「農業問答」會自動使用同一份可信來源清單。若 `AI_PROVIDER=gemini` 且 Gemini 設定完整，模型只會取得搜尋到的段落並以 `[1]` 格式引用；未設定模型時仍可使用可測試的擷取式回答。找不到來源時拒絕猜測；農藥、用量與法規問題若缺少主管機關來源，不會提供確定操作結論。

## Vercel 雲端部署

本專案目前以 Vercel、Neon PostgreSQL 與 private Vercel Blob 部署。雲端 build 會執行 `pnpm vercel-build`，以 PostgreSQL schema 重新產生 Prisma client。

GitHub repository：[Zgx75/NongQing_AI_Yu](https://github.com/Zgx75/NongQing_AI_Yu)

- 推送到 `main`：Vercel 自動建立正式部署。
- 推送其他分支：Vercel 建立 Preview Deployment。
- Vercel 環境變數不會寫入 GitHub；`.env`、`.env.local` 與 `.vercel` 已被 `.gitignore` 排除。
- 若變更 Prisma schema，仍須先審核並更新正式 Neon schema；單純推送程式不會自動執行破壞性的資料庫變更。

日常更新流程：

```bash
git add .
git commit -m "說明本次修改"
git push origin main
```

```bash
vercel link
vercel blob create-store nongqing-uploads --access private --yes
vercel deploy --prod
```

部署前需在 Vercel 設定 `DATABASE_URL`、`SESSION_SECRET`、`UPLOAD_PROVIDER=vercel-blob`，並先將 schema 套用至 PostgreSQL。`GET /api/health` 可檢查資料庫與 provider 狀態，但不會顯示任何憑證。

## 開放資料 adapter

`src/lib/open-data/` 提供 weather、traceability、agricultural-price、young-farmer、rural-community 與 agricultural-open-data provider。所有 URL 由環境變數注入，不硬編碼或虛構政府 endpoint。

- `OPEN_DATA_MODE=mock`：回傳明確標示的示範資料。
- `OPEN_DATA_MODE=live`：呼叫對應 `*_API_BASE_URL`。
- 未設定或上游失敗：回傳「資料暫時無法取得」，核心農務流程仍可使用。
- 成功／失敗、查詢條件、摘要、取得時間與快取狀態會保存為 `EvidenceSnapshot`。

目前沒有預設真實政府 API URL；部署單位須依資料授權、欄位規格與使用限制自行設定並測試。

## PostgreSQL 部署

Prisma datasource provider 需在產生 client 時固定，因此開發 schema 保持 SQLite，部署前產生等價 PostgreSQL schema：

```bash
corepack pnpm db:prepare:postgres
DATABASE_URL="postgresql://user:password@host:5432/nongqing" corepack pnpm db:push:postgres
corepack pnpm prisma generate --schema prisma/schema.postgresql.generated.prisma
```

正式團隊應保留 PostgreSQL 專用 migration 歷史，而非在正式資料庫直接 `db push`。

## 測試與品質檢查

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
corepack pnpm build
```

單元測試涵蓋 Zod、欄位來源、缺漏、安全宣稱、詞彙修正、權限、日期與 PDF；整合測試涵蓋密碼、使用者、農場、田區、AI 擷取、紀錄確認與三類內容生成；E2E 走完登入、茶園紀錄、缺漏顯示、儲存與 PDF 下載。

## Docker

```bash
docker compose up --build
```

預設使用具名 volume 保存 SQLite 與上傳檔，並以 mock AI／語音／開放資料啟動。正式部署不要沿用 compose 裡的 session secret 或示範帳密。

## 主要目錄

```text
src/app/                 頁面與 API route handlers
src/components/          layout、農場、紀錄、品牌、Demo 與 UI 元件
src/lib/ai/              Gemini／mock provider、prompts、schema、安全檢查
src/lib/open-data/       可設定的開放資料 adapters 與快取
src/lib/evidence/        可信網址驗證、網頁擷取與搜尋代理
src/lib/transcription/   mock／external 語音辨識與詞彙修正
src/lib/storage/         local／S3 相容儲存
src/lib/auth/            密碼與 session
src/lib/export/          PDF 匯出
prisma/                  schema、migration、seed
tests/                   unit、integration、e2e
```

## 安全與隱私注意事項

- 正式環境必須使用高熵 `SESSION_SECRET`、HTTPS、受控資料庫帳號與物件儲存權限。
- API 使用 `SameSite=Lax` HttpOnly cookie；若未來開放跨站前端，必須加入明確 CSRF token／Origin allowlist。
- 目前 rate limiter 為單節點記憶體實作；多實例部署需替換為 Redis 或閘道層限流。
- 上傳目前驗證瀏覽器提供的 MIME 與大小；高風險環境應加入 magic-byte、惡意程式掃描與影像重新編碼。
- PDF 使用 CJK 閱讀器字型映射；要求跨閱讀器完全一致時，部署時應嵌入授權中文字型。
- AI log 預設遮罩 Email 與臺灣手機格式，但不是完整 DLP；正式環境需依組織規範擴充。
- 真實 Gemini、語音與政府資料服務的授權、費率、資料保存與個資條款需由部署單位審查。

## 已知限制與正式部署建議

- 第一版圖片是附件，不提供病蟲害診斷。
- mock 開放資料不是官方資料；未設定真實 endpoint 時不會假裝成功取得官方資訊。
- 產銷履歷內容只能稱為「申報草稿」，不構成法規合規保證。
- 正式上線前應改用 PostgreSQL、Redis 限流、S3、集中式監控／錯誤追蹤、備份與還原演練。
- 建議加入 Email 驗證、忘記密碼、MFA、session 裝置管理、附件刪除 UI 與更細緻合作社授權流程。
- 在 CI 執行 migration、lint、typecheck、Vitest、Playwright 與 production build，並定期更新依賴與執行供應鏈掃描。

農情「AI」語的基本原則是：**農民提供事實、AI 協助整理、最後由人確認。**
