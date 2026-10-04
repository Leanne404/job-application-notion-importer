# LinkedIn → Notion Application Tracker

[English](#english) · [繁體中文](#繁體中文)

## English

### What is this tool?

This is a **private tool that turns LinkedIn application confirmation emails in your Gmail into job application records in Notion, available as a web app or a local terminal command**. It saves you from copying company names, job titles, links, and application dates into a tracker by hand.

You choose a date range, preview the matching emails, and confirm the import. The tool checks your Notion database for existing applications before creating new records. It supports **English and Traditional Chinese confirmation emails**.

| What it saves | Notion field |
|---|---|
| Company name | Company |
| Job title | Position |
| Initial application status (`Applied`) | Status |
| LinkedIn job link | Website |
| Application date stated in the email | Apply Date |

**Where it runs:** choose the local terminal version below, or run the web version in your own Google account using Google Apps Script. For the web version, deploy once and bookmark the resulting web app URL. Whenever you want to import applications, open that URL, choose dates, preview, and import. You do not need to redeploy each time or keep Codex open. Keep the page open until processing finishes; there is no scheduled background sync.

**What you need:** a Google account receiving the emails and a Notion database you can edit. The web version needs no software installation. The terminal version requires Node.js 22 or newer and your own Google Desktop OAuth client. Neither version needs an OpenAI/ChatGPT/Codex API key. The app interface, help text, status messages, and app-generated errors are in English. Email content and database names retain their original language. Google/Notion authorization screens and native browser controls follow their own language settings.

There is no message-count selector or fixed 50-email total limit. The app automatically reads additional pages and imports in batches. Google and Notion quotas and execution limits still apply; errors stop processing, and a fresh preview checks what has already been imported.

### Choose a method — limits first

**Local execution is not unlimited API access.** Apps Script currently allows **6 minutes per server execution**, plus daily service quotas. The web app uses multiple requests, so six minutes is not the total browser-session limit; an individual request can still time out. [Google Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas).

| Method | What to expect |
|---|---|
| Local terminal | Runs on your computer without the Apps Script runtime/daily-service limits. Requires Node.js and one-time Google OAuth setup. Keep the process running and the computer awake. |
| Google Apps Script web app | No local installation. Deploy once, then use the bookmarked URL. Subject to Apps Script runtime and daily quotas. |

**Both methods still use Gmail and Notion APIs.** Gmail has project/user quotas, and actual limits depend on the Cloud project. Notion has per-connection and shared workspace limits; Free/Plus connections currently allow 180 requests/minute. Other account and payload limits also apply. The CLI paces requests and waits on temporary rate limits with bounded retries; persistent failures stop the run. [Gmail quotas](https://developers.google.com/workspace/gmail/api/reference/quota), [Notion limits](https://developers.notion.com/reference/request-limits). Checked 2026-10-04; consult current provider limits and pricing before large imports. This tool does not enable billing or buy extra quota.

### Method A: run in your terminal

#### One-time local setup

1. Install [Node.js](https://nodejs.org/en/download) **22 or newer**. Download this repository using **Code → Download ZIP** and unzip it, or clone it. Open a terminal in the extracted repository folder. Keep the full repository together; the CLI reuses `Code.gs`. No `npm install` is needed.
2. In [Google Cloud Console](https://console.cloud.google.com/), create/select your own project and enable **Gmail API**. Configure the Google Auth Platform consent screen with your app name and contact details. For a personal account, choose an External audience and add your receiving Gmail account as a test user while in Testing.
3. Under **Clients**, create an OAuth client with type **Desktop app** and download its JSON file. Keep that download private; do not commit it. A web-app credential or API key will not work. The CLI requests only `gmail.readonly`. See [Google desktop authorization](https://developers.google.com/identity/protocols/oauth2/native-app).
4. Prepare the same five Notion properties shown in **Method B, step 3** below. Create an internal Notion connection with Read content and Insert content permissions, connect it to the original database, and have its secret and database link ready. You can reuse your existing Notion connection; the CLI does not read settings from Apps Script.
5. Run:

   ```sh
   node cli.mjs setup
   ```

6. At the prompt, paste the full path to the downloaded Google JSON file **without surrounding quotes**. Open the printed Google sign-in link in a browser **on this same computer** and approve read-only Gmail access. The tool listens only on the computer's loopback address for the callback. Return to the terminal, paste the Notion secret into the hidden prompt, and enter the original database link. If several data sources exist, select the correct table.

Settings are saved privately under `.local/` in the repository folder. Secrets are not command-line arguments, so they are not added to shell command history. The original downloaded OAuth JSON is still private: keep it secure or remove that extra copy after successful setup.

**Google Testing-mode reminder:** External OAuth projects in Testing issue refresh tokens that expire after seven days for this Gmail scope. Run `node cli.mjs setup` and choose to reconnect Gmail when needed. Revocation and account policies can also require reauthorization. Changing publishing status involves Google's requirements; the tool does not bypass verification. [Google token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).

#### Each time you use the CLI

From the repository folder, preview a date range:

```sh
node cli.mjs preview --start 2026-10-01 --end 2026-10-03
```

Then import that range:

```sh
node cli.mjs import --start 2026-10-01 --end 2026-10-03
```

The import command makes a fresh preview and asks you to type **IMPORT** before creating records. It re-reads Notion and the original emails after confirmation. Any other answer cancels.

- Dates mean **email receipt dates**, including both entire days in your computer's timezone. `Apply Date` still comes from the email. Omit `--start` or `--end` for no bound; omit both to search all supported confirmations.
- Results and prompts are English; email/company/job text keeps its original language. Both English and Traditional Chinese confirmation formats are supported.
- There is no fixed total email cap or 30-minute preview ticket expiry in the CLI. Large ranges still take time, memory, and API quota. Keep the terminal process running; there is no background scheduler.
- `preview` never creates Notion pages. It can refresh the locally saved Google login. `import` is interactive; there is no unattended `--yes` mode.
- For command help: `node cli.mjs help`. After initial setup, you do not need to deploy Apps Script or open Codex. Updating the CLI means updating the repository files while preserving `.local/`.

#### Local recovery and privacy

The CLI saves credentials and Google login tokens in `.local/client.json`, `.local/google.json`, and `.local/config.json`. These files are plaintext protected by local file permissions, not encrypted storage. The directory is ignored by Git, with owner-only permissions on systems that support them. Protect your operating-system account and backups. Terminal results contain your application data; do not upload captured output.

`.local/ledger.json` keeps job identifiers and pending/completed write markers. If a network failure occurs after Notion may have accepted a page, the CLI stops and retains `pending`; it does not blindly retry that write. Preview again: records already found in Notion are skipped. If a pending job is still marked **Needs review**, check Notion manually. Only after confirming the page does not exist, stop the tool, privately back up the ledger, and remove that one `data-source-id:job-id` entry before trying again. Never erase the whole ledger to resolve an error.

Only one command can run per local folder. After a forced termination, first ensure the old process has stopped, then remove only `.local/run.lock` if it remains. A leftover `*.json.tmp` means a settings write was interrupted; preserve the files for review, and only remove a temporary file after checking its corresponding JSON. Do not run multiple copies or the web importer concurrently: their locks and pending markers are separate, so cross-process duplicate prevention is not guaranteed.

The CLI has automated tests with synthetic Gmail/Notion responses, including pagination, date boundaries, duplicate imports, expired access tokens, throttling, and uncertain writes. Real desktop OAuth and end-to-end account access require your own local setup.

### Method B: Google Apps Script web app — one-time setup

Gmail and Notion each require your authorization. Gmail uses Google's sign-in permission flow. Notion requires a private connection and its secret. This version does not provide a hosted Notion OAuth service, so that initial Notion setup is still necessary.

#### 1. Install in your Google account

1. Sign in to the Google account that **receives the LinkedIn emails**, open [Google Apps Script](https://script.google.com/home/start), and click **New project**.
2. Name the project, for example, “Application Tracker”.
3. Open [SingleFile.gs](SingleFile.gs) on GitHub, click **Raw**, and copy the entire file.
4. In Apps Script, replace all default content in `Code.gs` with that text and save. **Do not also paste the other `.gs` files or create an HTML file.** The single-file version includes the interface.
5. Open **Project Settings** using the gear icon and enable **Show “appsscript.json” manifest file in editor**.
6. Return to the editor and replace `appsscript.json` with the contents of this repository's [appsscript.json](appsscript.json). Save. This manifest keeps Gmail access read-only.
7. Check that **Services** lists **Gmail API**. If missing, click `+`, select Gmail API **v1**, and add it with the identifier `Gmail`.

Only two files need to be copied: the packaged script and its permission settings. The other source files are for development.

#### 2. Deploy and get your tool URL

1. Click **Deploy → New deployment** at the top right.
2. Click the gear beside **Select type**, then choose **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Only myself**.
5. Click **Deploy**. If prompted, choose **Authorize access**, select the receiving Google account, review the read-only Gmail and external connection permissions, and complete authorization.
6. Open the resulting **Web app URL** and bookmark it. This is the URL you will use every time.

If Google shows an unverified-app notice, first verify that it is your own project with the expected code. Do not authorize an unfamiliar app. Organization policies may require administrator assistance. If using a custom Google Cloud project, enable the Gmail API in that project too.

#### 3. Prepare and authorize Notion

Create an empty database, or obtain the optional template from its creator's original link below. Configure these exact property names and types:

| Property | Notion type | Requirement |
|---|---|---|
| Company | Title | Rename the default Name property if needed |
| Position | Text | Job title |
| Status | Select | Include an option named `Applied` |
| Website | Text | Clickable job link |
| Apply Date | Date | Application date |

Use **Select**, not Notion's Status type, for `Status`. Both `Position` and `Website` must be Text. Check existing data before changing a template's property types; the app does not change them for you.

1. Open [Notion integrations](https://www.notion.so/profile/integrations) and create an **Internal integration / Internal connection** in the workspace containing your database.
2. Enable **Read content** and **Insert content**, then copy the **Internal Integration Secret**.
3. Open the **original database** in Notion, use its `…` menu → **Connections**, and add that connection. Creating a secret alone does not grant access to the database.
4. Open the table using **Open as full page**, then choose `…` → **Copy link**.

For a Job Tracker inside a Job Finder page, use the link to the actual Job Tracker database, not the outer page or an individual application row. For a linked view, open the original database.

#### 4. Connect from the tool's setup screen

1. Open your bookmarked tool URL and expand **Set up or change Notion connection**.
2. Paste the secret into **Notion connection secret** and the database link into **Database link**.
3. Click **Connect Notion**. The app discovers the data source and validates the properties. If there are multiple sources, choose the correct table and click Connect again.
4. Once connected, start using the date search. You do not need to find a data source ID or manually edit Script Properties.

The secret is sent through your own Apps Script project to Notion for validation. After successful validation, it is saved in your private project's settings, not GitHub, and is never returned in preview results. The secret input is cleared. Project editors can access settings, so keep the project private and do not share screenshots containing credentials.

### Everyday use

1. Open your bookmarked web app URL.
2. Choose **Start date** and **End date**. Both days are included. Leave either end blank for no bound; leave both blank to search all matching historical confirmations.
3. Click **Check and preview**. Wait for the date-range search to finish; additional pages are loaded automatically.
4. Review the results: **Ready to import** means a candidate for import, **Already exists** means already present, and **Needs review** requires manual review.
5. Click **Import new applications** and keep the page open until completion. Notion is checked again before records are created.

Search uses the **email receipt date** in your browser's timezone. `Apply Date` uses the date stated inside the email. Preview is read-only; Import creates records. Existing application statuses are preserved. Close the page after completion and reopen the same URL next time—no repeated deployment or setup is needed unless authorization is revoked or expires.

### Updating an existing installation

1. Replace Apps Script's `Code.gs` with the latest `SingleFile.gs`; do not append a second copy.
2. Use the latest `appsscript.json`. An old `Index.html` may remain, but the packaged version does not use it.
3. Choose **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**.
4. Refresh your existing tool URL. Saving code alone does not update the deployed version.

Existing Notion settings can be reused.

### Troubleshooting

| Problem | What to check |
|---|---|
| `Gmail is not defined` | Add Gmail API v1 under Services and deploy a new version. |
| No emails found | Receiving Google account, selected dates, and supported confirmation subject. |
| Notion 401 | Reconnect using a valid secret. |
| Notion 403 / 404 | Database Connections, workspace, and original database link. |
| Property type mismatch | Match the five properties in the setup table. |
| Preview expired | Preview again. Tickets last approximately 30 minutes; Google may evict cached items sooner. |
| Long processing or quota error | Use a shorter date range and preview again. Existing records are skipped. |
| Old preview fails after changing databases | Preview again to avoid writing to the wrong destination. |

### Supported formats and recovery

- Supports Traditional Chinese “您的應徵資料已傳送到” and English “Your application was sent to” / “Your application has been sent to” confirmations. Simplified Chinese is not searched.
- English dates support the labels Date applied, Applied on, and Application date, with English month names or ISO dates. Ambiguous numeric dates are flagged for review rather than guessed.
- Traditional Chinese parsing was previously checked against real messages; English parsing uses synthetic tests. Other subjects, HTML-only emails, or different layouts may not be supported.
- Duplicate detection prioritizes the LinkedIn job ID, then compares company, position, and date. Cross-batch duplicates are checked again during import.
- If a batch fails, subsequent imports stop. Completed results remain visible; preview again to check progress. Processing is subject to service quotas, and there is no automatic background resume.
- An uncertain write failure retains a pending marker instead of blindly retrying. For the web version, check Notion first; only if the record definitely was not created should you remove the matching `job:source:job-id` marker from Script Properties. For the CLI, follow Local recovery above.
- The web execution lock covers one Apps Script project; the CLI lock covers one local folder. Never run these importers concurrently against the same database.

### Optional third-party template and licensing

[Job Tracker: The Ultimate Job Search Companion](https://www.notion.com/templates/job-tracker-the-ultimate-job-search-companion) is an optional template by **Niko**. Obtain it from the creator's original listing for use in your workspace, or create your own empty database with the five required properties.

This repository contains an independent importer and its required property configuration. It does not distribute the template's pages, layout, images, copy, exports, or a redistributable template copy, and is not endorsed by the creator or Notion.

Public information was checked on **2026-10-03**. No explicit permission to repackage, redistribute, or open-source this template was found on the listing or linked creator store. Free availability does not establish those rights. The [Notion Marketplace terms](https://www.notion.com/help/template-gallery-guidelines-and-terms) retain creators' ownership and grant end users access and use rights. Their explicit prohibition on reposting purchased creator content does not by itself settle the treatment of every free template.

The repository links to the original template rather than redistributing it. Obtain explicit permission from the creator before publishing the template itself or a modified copy. The listing includes an **Email the creator** contact link. This is a practical assessment of public information, not a licensing confirmation from the creator.

### Privacy and development

The repository contains no private accounts, Notion IDs, credentials, real emails, application records, or private screenshots. `.gitignore` uses a reviewed file allowlist; tracked files still require content review.

Web changes go in `Code.gs` and `Index.html`; CLI changes go in `cli.mjs` and `lib/`. The shared parser is in `Code.gs`. Regenerate the web package after shared or web changes, then test:

```sh
python3 scripts/build-single.py
node tests/core.test.cjs
node --test tests/cli.test.mjs
git config core.hooksPath scripts
python3 scripts/check-private.py
```

Commit/push checks scan tracked content and history, not account folders on your computer. Automated scanning cannot guarantee complete privacy; review changes before committing. `SingleFile.gs` is the generated app used for deployment.

### Official documentation

- [Google web app deployment](https://developers.google.com/apps-script/guides/web)
- [Google manifest settings](https://developers.google.com/apps-script/guides/manifest)
- [Gmail API service](https://developers.google.com/apps-script/advanced/gmail)
- [Notion authorization](https://developers.notion.com/guides/get-started/authorization)

---

## 繁體中文

### 這是什麼工具？

這是一個**將 Gmail 裡的 LinkedIn 申請確認信，整理成 Notion 求職紀錄的私人工具，提供網頁與本機終端機兩種方式**。你不必再逐封複製公司名稱、職位、職缺連結與應徵日期。

選擇日期範圍、預覽結果，再按匯入，工具就會把資料寫到 Notion 的 Company、Position、Status、Website、Apply Date 五個欄位。新增前會檢查重複，新增狀態為 `Applied`，既有紀錄的狀態會保留。支援繁體中文與英文確認信；操作介面、說明、進度與工具產生的錯誤訊息皆為英文。信件內容與資料庫名稱保留原文；Google／Notion 授權畫面及瀏覽器內建控制項依各自語言設定顯示。

**工具放在哪裡？** 可選擇在自己的電腦用終端機執行，或使用 Google Apps Script 網頁版。網頁版執行在你自己的 Google 帳號裡。第一次部署後，把產生的工具網址加入書籤；之後需要匯入時打開網址即可，不用每次重新部署，也不用開 Codex。操作時保持頁面開啟，完成後就可以關閉。它是手動工具，沒有背景自動同步。

**平常只要：選日期 → 預覽 → 匯入。** 支援繁體中文與英文 LinkedIn 申請已送出確認信，新增前會檢查 Notion 是否已有相同申請。

沒有筆數選單，也沒有只查前 50 封的總數限制。工具會自動分頁搜尋你選的日期範圍，再分批匯入；過程中請保持頁面開啟。仍受 Google／Notion 的時間與配額限制，遇到錯誤會明確停止，可重新預覽核對已完成項目。

## 先選使用方式，也先了解限制

**終端機版仍有 API 配額，並非無限使用。** Apps Script 目前每次伺服器執行上限為 **6 分鐘**，另有每日服務配額。網頁版會分多次請求處理，因此不是整個瀏覽器操作只能六分鐘，但其中一次請求仍可能超時。[Google Apps Script 配額](https://developers.google.com/apps-script/guides/services/quotas)。

| 方法 | 特點 |
|---|---|
| 本機終端機版 | 不受 Apps Script 執行時間與每日服務配額限制；需要 Node.js 與首次 Google OAuth 設定。執行時電腦需保持喚醒。 |
| Google Apps Script 網頁版 | 不用安裝軟體，部署一次後開書籤使用；受 Apps Script 執行時間與每日配額限制。 |

**兩種方式都受 Gmail／Notion API 限制。** Gmail 有專案與使用者配額，實際額度依 Cloud 專案而定。Notion 有連線與工作區共享限制；Free／Plus 連線目前為每分鐘 180 次請求，也有其他帳號與內容大小限制。本機版會控制速度，遇暫時限流會等待並有限次重試，持續失敗則停止。[Gmail 配額](https://developers.google.com/workspace/gmail/api/reference/quota)、[Notion 限制](https://developers.notion.com/reference/request-limits)。查核日期：2026-10-04；大量匯入前請查看當時配額與計價。工具不會替你開啟付費或購買額外配額。

## 方法 A：在終端機執行

### 首次設定

1. 安裝 [Node.js](https://nodejs.org/en/download) **22 或更新版本**。在 GitHub 按 **Code → Download ZIP** 並解壓縮，或自行 clone。用終端機進入儲存庫資料夾，保留整個資料夾內容；CLI 會共用 `Code.gs` 的解析規則。**不需要執行 npm install。**
2. 到 [Google Cloud Console](https://console.cloud.google.com/) 建立／選擇自己的專案並啟用 **Gmail API**。在 Google Auth Platform 設定應用名稱與聯絡資料；個人帳號選 External，Testing 階段將收信的 Gmail 帳號加入測試使用者。
3. 在 **Clients** 建立 **Desktop app** 類型的 OAuth 用戶端，下載 JSON 並妥善保管，不能上傳 GitHub。網頁類型憑證與一般 API key 不適用。CLI 只請求 `gmail.readonly`。[Google 桌面授權說明](https://developers.google.com/identity/protocols/oauth2/native-app)。
4. 按下方「方法 B 第三步」準備相同五個 Notion 欄位，建立具 Read content／Insert content 權限的私人連線，並授權原始資料庫。準備密鑰與資料庫連結。可沿用既有 Notion 連線；CLI 不會自動取得 Apps Script 裡的設定。
5. 執行：

   ```sh
   node cli.mjs setup
   ```

6. 依提示貼入 Google JSON 的完整路徑，**不加前後引號**。在**同一台電腦**的瀏覽器開啟終端機顯示的 Google 登入連結，允許 Gmail 唯讀存取。程式只在本機 loopback 位址接收登入結果。回到終端機，貼上 Notion 密鑰（輸入不顯示），再貼原始資料庫連結。多個資料來源時選正確表格。

設定保存在儲存庫的 `.local/`。密鑰不放在指令參數，因此不會被記到 shell 指令歷史。原本下載的 OAuth JSON 仍是私人檔案；設定成功後可安全保管或刪除那份多餘副本。

**Google Testing 模式提醒：** External 專案在 Testing 時，這個 Gmail 權限的 refresh token 七天會過期。需要時重跑 `node cli.mjs setup` 並選擇重新連接 Gmail。撤銷授權與帳號政策也可能要求重新登入。改成正式發布須遵守 Google 規定，工具不會繞過驗證。[Google token 到期說明](https://developers.google.com/identity/protocols/oauth2#expiration)。

### 每次使用

在儲存庫資料夾中先預覽：

```sh
node cli.mjs preview --start 2026-10-01 --end 2026-10-03
```

要匯入時執行：

```sh
node cli.mjs import --start 2026-10-01 --end 2026-10-03
```

匯入指令會重新預覽，等你輸入 **IMPORT** 才開始新增；確認後還會重讀 Notion 和原信，再次去重。輸入其他內容會取消。

- 日期依**收信時間**與電腦時區，包含開始／結束兩天；Apply Date 仍使用信內應徵日期。省略某端參數就不限該端，兩端省略會查所有支援的歷史確認信。
- 提示與結果狀態都是英文；公司、職位等信件資料保留原文。支援英文與繁體中文確認信。
- 沒有固定總筆數上限，也沒有網頁版的 30 分鐘預覽憑證期限；大範圍仍會消耗時間、記憶體及 API 配額。請保持程式執行，沒有背景排程。
- `preview` 不會新增 Notion 資料，但可能更新本機 Google 登入憑證。`import` 需要互動確認，沒有無人值守的 `--yes`。
- 查看指令：`node cli.mjs help`。設定完成後不必部署 Apps Script，也不必開 Codex。更新 CLI 時替換儲存庫程式檔並保留 `.local/`。

### 本機錯誤恢復與隱私

`.local/client.json`、`.local/google.json`、`.local/config.json` 保存密鑰與登入憑證。它們是靠本機權限保護的明文檔案，並非加密保管庫；支援的系統會設為僅擁有者可讀寫。整個 `.local/` 都被 Git 忽略，仍請保護作業系統帳號與備份。終端機結果包含你的求職資料，不要上傳輸出截圖或紀錄。

`.local/ledger.json` 保存職缺識別與 pending／完成標記。若 Notion 可能已成功寫入、但網路回應失敗，程式停止並保留 pending，不會盲目重送。重新預覽時，Notion 已有的會跳過。若仍顯示 Needs review，先到 Notion 核對；只有確定沒有建立，才停止程式、私下備份 ledger，刪除該筆 `資料來源ID:職缺ID` 項目再重試。不要整份刪除。

同一資料夾一次只允許一個指令。強制中斷後，先確認舊程序已停止，再刪除殘留的 `.local/run.lock`。若有 `*.json.tmp`，代表設定寫入曾中斷；先保留檢查，確認對應 JSON 狀態後才移除暫存檔。**不要同時跑多份 CLI 或網頁版**，它們的鎖與 pending 紀錄各自獨立，不能保證跨程序去重。

CLI 已用虛構 Gmail／Notion 回應測試分頁、日期邊界、重複匯入、登入更新、限流及不確定寫入。真正的桌面 OAuth 與帳號全流程仍須完成你自己的本機設定後驗證。

## 方法 B：Google Apps Script 網頁版

你只需自己的 Google 帳號、Notion 帳號。**不用安裝 Python／Node、不用終端機，也不需要 OpenAI／ChatGPT／Codex 金鑰。** 下方步驟只做一次。

Google 和 Notion 是兩個不同服務，因此第一次仍需親自授權。Gmail 用 Google 的登入授權；Notion 需要建立一個私人連線並取得密鑰。此版本沒有公開 OAuth 服務，無法免除這一步。

### 第一步：把工具放進自己的 Google 帳號

1. 用**收到 LinkedIn 確認信的 Google 帳號**開啟 [Google Apps Script](https://script.google.com/home/start)，按 **新增專案 / New project**。
2. 將專案改名為「申請紀錄小幫手」。
3. 在 GitHub 開啟 [SingleFile.gs](SingleFile.gs)，按 **Raw**，複製全部文字。
4. 回到 Apps Script，選左側 `Code.gs`，刪掉預設的 `myFunction`，貼上剛才的全部文字並儲存。**不用另外建立 Index.html，也不要同時貼入其他 .gs 檔。**
5. 點左側齒輪 **專案設定 / Project Settings**，勾選「在編輯器中顯示 appsscript.json 資訊清單檔案」。
6. 回編輯器，點 `appsscript.json`，用 GitHub 的 [appsscript.json](appsscript.json) 全部內容取代並儲存。這份設定讓 Gmail 授權保持唯讀。
7. 確認左側 **服務 / Services** 有 **Gmail API**。若沒有，按 `+` → Gmail API → v1 → 新增，識別符保持 `Gmail`。

你只需要貼上兩個檔案：整合程式與權限設定。README 中的其他程式檔是給開發者維護用的。

### 第二步：部署成自己可開啟的網頁

1. 按右上角 **部署 / Deploy → 新增部署 / New deployment**。
2. 在「選取類型」旁的齒輪選 **網頁應用程式 / Web app**。
3. **執行身分 / Execute as** 選 **我 / Me**。
4. **誰可以存取 / Who has access** 選 **僅限自己 / Only myself**。
5. 按 **部署**。若要求授權，按 **授權存取 / Authorize access**，選收信的 Google 帳號，確認 Gmail 唯讀與外部連線權限後完成授權。
6. 複製部署結果中的 **網頁應用程式網址 / Web app URL**，開啟並加入書籤。之後用這個網址操作。

若 Google 顯示未驗證提示，先確認是自己建立的專案及正確程式；來源不明的應用不要授權。組織帳號若被管理政策阻擋，需由管理員處理。使用自訂 Cloud 專案時也需在該專案啟用 Gmail API。

### 第三步：讓 Notion 允許這個工具存取資料庫

1. 在自己的 Notion 建立空白表格，或從本文下方原作者連結取得模板。
2. 確認表格有以下五個欄位，名稱、大小寫及類型需相符：

| 欄位 | 類型 | 用途 |
|---|---|---|
| Company | 標題 / Title | 公司名稱（可將 Name 改名） |
| Position | 文字 / Text | 職位 |
| Status | 選取 / Select | 需包含 `Applied` 選項 |
| Website | 文字 / Text | 可點擊的職缺連結 |
| Apply Date | 日期 / Date | 應徵日期 |

`Status` 不是 Notion 的 Status 類型；Position 和 Website 都使用文字類型。修改模板副本的欄位前請先檢查內容，工具不會自行改欄位。

3. 開啟 [Notion integrations](https://www.notion.so/profile/integrations)，建立 **Internal integration / Internal connection**，名稱可填「申請紀錄小幫手」，選擇資料庫所在的工作區。
4. 能力設定開啟 **Read content（讀取）** 和 **Insert content（新增）**，複製 **Internal Integration Secret**。這就是下個步驟要貼的「Notion 連線密鑰」。
5. 回到 Notion 的**原始資料庫**，右上角 `…` → **Connections / 連線** → 加入剛建立的連線。只建立連線但沒有授權資料庫，工具仍無法使用。
6. 將原始表格 **開啟為整頁 / Open as full page**，用 `…` → **複製連結 / Copy link**。

若使用 Job Finder 裡的 Job Tracker，請取得真正儲存紀錄的 Job Tracker 資料庫連結；不要複製 Job Finder 外層頁面或一個職缺列的連結。連結檢視應開啟其原始資料庫。

### 第四步：在工具畫面完成連接

1. 打開第二步保存的工具網址，展開 **Set up or change Notion connection**。
2. 貼上 **Notion connection secret**與**Database link**，按 **Connect Notion**。
3. 工具會自動找出資料來源並驗證欄位；若資料庫有多個來源，選擇對應表格後再按一次連接。
4. 看到已連接後即可使用。不必找 data source ID，也不必進入指令碼屬性手動填設定。

密鑰只透過自己的 Apps Script 傳送到 Notion 以驗證，驗證成功後保存在私人 Apps Script 專案設定；不會寫入 GitHub 或回傳到預覽結果。密鑰欄會清空。不要將專案分享給不應存取資料的人，也不要上傳設定畫面的截圖。

## 日常使用

1. 開啟書籤中的工具網址。
2. 選擇開始／結束日期。包含兩端整天；留空代表不限該端，兩端留空會查所有符合條件的歷史確認信。
3. 按 **Check and preview**，等待顯示「Date-range search complete」。工具會自動讀取後續頁，不需要挑筆數。
4. 檢查結果：Ready to import 會匯入，Already exists 會跳過，Needs review 請手動核對。
5. 按 **Import new applications**，等待完成。請保持頁面開啟；再次執行時仍會重新比對 Notion。

搜尋依**收信日期**與瀏覽器時區；Notion 的 Apply Date 仍採用信件內的應徵日期。預覽只讀資料，匯入才新增。既有申請的狀態不會被覆蓋。這是手動工具，沒有背景排程。

## 已安裝舊版？這樣更新

1. 用新版 `SingleFile.gs` 完整取代 Apps Script 的 `Code.gs`。不要和原來的程式重複貼上。
2. 使用新版 `appsscript.json`。舊的 `Index.html` 可保留，但整合版不會使用它。
3. 按 **部署 → 管理部署 → 鉛筆編輯 → 版本選「新版本」→ 部署**。
4. 重新整理原本工具網址。只按儲存不會更新正式部署。

原本存在的 Notion 指令碼屬性仍可沿用，不需要重新連接。

## 常見問題

| 問題 | 處理方式 |
|---|---|
| Gmail is not defined | 在服務加入 Gmail API v1，並部署新版本。 |
| 沒有信件 | 確認部署使用收信帳號、日期正確，且主旨是繁中或英文的申請已送出確認信。 |
| Notion 401 | 密鑰無效或已撤銷，重新連接。 |
| Notion 403／404 | 檢查資料庫的 Connections、工作區與原始資料庫連結。 |
| 欄位類型不符 | 依第三步表格修正自己的資料庫欄位。 |
| 預覽過期 | 重新預覽；分批預覽憑證約 30 分鐘有效，Google 也可能提早清除快取。 |
| 長時間處理或配額錯誤 | 縮小日期範圍後重新預覽；已存在的申請會跳過。 |
| 換資料庫後無法匯入舊預覽 | 重新預覽，避免誤寫到不同的資料庫。 |

## 支援範圍與錯誤恢復

- 只支援繁體中文「您的應徵資料已傳送到」與英文「Your application was sent to／Your application has been sent to」確認信；不搜尋簡體中文。
- 英文日期支援 Date applied、Applied on、Application date 標籤，以及月份英文名稱或 ISO 日期。含糊數字日期不猜測，列為待確認。
- 繁中先前曾以實際信件驗證；英文以虛構樣本測試。其他主旨、純 HTML 或不同排版可能不支援。
- 相同 LinkedIn 職缺編號優先判定重複，另比對公司、職位與日期。跨批次重複會在匯入時再次檢查。
- 一批失敗會停止後續匯入，畫面保留已完成結果。重新預覽可核對進度；工具不承諾無限量或自動背景續傳。
- 不明確的寫入錯誤保留 pending 標記，不直接重試。網頁版先到 Notion 確認，只有確定未建立時才在指令碼屬性刪除對應 `job:資料來源:職缺編號` 標記；CLI 請依上方「本機錯誤恢復與隱私」處理。
- 網頁鎖僅涵蓋同一 Apps Script 專案，本機鎖僅涵蓋同一資料夾；請勿同時對同一資料庫執行多份匯入工具。

## 第三方模板與授權

可選模板：[Job Tracker: The Ultimate Job Search Companion](https://www.notion.com/templates/job-tracker-the-ultimate-job-search-companion)，作者 **Niko**。請從作者的原始頁面取得模板，再在自己的工作區使用。也可以完全不使用模板，自己建立符合五個欄位的空白資料庫。

**本儲存庫只提供獨立匯入工具與必要欄位設定，不附帶第三方模板的頁面、版型、圖片、文案、匯出檔或可供重新散布的副本；亦未獲作者或 Notion 背書。**

授權查核日期：2026-10-03。查閱公開模板頁面及其連結的作者商店後，未找到明確授權將此模板重新打包、公開散布或以開源授權發布的聲明。免費取得不代表獲得這些權利；若另有作者提供的授權文件，應再依該文件確認。

[Notion Marketplace 條款](https://www.notion.com/help/template-gallery-guidelines-and-terms)保留創作者對模板內容的所有權，並授予終端使用者存取及使用權。條款另明文禁止重貼向其他創作者購買的內容；該句針對購買內容，不能單憑它斷言所有免費模板都被同樣禁止，也不能反過來推定免費模板可任意再散布。

本專案的做法是公開獨立程式與原始模板連結，讓使用者各自向作者取得模板。如果要把模板本身或改版副本放上 GitHub，應先取得作者明確的再散布許可。作者聯絡入口在模板頁面的 **Email the creator**。這是依公開資料作的實務判斷，並非作者的授權確認。

## 隱私與開發者說明

儲存庫不包含帳號、Notion ID、密鑰、真實信件、求職資料或私人截圖。`.gitignore` 預設拒絕新檔案，只允許審查過的程式及說明；已追蹤檔案仍需檢查差異。

網頁版修改 `Code.gs`、`Index.html`；CLI 修改 `cli.mjs`、`lib/`，共用解析規則在 `Code.gs`。修改共用或網頁程式後，重新產生整合版並測試：

```sh
python3 scripts/build-single.py
node tests/core.test.cjs
node --test tests/cli.test.mjs
git config core.hooksPath scripts
python3 scripts/check-private.py
```

提交／推送檢查會掃描已追蹤內容與歷史，不會掃描電腦帳號資料夾。自動掃描不是完整隱私保證，提交前仍須審查內容。`SingleFile.gs` 是產生的完整程式；部署者只需使用該檔。

## 官方文件

- [Google 網頁部署](https://developers.google.com/apps-script/guides/web)
- [Google 資訊清單設定](https://developers.google.com/apps-script/guides/manifest)
- [Gmail API 服務](https://developers.google.com/apps-script/advanced/gmail)
- [Notion 授權](https://developers.notion.com/guides/get-started/authorization)
