# LinkedIn → Notion 申請紀錄小幫手

在自己的 Google Apps Script 帳號部署，用按鈕把 Gmail 中的 LinkedIn 申請確認信寫入 Notion。先預覽、檢查重複，再新增資料。

## 功能

- 讀取最近 5、10、25 或 50 封繁體中文 LinkedIn 申請確認信。
- 寫入 Company、Position、Status、Website、Apply Date。
- 優先以 LinkedIn 職缺編號去重；缺少編號時以公司、職位與日期比對。
- 模糊比對標為待確認；已存在的申請及其狀態保持原樣。
- 匯入前重新核對，使用執行鎖、一次性預覽及未確認寫入標記避免重複操作。
- Gmail 權限為唯讀。無需 OpenAI、ChatGPT 或 Codex API。

## 設定

1. 用要讀取信件的 Google 帳號建立 [Apps Script 專案](https://script.google.com/home/start)。
2. 複製 `Code.gs`，新增名為 `Index` 的 HTML 檔並貼上 `Index.html`。
3. 在專案設定顯示資訊清單檔，貼上本專案的 `appsscript.json`。如有需要，在「服務」啟用 Gmail API。
4. 建立 [Notion internal integration](https://www.notion.so/profile/integrations)，授予讀取與新增內容權限，並將目標資料庫連接至該 integration。
5. 在 Apps Script「專案設定 → 指令碼屬性」設定下列兩個值。**不要把值寫進原始碼或提交到 Git。**

| 設定名稱 | 值 |
|---|---|
| `NOTION_TOKEN` | 你的 Notion integration secret |
| `NOTION_DATA_SOURCE_ID` | 目標資料來源 ID（不是檢視 ID；多資料來源資料庫也不能直接用資料庫 ID） |

可透過 Notion API 取得資料庫的 `data_sources`，選擇對應資料來源的 `id`。請將這個 ID 保存在指令碼屬性。

6. 資料庫欄位需為：Company（標題）、Position（文字）、Status（選取，包含 Applied）、Website（文字）、Apply Date（日期）。
7. 部署為網頁應用程式：執行身分為自己，存取權限為「僅限自己」。完成 Google 授權後保存部署網址。
8. 開啟網址，按「檢查並預覽」，再按「匯入可新增項目」。

使用自訂 Google Cloud 專案時，也須在該專案啟用 Gmail API。程式不自動修改你的 Notion 欄位類型。

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
