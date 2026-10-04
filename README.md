# LinkedIn → Notion 申請紀錄小幫手

在自己的 Google Apps Script 帳號部署，用按鈕把 Gmail 中的 LinkedIn 申請確認信寫入 Notion。先預覽、檢查重複，再新增資料。

## 功能

- 讀取最近 5、10、25 或 50 封繁體中文 LinkedIn 申請確認信。
- 寫入 Company、Position、Status、Website、Apply Date。
- 優先以 LinkedIn 職缺編號去重；缺少編號時以公司、職位與日期比對。
- 模糊比對標為待確認；已存在的申請及其狀態保持原樣。
- 匯入前重新核對，使用執行鎖、一次性預覽及未確認寫入標記避免重複操作。
- Gmail 權限為唯讀。無需 OpenAI、ChatGPT 或 Codex API。

## 開始前準備

你需要自己的 Google／Gmail 帳號、Notion 工作區，以及可以編輯的 Notion 資料庫。每位使用者都要在自己的帳號部署和授權。GitHub 上的程式不會替你連接帳號，也不包含任何人的金鑰。

此工具不依賴特定模板。可以建立空白 Notion 資料庫，或從下方「第三方模板與授權」的原始連結取得作者提供的模板，再設定欄位。

## 1. 準備 Notion 資料庫

打開要存求職紀錄的**原始資料庫**，依下表設定欄位名稱及類型（包含大小寫與空白）：

| 欄位 | Notion 類型 | 寫入內容 |
|---|---|---|
| Company | 標題 / Title | 公司名稱；可將原本的 Name 欄改名 |
| Position | 文字 / Text | 職位名稱 |
| Status | 選取 / Select | 先新增 `Applied` 選項 |
| Website | 文字 / Text | 可點擊的 LinkedIn 職缺連結 |
| Apply Date | 日期 / Date | 信件明示的應徵日期 |

`Status` 是 Select，不是 Notion 的 Status 類型；`Website` 是文字，不是 URL 類型。若既有模板的 `Position` 是網址，請先在自己的副本改為文字。修改現有欄位類型前先檢查內容；工具不會替你修改欄位。

若使用 Job Finder 頁面裡的 Job Tracker 表格，請連接實際存放紀錄的 Job Tracker 資料來源。連結檢視只是顯示原資料來源，不能只授權放置檢視的外層頁面。[Notion 資料庫與資料來源說明](https://developers.notion.com/guides/data-apis/working-with-databases)

## 2. 連接自己的 Notion

1. 打開 [Notion integrations](https://www.notion.so/profile/integrations)，建立新的 **Internal integration / Internal connection**（名稱可自訂）。選擇資料庫所在的工作區。
2. 在能力設定啟用 **Read content** 和 **Insert content**。此工具只讀取既有資料並新增頁面，不需要更新內容、留言或讀取使用者 email 的能力。
3. 複製 **Internal Integration Secret**，稍後填入 Apps Script 的指令碼屬性。不要貼進 GitHub、程式或 README。
4. 回到目標原始資料庫，打開右上角 `…` → **Connections / 連線** → 新增剛才建立的 integration。選單也可能顯示 **Connect to**。若找不到，確認 integration 所在工作區，以及自己的資料庫存取權限。
5. 在資料庫設定中開啟 **Manage data sources / 管理資料來源**，在目標資料來源旁的選單選 **Copy data source ID**。稍後存到 `NOTION_DATA_SOURCE_ID`。

要複製的是 **data source ID**，不是 Job Finder 的頁面 ID、database ID，也不是網址 `v=` 後面的 view ID。若有多個資料來源，選包含上面五個欄位的那個。[官方取得 ID 說明](https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03#step-1-add-a-discovery-step-to-fetch-and-store-the-data_source_id)

建立 integration 與授予資料庫存取權是兩個步驟；只拿到 secret，沒有連接資料庫，仍不能匯入。[Notion 官方入門](https://developers.notion.com/guides/get-started/quick-start)

## 3. 建立自己的 Google Apps Script 專案

1. 使用**實際收到 LinkedIn 確認信的 Google 帳號**，打開 [Google Apps Script](https://script.google.com/home/start)，建立新專案。
2. 將此儲存庫 `Code.gs` 的內容完整貼入編輯器中的同名檔案。
3. 新增 HTML 檔，名稱輸入 `Index`，貼入 `Index.html`。Apps Script 會自動加上 `.html`。
4. 進入左側 **專案設定 / Project Settings**，啟用「在編輯器中顯示 appsscript.json 資訊清單檔案」。
5. 回編輯器，使用本儲存庫 `appsscript.json` 的內容取代原資訊清單，儲存。
6. 左側 **服務 / Services** 應出現 **Gmail API v1**。若沒有，按 `+` 新增 Gmail API，識別符保持 `Gmail`。使用自訂 Google Cloud 專案時，也要在該 Cloud 專案啟用 Gmail API。[官方服務設定](https://developers.google.com/apps-script/advanced/gmail)

本工具使用 Google 的授權流程讀取該帳號的 Gmail，**不需填 Gmail 密碼、App Password 或 Gmail API key**。資訊清單只申請 Gmail 唯讀與對外 API 請求權限；程式不會寄信、刪信或標示已讀。

## 4. 儲存私人連線設定

在 Apps Script **專案設定 → 指令碼屬性 / Script Properties → 新增屬性**，加入：

| 屬性名稱（原樣輸入） | 屬性值 |
|---|---|
| `NOTION_TOKEN` | 步驟 2 複製的 integration secret |
| `NOTION_DATA_SOURCE_ID` | 步驟 2 複製的 data source ID |

值直接貼上，不加引號、不加 `Bearer`，不放到原始碼。指令碼屬性留在自己的 Apps Script 專案，不會因為下載或推送此 GitHub 儲存庫而上傳。不過專案編輯者可以存取這些設定，因此請把專案保留給自己。

## 5. 部署並授權 Gmail

1. 按 **部署 / Deploy → 新增部署 / New deployment**，類型選 **網頁應用程式 / Web app**。
2. **執行身分 / Execute as** 選自己。
3. **誰可以存取 / Who has access** 選 **僅限自己 / Only myself**。
4. 按部署；出現授權要求時，選擇收到申請信的 Google 帳號，檢查 Gmail 唯讀及外部服務連線權限後完成授權。若組織政策阻擋，請由管理員處理。
5. 保存產生的網頁應用程式網址，之後用同一帳號開啟即可操作。

若出現未驗證應用程式提示，先確認專案與部署確實是自己建立、程式內容正確；不要授權來源不明的專案。公開程式碼不需要把這個私人部署網址公開。

更改程式後，到 **部署 → 管理部署 → 編輯 → 新版本 → 部署**，讓既有網址使用更新版本。僅儲存編輯器內容不會自動更新正式部署。[Google 網頁應用程式說明](https://developers.google.com/apps-script/guides/web)

## 6. 第一次使用與日常匯入

1. 打開自己的部署網址，先選最近 **5 封確認信**。
2. 按 **檢查並預覽**。工具會讀取 Gmail、查詢 Notion，顯示五個欄位及判定結果。
3. `可新增` 代表尚未找到相符申請；`已存在` 會跳過；`待確認` 請手動核對。
4. 檢查預覽後，按 **匯入可新增項目**。此時工具會重新核對 Notion 才新增。
5. 到 Notion 檢查新增紀錄。再跑一次預覽時，同一職缺應顯示已存在。

預覽不會新增紀錄。這是手動工具，沒有自動排程；需要時再次開啟網址即可。

## 常見問題

| 情況 | 處理方式 |
|---|---|
| `Gmail is not defined` | 檢查服務是否加入 Gmail API v1，以及是否更新部署版本。 |
| 找不到確認信 | 確認部署者是收信帳號；在 Gmail 搜尋 `from:jobs-noreply@linkedin.com subject:"您的應徵資料已傳送到"`。英文確認信目前不支援。 |
| Notion 401 | secret 可能無效或已撤銷，更新 `NOTION_TOKEN`。 |
| Notion 403／404 | 檢查 integration 的能力、原始資料庫 Connections、工作區與 data source ID。 |
| 欄位類型不符 | 逐一依步驟 1 檢查，尤其是 Position、Website 與 Status。 |
| 預覽已過期或已使用 | 重新按「檢查並預覽」；預覽保留 30 分鐘且只使用一次。 |
| 匯入未完成或 pending | 先查看 Notion 是否已新增，再按下方錯誤恢復說明處理；不要盲目刪除防重複標記。 |

## 第三方模板與授權

可選模板：[Job Tracker: The Ultimate Job Search Companion](https://www.notion.com/templates/job-tracker-the-ultimate-job-search-companion)，作者 **Niko**。請從作者的原始頁面取得模板，再在自己的工作區使用。也可以完全不使用模板，自己建立符合五個欄位的空白資料庫。

**本儲存庫只提供獨立匯入工具與必要欄位設定，不附帶第三方模板的頁面、版型、圖片、文案、匯出檔或可供重新散布的副本；亦未獲作者或 Notion 背書。**

授權查核日期：2026-10-03。查閱公開模板頁面及其連結的作者商店後，未找到明確授權將此模板重新打包、公開散布或以開源授權發布的聲明。免費取得不代表獲得這些權利；若另有作者提供的授權文件，應再依該文件確認。

[Notion Marketplace 條款](https://www.notion.com/help/template-gallery-guidelines-and-terms)保留創作者對模板內容的所有權，並授予終端使用者存取及使用權。條款另明文禁止重貼向其他創作者購買的內容；該句針對購買內容，不能單憑它斷言所有免費模板都被同樣禁止，也不能反過來推定免費模板可任意再散布。

本專案的做法是公開獨立程式與原始模板連結，讓使用者各自向作者取得模板。如果要把模板本身或改版副本放上 GitHub，應先取得作者明確的再散布許可。作者聯絡入口在模板頁面的 **Email the creator**。這是依公開資料作的實務判斷，並非作者的授權確認。

## 隱私與版本管理

本儲存庫只存程式、匿名測試與說明。個人帳號、資料來源 ID、API 金鑰、OAuth token、部署 ID、真實郵件、求職紀錄、截圖和操作日誌不得提交。

`.gitignore` 使用預設排除、明確允許檔案的方式，並額外排除 macOS `.DS_Store`、環境檔、憑證、Codex/OpenAI 設定及各種輸出檔。新增程式檔案時，先檢查內容再加入允許清單。不要用 `git add -f`。

`.gitignore` 不會移除已追蹤檔案，也無法阻止把秘密寫入程式。初次複製儲存庫後，可安裝檢查 hooks：

```sh
git config core.hooksPath scripts
chmod +x scripts/pre-commit scripts/pre-push
python3 scripts/check-private.py
node tests/core.test.cjs
```

commit 檢查暫存區；push 檢查所有可到達的提交內容。掃描遇到疑似金鑰、帳號、私人 URL 或未核准檔案會停止，但任何自動掃描都不能保證辨認所有私人資訊。仍應檢查提交差異。不會掃描你的電腦帳號資料夾，也不需提供其他服務的金鑰。

## 限制與錯誤恢復

- 目前只支援繁體中文「您的應徵資料已傳送到」格式；推薦及進度信不會當成申請。
- 每次讀取最近的指定筆數，不會自動跳過已存在項目去讀更早的歷史信件。
- 預覽 30 分鐘到期。任何部分失敗都應先重新預覽核對。
- 不明確的網路錯誤不會自動重試新增。若指令碼屬性中有 `job:職缺編號` 的 pending 記錄，先到 Notion 檢查；只有確認未新增時才刪除該標記。
- 鎖僅涵蓋同一 Apps Script 專案，無法防止其他獨立程式同時新增。
- 測試使用虛構資料；Google 授權及實際部署須在自己的帳號完成。

## 官方文件

- [Apps Script Gmail API](https://developers.google.com/apps-script/advanced/gmail)
- [Apps Script 網頁應用程式](https://developers.google.com/apps-script/guides/web)
- [Notion 資料來源查詢](https://developers.notion.com/reference/query-a-data-source)
