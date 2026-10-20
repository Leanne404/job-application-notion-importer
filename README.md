# Job Application Notion Importer

[English](#english) · [繁體中文](#繁體中文)

## English

Keep your **Notion job tracker** up to date in two ways: import LinkedIn application confirmation emails from Gmail, or fill existing rows from external job websites. Preview the results before confirming any changes. The interface and prompts are English; Gmail import supports English and Traditional Chinese confirmations.

### What it does and how to use it

**1. Import applications from Gmail — web app or terminal**

- You do not need to enter each application in Notion. After setup, choose the **received-date range** to search; the web version pre-fills one week ago through today (both dates included). Clearing a date restores its default when you preview.
- In the web app, click **Check and preview**, review the companies, positions, dates, and duplicate checks, then click **Import new applications**. The terminal provides the same preview/import workflow through commands shown below.
- Each new row gets **Company, Position, Website, and Apply Date** from the confirmation email, with **Status = Applied**. Apply Date is the application date stated in the email, which may differ from its received date.
- Matching existing jobs are skipped; uncertain duplicates and unsupported emails are flagged for manual review. Existing rows and their statuses are preserved.

**2. Fill rows from job links — web app only**

- In your Notion table, create a row and paste an **external job URL into Website**. Leave the fields you want filled blank, including Location and Salary Range if your table has them. Repeat for other jobs.
- Open **Fill from Website** and click **Preview websites**. Below that button, **Apply Date to save in Notion** is the date to write into this batch, not a search filter. Leave it blank to use your local date when you click **Fill blank fields**.
- Click **Preview websites**, review the results, then **Fill blank fields**. The tool reads the external job page to fill available blank Company, Position, Location and Salary Range, sets blank Status to `Applied`, and fills blank Apply Date. **Missing details stay blank; available fields can still be filled. This workflow does not look for Gmail confirmations.**
- It checks the whole database for duplicate job URLs before preview and again before writing. Duplicate rows are flagged and skipped, never deleted. Existing values are preserved. Pages that require login, block access, or lack readable job details need manual review.

Both workflows require the five core Notion properties listed below. Gmail import fills only those five. Website fill can also populate blank **Location** and **Salary Range** when those optional **Text** properties exist. Other properties are preserved. The tool records applications you have made; it does not apply to jobs for you. Installation, permissions, and the buttons or commands for each method are explained below.

### Choose how to run it

| | ⭐️Web app | Terminal |
|---|---|---|
| Where it runs | Your Google account, using Google Apps Script | Your own computer, using Node.js |
| How you use it | Open a bookmarked URL and click buttons | Run a command |
| What you install | Copy two files into an Apps Script project | Node.js 22+ and this repository |
| Best for | Everyday imports; no local installation | Longer imports; more initial Gmail setup |

**Choose one method.** Neither needs an OpenAI, ChatGPT, or Codex API key. Google Apps Script is Google's service for running small programs in your Google account. GitHub stores the source code; it does not run the importer or automatically update your deployed copy.

**Limits first:** Apps Script allows [6 minutes per server execution, plus daily quotas](https://developers.google.com/apps-script/guides/services/quotas). This web app processes emails in batches of 20, so a complete session can last longer. The terminal version avoids Apps Script limits, but **both still have [Gmail](https://developers.google.com/workspace/gmail/api/reference/quota) and [Notion](https://developers.notion.com/reference/request-limits) API quotas**. There is no fixed total email cap or guaranteed number of runs per day.

### Prepare Notion once — either method

Use your existing tracker or create a Notion database with these **exact names and types**:

| Property | Type | What goes in it |
|---|---|---|
| Company | Title | Company name |
| Position | Text | Job title |
| Status | Select, with an `Applied` option | Initial application status |
| Website | Text | Gmail import: LinkedIn job link. Website fill: the external job link you paste |
| Apply Date | Date | Gmail import: date stated in the email. Link fill: chosen date, or the day you confirm |

For Website fill, you can also add these optional properties using the exact names below:

| Optional property | Type | What the website can provide |
|---|---|---|
| Location | Text | Published location(s) and remote eligibility, when stated |
| Salary Range | Text | Published salary, currency and pay period, when stated |

These two properties are not required for Gmail import or basic Website fill. Missing or non-Text properties are skipped; the tool never creates or converts them. Use Text for Salary Range so it can hold a range such as `USD 100,000–150,000 / year`.

`Status` must be **Select**, not Notion's Status type. Both Position and Website use **Text**. All five properties must exist, even if you leave row values blank for link fill. Extra properties may remain in your table. The tool does not change your database structure.

1. Open [Notion integrations](https://www.notion.so/profile/integrations), create an **Internal integration / Internal connection**, and select your database's workspace.
2. Enable **Read content** and **Insert content**; also enable **Update content** if you will fill existing rows from links. Copy the **Internal Integration Secret**; this is the Notion secret the tool will ask for.
3. In Notion, open the original database → `…` → **Connections**, and add that connection.
4. Open the database as a full page and copy its link. For **Job Finder → Job Tracker**, use the **Job Tracker database** link.

You now have the two things either installation needs: **a Notion secret and a database link**. You can reuse them if you later switch methods.

### Method 1: web app (⭐️Recommended)

**You are putting a private copy of this tool in your Google account.** You need a browser, the Google account receiving the emails, and the Notion details above.

#### 1. Copy the two files

1. Open [Google Apps Script](https://script.google.com/home/start) with the receiving Google account and click **New project**. Name it “Application Tracker”.
2. Open this repository's [SingleFile.gs](SingleFile.gs) → **Raw**, and copy everything. In Apps Script, replace all contents of `Code.gs` with it and save.
3. In Apps Script **Project Settings** (gear), enable **Show “appsscript.json” manifest file in editor**.
4. Return to the editor. Replace `appsscript.json` with this repository's [appsscript.json](appsscript.json) and save.
5. Check **Services** for **Gmail API**. If missing, click `+` → **Gmail API → v1 → Add**, keeping the identifier `Gmail`.

`SingleFile.gs` contains the program and interface; `appsscript.json` declares its permissions. **Do not add the other source files or a separate HTML file.**

#### 2. Get your private tool URL

1. Click **Deploy → New deployment** → select **Web app** as the type.
2. Set **Execute as: Me** and **Who has access: Only myself**.
3. Click **Deploy → Authorize access**, choose the receiving Google account, and approve read-only Gmail access and external connections.
4. Open the resulting **Web app URL** and bookmark it.

If Google shows an unverified-app notice, confirm it is your own project and the expected code before proceeding. Organization restrictions may need an administrator. A custom Cloud project also needs Gmail API enabled.

#### 3. Connect and use it

1. On the tool page, expand **Set up or change Notion connection**.
2. Paste your **Notion connection secret** and **Database link**, then click **Connect Notion**. If asked, select your table and click Connect again.
3. Click **LinkedIn Gmail import**, then select **Start date / End date** → **Check and preview**.
4. Review the results → **Import new applications**. Keep the page open until it finishes.

**Next time:** open the same bookmark. You do not need to redeploy or open Codex. Import soon after previewing; web previews expire after about 30 minutes and may be cleared earlier.

### Fill from external websites — web app

The two workflow buttons are **LinkedIn Gmail import** and **Fill from Website**. They have separate previews and actions. To use the Website workflow:

1. In Notion, put an **external job URL in Website**, one job per row. Leave the fields you want filled blank.
2. Enable **Update content** for the Notion connection, then open **Fill from Website** in the tool.
3. Click **Preview websites** and review the available details and duplicate results.
4. Below the preview button, optionally choose **Apply Date to save in Notion**. This is the date to write into blank Notion Apply Date fields, **not a search filter**. Leave it blank to use your local date when you confirm. Existing dates stay unchanged; changing this date does not require another preview.
5. Review the date and click **Fill blank fields** within 30 minutes of previewing.

It fills whatever it can find: blank **Company, Position, Location, Salary Range**, plus **Apply Date and Status (`Applied`)**. Missing details stay blank; they do not prevent other available fields from being filled. Your supplied **Website link stays intact**, as do existing values, icons and other content. **Rows with Company, Position, Status and Apply Date already filled are skipped entirely**, even if Location or Salary Range is blank. Rows without Website are also skipped. **Location** and **Salary Range** are optional **Text** properties; absent or differently typed properties are not changed. Salary text retains the published currency, range and pay period when provided; no salary or annual conversion is guessed. This workflow does not read Gmail or create new Notion rows.

**Example:** if a page provides a company, title and location but no salary, those available fields can be filled while Salary Range stays blank. Existing values are never overwritten. If the website omits a pay period, the salary text says `period unspecified`.

**Supported pages:** public company career pages that include readable `JobPosting` structured data, plus Greenhouse standard/embedded job links and Breezy job pages with matching title/employer metadata. Also supports iCIMS same-job embedded pages and Rippling embedded job data (including published locations and pay ranges). Jobright embedded job data is supported for company, title and job location; removed/hidden listings show a history notice and unavailable salary stays blank. Jobvite career pages with matching page/job titles are supported for company, position and location; tracking parameters are omitted when fetching them. SmartRecruiters one-click links use its public posting API; EA job pages use matching job metadata. Oracle Candidate Experience job links use the public requisition-details endpoint, verify the job ID, and fill available employer, title and primary location; unavailable fields remain blank. HTTP 403 means the site refused the request and requires manual review. It follows public HTTPS redirects after checking each destination. It cannot read every website: login requirements, access blocks, JavaScript-only pages, job lists or pages without a readable job posting are flagged for manual review. Partial job postings can still fill the fields they provide. If the structured company name is empty, it also checks the job description for an explicit employer statement such as “ExampleCorp is seeking a Software Engineer.” Ambiguous names stay blank; it does not infer the company from the domain or recruiting platform. This fallback uses the same downloaded page and needs no AI API. Posting dates are not used as application dates.

**Query time:** each new Website preview reads the Notion table once (paginated), then processes only rows with Website and missing core fields. Completed rows never trigger website requests. Later batches reuse a private snapshot for that preview, which expires within 30 minutes. Each confirmed write batch still rereads Notion for current duplicate checks and rechecks its target pages and job details. Starting another preview performs a fresh scan.

**Duplicate checks:** compare normalized URLs (ignore common tracking parameters), known job-board IDs and resolved redirect URLs before preview and again before updates. For identical links, prefer the row with more filled fields, then the oldest row. Other copies are skipped, never deleted. A different link with the same company and position is flagged as a possible duplicate. Different URLs cannot always be identified as the same job automatically.

**Validation:** live read-only checks extracted company, position, location and salary from a Figma Greenhouse posting and a Stripe company-career page. A Spotify Lever page returned 403 and was correctly reported as unreadable. These are examples, not guarantees for every posting; your deployed Apps Script and Notion account still need your own preview check.

To update an existing deployment, replace Apps Script `Code.gs` with the latest `SingleFile.gs`, then **Deploy → Manage deployments → Edit → New version → Deploy** and refresh your existing URL. Saved Notion settings remain available.

### Method 2: terminal

**You are running the tool on your computer.** This requires a separate one-time Google login setup; it does not use your Apps Script deployment.

#### 1. Install and open the project

1. Install [Node.js 22 or newer](https://nodejs.org/en/download).
2. On this GitHub repository, choose **Code → Download ZIP**, then unzip it.
3. Open Terminal (macOS/Linux) or PowerShell (Windows). Type `cd `, followed by the extracted folder's path in quotes, and press Enter. You should be in the folder containing `cli.mjs`.
4. Run `node --version` to confirm Node.js is installed.

Keep the whole project folder. **No `npm install` is needed.**

#### 2. Allow this local tool to read Gmail

1. Open [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. Go to **APIs & Services → Library**, find **Gmail API**, and click **Enable**.
3. Open **Google Auth Platform** and complete the app name and contact details. For a personal account, choose **External**; while in Testing, add the receiving Gmail account under **Audience → Test users**.
4. Under **Clients**, create an OAuth client with type **Desktop app**, then download its JSON file.

This JSON identifies your private Google app. Keep it private. A regular API key or a Web application client will not work. [Google desktop authorization](https://developers.google.com/identity/protocols/oauth2/native-app).

#### 3. Connect Gmail and Notion

In the project folder, run:

```sh
node cli.mjs setup
```

Follow the prompts:

1. Paste the downloaded JSON file's full path **without surrounding quotes**.
2. Open the printed Google sign-in link in a browser **on the same computer**. Sign in to the receiving account and approve read-only Gmail access.
3. Return to the terminal. Paste your **Notion secret** (input is hidden), then your **database link**, prepared above. Select the table if asked.

When you see **Setup complete**, you are ready. Settings stay in the Git-ignored `.local/` folder.

**Testing-mode login expires after seven days** for this Gmail scope. If login expires or is revoked, run `node cli.mjs setup` and choose to reconnect Gmail. [Google token expiration](https://developers.google.com/identity/protocols/oauth2#expiration).

#### 4. Preview and import

Run these from the same project folder, replacing the dates with yours:

```sh
node cli.mjs preview --start 2026-10-01 --end 2026-10-03
node cli.mjs import --start 2026-10-01 --end 2026-10-03
```

`preview` adds nothing to Notion. `import` shows a fresh preview, then waits for you to type **IMPORT** before adding records. It checks for duplicates again after confirmation.

**Next time:** open a terminal in this folder and run the command. Keep the process running and your computer awake until completion. No Apps Script deployment or Codex needed. For help, run `node cli.mjs help`.

### Dates and results — both methods

- Dates filter **when the email arrived**, including both selected days in the browser/computer's timezone. **Apply Date** uses the application date inside the email.
- Web dates default to one week ago through today; blank dates use those defaults. In the terminal, omitting `--start` / `--end` leaves that boundary open; omit both to search all supported confirmations.
- **Ready to import:** can be added. **Already exists:** skipped. **Needs review:** check manually; it will not be imported.
- This is a manual importer, not background sync. Do not run the web and terminal importers at the same time against the same database.

### Privacy and template

Website reading sends the job URL only to its website (or the public Greenhouse API); public hostname checks use Google DNS. Gmail/Notion credentials are never sent with those requests. Website content is parsed as data, not executed.



**Security checks (2026-10-04):** Gmail access is read-only; the deployment manifest defaults to Only myself. The web app sends API requests to Notion and rejects redirects. Email text is displayed as text, not executable HTML. Local Google login uses PKCE and a state check; local API requests restrict destinations and reject redirects. These are code-level protections, not verification of your deployed copy. Project editors can access Apps Script secrets; local credential files are not encrypted. Sender filtering is not a cryptographic proof that an email is authentic. Keep your project private and grant the Notion connection access only to the intended database.

The web version saves credentials in your private Apps Script project. The terminal version saves them as plaintext files under `.local/`, protected by local file permissions where supported. Keep that folder, downloaded OAuth JSON, backups, and application output private. `.gitignore` excludes private files; never force-add them.

You may create your own database or obtain [Niko's Job Tracker template](https://www.notion.com/templates/job-tracker-the-ultimate-job-search-companion) from its original page. **This repository distributes the importer, not the template.** The earlier review (2026-10-03) found no explicit redistribution license; free access does not establish permission to republish it. Obtain the creator's permission before distributing a template copy. [Notion Marketplace terms](https://www.notion.com/help/template-gallery-guidelines-and-terms).

<details>
<summary>Troubleshooting, updates, and recovery</summary>

| Problem | What to do |
|---|---|
| `Gmail is not defined` | Add Gmail API v1 under Apps Script Services; deploy a new version. |
| No matching emails | Check the receiving account, receipt dates, and supported email format. |
| Notion 401 | Reconnect with a valid secret. |
| Notion 403 / 404 | Check database Connections, workspace, access limits, and the original database link. |
| Wrong property type | Match the Notion table above. |
| `Script function not found: previewWebsiteRows` | The deployment is missing the Website backend. Copy the **entire latest SingleFile.gs**, not the repository’s Code.gs alone, into Apps Script Code.gs; save and deploy a **New version** under Manage deployments, then reload. |
| Expired web preview or changed database | Preview again. |
| Quota reached / timeout | Wait for quota recovery; for timeouts, use a smaller date range. Preview again to check completed records. |
| CLI Google login expired | Run `node cli.mjs setup` and reconnect Gmail. |

**Update the web app:** replace Apps Script's `Code.gs` with the latest `SingleFile.gs`, use the latest `appsscript.json`, then **Deploy → Manage deployments → Edit → New version → Deploy**. Refresh the original URL. Saving alone does not update a deployment; existing Notion settings remain.

**Update the terminal version:** update the project files while preserving `.local/`.

**Interrupted imports:** completed records remain in Notion. Preview again before importing. An uncertain write keeps a `pending` marker to avoid blindly creating a duplicate. If it remains Needs review, check Notion manually. Only after confirming no page exists, stop the tool, privately back up its settings, and remove that single marker: `job:source:job-id` in web Script Properties, or `source:job-id` in `.local/ledger.json`. Never clear the whole ledger.

**Local file errors:** after a crash, confirm the old process has stopped before removing a stale `.local/run.lock`. Preserve and inspect any `*.json.tmp` and its corresponding JSON before removing temporary files. Locks and pending records are separate across local copies and Apps Script.

**Supported messages:** English “Your application was sent to” / “Your application has been sent to” and Traditional Chinese application confirmations. Simplified Chinese, HTML-only messages, and other layouts may not parse. Ambiguous dates are flagged for review. Duplicate checks recognize LinkedIn job IDs in numeric links, title-slug links and `currentJobId` search links, including links behind Notion text. The same ID is skipped regardless of existing descriptive fields. The same company and position with a different ID is marked **Needs review**, not automatically imported; it may be a repost or a separate opening. Without matching IDs, company, position and date are also checked. English parsing and CLI workflows use synthetic tests; real desktop OAuth/account access still needs your own setup.

**Service limits:** the CLI paces requests and retries temporary rate limits a bounded number of times. Persistent errors stop processing. There is no automatic background resume or CLI preview expiry. Actual quotas and pricing depend on your providers; the tool does not enable billing or purchase extra quota.

</details>

<details>
<summary>For developers</summary>

Web source: `Code.gs` (Gmail), `Website.gs` (Website fill), `Index.html` (interface). Terminal source: `cli.mjs`, `lib/`. Both reuse the parser in `Code.gs`. After shared/web changes, rebuild the generated `SingleFile.gs`:

```sh
python3 scripts/build-single.py
node tests/core.test.cjs
node tests/website.test.cjs
node --test tests/cli.test.mjs
git config core.hooksPath scripts
python3 scripts/check-private.py
```

The privacy checker allowlists reviewed files and scans tracked content/history. It does not scan account folders or guarantee the absence of every secret; review your changes before committing.

References: [Apps Script deployment](https://developers.google.com/apps-script/guides/web), [manifest](https://developers.google.com/apps-script/guides/manifest), [Gmail service](https://developers.google.com/apps-script/advanced/gmail), [Notion authorization](https://developers.notion.com/guides/get-started/authorization).

</details>

---

## 繁體中文

這個工具用兩種方式整理你的 **Notion 求職紀錄**：從 Gmail 匯入 LinkedIn 申請確認信，或依外部職缺網站連結補齊已有資料。所有變更都先預覽，再由你確認。介面與操作提示皆為英文；Gmail 匯入支援英文與繁體中文確認信。

### 有哪些功能、怎麼操作

**1. 從 Gmail 匯入申請紀錄（網頁版／終端機版）**

- 不必先在 Notion 手動建立每筆申請。完成設定後，選擇要搜尋的**收信日期範圍**；網頁版進入時預填一週前至今天（包含起訖整天），清空日期後按預覽會恢復該欄預設值。
- 網頁版按 **Check and preview**，檢查公司、職稱、日期及去重結果，再按 **Import new applications**。終端機版也有相同的預覽／匯入流程，指令見下方。
- 新增的資料會從確認信填入 **Company、Position、Website、Apply Date**，並設定 **Status = Applied**。Apply Date 是信內的申請日期，可能與收信日期不同。
- 已有相同職缺就跳過；疑似重複或不支援的信件會標示人工確認。既有資料及狀態會保留。

**2. 用職缺連結補齊資料（僅網頁版）**

- 在 Notion 表格新增一列，把 **外部職缺網址貼到 Website**；想讓工具補的欄位留空，包含表格中選用的 Location、Salary Range。多個職缺就各放一列。
- 打開工具的 **Fill from Website**，按 **Preview websites** 預覽。按鈕下方的 **Apply Date to save in Notion** 是這批資料要寫入的申請日期，**不是搜尋條件**；留空就用按下 **Fill blank fields** 時的本地日期。
- 按 **Preview websites** 預覽，檢查後按 **Fill blank fields**。工具直接讀公開職缺網頁，盡量補上空白的公司、職稱、地點及薪資範圍，空白 Status 設為 `Applied`，並補申請日期。**抓不到的欄位留空，其他抓到的仍可填入；這個流程不會搜尋 Gmail 確認信。**
- 預覽與寫入前都會檢查整個資料庫的重複職缺網址；重複列標示並跳過，不會刪除。已有欄位值會保留。網站需登入、阻擋存取或缺少可讀資料時，需要人工確認。

兩個功能都需要下方五個基本 Notion 欄位。Gmail 匯入只填這五個；Website 補資料還能填空白的 **Location、Salary Range**，只要表格有這兩個選用的**文字 / Text** 欄位。其他欄位保留。工具用來記錄你已完成的申請，不會替你投遞職缺。安裝、權限及各方式的按鈕／指令說明都在下方。

### 選一種執行方式

| | ⭐️網頁版 | 終端機版 |
|---|---|---|
| 跑在哪裡 | 你的 Google 帳號，使用 Google Apps Script | 你的電腦，使用 Node.js |
| 怎麼使用 | 開書籤、按按鈕 | 輸入指令 |
| 要安裝什麼 | 把兩個檔案貼進 Apps Script 專案 | Node.js 22+ 與本儲存庫 |
| 適合用途 | 日常匯入，不必在電腦裝軟體 | 較長的匯入，首次 Gmail 設定較多 |

**選一種即可，不必兩種都裝。** 都不需要 OpenAI、ChatGPT 或 Codex API 金鑰。Google Apps Script 是 Google 提供的程式執行服務；GitHub 只是放原始碼，不會執行工具，也不會自動更新你部署的版本。

**先說限制：** Apps Script 有[每次伺服器執行 6 分鐘與每日配額限制](https://developers.google.com/apps-script/guides/services/quotas)。網頁版每批讀 20 封，因此整次操作可以超過六分鐘。終端機版免除 Apps Script 限制，但**兩種方式仍受 [Gmail](https://developers.google.com/workspace/gmail/api/reference/quota)／[Notion](https://developers.notion.com/reference/request-limits) API 配額限制**。沒有固定總筆數上限，也不能保證每天可跑幾次。

### 先準備 Notion（兩種方式都需要，只做一次）

可沿用求職表格，或建立新的 Notion 資料庫，確認**欄位名稱與類型完全相符**：

| 欄位 | 類型 | 存什麼 |
|---|---|---|
| Company | 標題 / Title | 公司名稱 |
| Position | 文字 / Text | 職位名稱 |
| Status | 選取 / Select，包含 `Applied` 選項 | 初始申請狀態 |
| Website | 文字 / Text | Gmail 匯入填 LinkedIn 連結；Website 補資料使用你貼的外部職缺連結 |
| Apply Date | 日期 / Date | Gmail 匯入用信內申請日期；連結補資料用指定日期，留空則用按下確認當天 |

Website 補資料還可使用以下選用欄位，名稱需完全相符：

| 選用欄位 | 類型 | 可從網站取得的內容 |
|---|---|---|
| Location | 文字 / Text | 網站列出的工作地點，以及明示的遠端工作適用地區 |
| Salary Range | 文字 / Text | 網站列出的薪資、幣別與計薪週期 |

沒有這兩個欄位，也能用 Gmail 匯入和基本 Website 補資料。欄位不存在或不是 Text 時會跳過，工具不會新增或轉換欄位。Salary Range 用文字，才能存放例如 `USD 100,000–150,000 / year` 的範圍。

`Status` 要用 **Select**，不是 Notion 的 Status 類型；Position、Website 都用 **Text**。五個欄位都必須存在，使用連結補資料時只是列內的值可以留空；表格可保留其他欄位。工具不會替你修改表格結構。

1. 開啟 [Notion integrations](https://www.notion.so/profile/integrations)，建立 **Internal integration / Internal connection**，選資料庫所在的工作區。
2. 開啟 **Read content（讀取）**、**Insert content（新增）**；若要用連結補齊已有資料，也開啟 **Update content（更新）**。複製 **Internal Integration Secret**。這就是工具要你貼的 Notion 密鑰。
3. 回 Notion 開啟原始資料庫 → `…` → **Connections / 連線**，加入剛建立的連線。
4. 將資料庫**開啟為整頁**並複製連結。若使用 **Job Finder → Job Tracker**，要複製 **Job Tracker 資料庫**的連結。

完成後，你手上應有兩樣東西：**Notion 密鑰、資料庫連結**。之後換另一種執行方式也能沿用。

### 方法一：網頁版（⭐️推薦）

**這是在你的 Google 帳號裡建立一份私人網頁工具。** 準備瀏覽器、收到申請信的 Google 帳號，以及上面的 Notion 資料即可。

#### 1. 貼入兩個檔案

1. 用收信的 Google 帳號開啟 [Google Apps Script](https://script.google.com/home/start)，按 **New project / 新增專案**，命名為「Application Tracker」。
2. 開啟本儲存庫的 [SingleFile.gs](SingleFile.gs) → **Raw**，複製全部內容。回 Apps Script，用它完整取代 `Code.gs` 內容並儲存。
3. 點齒輪 **Project Settings / 專案設定**，勾選「在編輯器中顯示 appsscript.json 資訊清單檔案」。
4. 回編輯器，用本儲存庫的 [appsscript.json](appsscript.json) 完整取代專案的 `appsscript.json`，儲存。
5. 確認 **Services / 服務** 有 **Gmail API**。沒有的話，按 `+` → **Gmail API → v1 → 新增**，識別符保留 `Gmail`。

`SingleFile.gs` 是程式和介面；`appsscript.json` 是權限設定。**不必貼入其他程式檔，也不必另建 HTML 檔。**

#### 2. 取得自己的工具網址

1. 按 **Deploy / 部署 → New deployment / 新增部署**，類型選 **Web app / 網頁應用程式**。
2. **Execute as / 執行身分** 選 **Me / 我**；**Who has access / 誰可以存取** 選 **Only myself / 僅限自己**。
3. 按 **Deploy → Authorize access / 授權存取**，選收信帳號，允許 Gmail 唯讀與外部連線權限。
4. 開啟產生的 **Web app URL / 網頁應用程式網址**，加入書籤。

若 Google 顯示未驗證提示，先確認是自己的專案與正確程式，再繼續。組織帳號限制可能需管理員處理；使用自訂 Cloud 專案時，也需啟用 Gmail API。

#### 3. 連接並使用

1. 在工具頁展開 **Set up or change Notion connection**。
2. 貼上 **Notion connection secret** 與 **Database link**，按 **Connect Notion**。若要求選表格，選好後再按一次。
3. 選 **Start date / End date** → **Check and preview**。
4. 檢查結果 → **Import new applications**，保持頁面開啟直到完成。

**下次使用：** 開同一個書籤就好，不必重新部署，也不必開 Codex。預覽約 30 分鐘會過期，也可能提前被清除，預覽後就接著匯入。

### 從外部職缺網站補資料（網頁版）

介面有 **LinkedIn Gmail import** 和 **Fill from Website** 兩個功能按鈕，各自有預覽及操作。Website 功能的用法：

1. 在 Notion 的 **Website 貼外部職缺網址**，一個職缺一列；想讓工具補的欄位留空。
2. 在 Notion 連線開啟 **Update content（更新）**，然後打開工具的 **Fill from Website**。
3. 按 **Preview websites**，檢查抓到的資料和去重結果。
4. 在預覽按鈕下方，可選填 **Apply Date to save in Notion**。這是要寫入 Notion 空白 Apply Date 欄位的日期，**不是搜尋條件**；留空就用按下確認時的本地日期。已有日期保留，改選日期不必重新預覽。
5. 確認日期後，在預覽後 30 分鐘內按 **Fill blank fields**。

工具會盡量補抓得到的空白 **Company、Position、Location、Salary Range**，以及 **Apply Date、Status（Applied）**。缺少的資料留空，不會擋住其他抓到的欄位。你貼的 **Website 原始連結會保留**；已有欄位值、圖示和其他內容也保留。**Company、Position、Status、Apply Date 都有值的列會直接跳過**，即使 Location 或 Salary Range 空白，也不會重新抓取或檢查該列。沒有 Website 的列也會跳過。**Location、Salary Range** 是選用的**文字 / Text** 欄位；不存在或類型不同時不修改。薪資保留網站提供的幣別、範圍及計薪週期，不猜金額，也不擅自換算年薪。此流程不讀 Gmail，也不新增 Notion 列。

**例子：** 網站只有公司、職稱和地點，沒有薪資，就補抓得到的資料，Salary Range 留空。已有值不覆蓋。薪資未註明計薪週期時，文字會標示 `period unspecified`。

**支援範圍：** 含可讀取 `JobPosting` 職缺資料的公司公開招募頁，以及 Greenhouse 一般／嵌入式職缺連結、具有相符職稱與公司標記的 Breezy 職缺頁。也支援 iCIMS 同一職缺的內嵌頁面與 Rippling 頁面內職缺資料（包含提供的地點及薪資範圍）。Jobright 頁面內資料可讀取公司、職稱與職缺地點；已移除／隱藏的職缺會顯示歷史紀錄提示，無可讀薪資則留空。Jobvite 招募頁可從相符的網頁標題與職稱讀取公司、職稱及地點，讀取時省略追蹤參數。SmartRecruiters one-click 連結使用公開職缺 API，EA 職缺頁使用核對職缺編號後的頁面資料；Oracle Candidate Experience 職缺連結使用公開職缺明細入口、核對職缺編號，補入可取得的雇主、職稱及主要工作地點；缺少資料的欄位留空。HTTP 403 代表網站拒絕這次讀取，需人工確認。網址轉址時會逐一檢查公開 HTTPS 目的地。無法保證所有網站都能讀取：需登入、阻擋存取、僅由 JavaScript 載入的頁面、職缺列表或完全沒有可讀職缺資料，都會標示人工確認；職缺只提供部分資料時，仍可補抓得到的欄位，公司名稱欄位為空時，也會從職缺內文的明確英文招募句（例如「ExampleCorp is seeking a Software Engineer」）擷取公司名稱。名稱有歧義就留空，不從網域或招募平台名稱猜公司。這個備援使用同一份已下載網頁，不增加網站查詢，也不需要 AI API；發布日期不會當成申請日期。

**查詢時間：** 每次新的 Website 預覽只分頁讀取 Notion 全表一次，接著只處理有 Website、必要欄位未填完的列；完成的列不會發出網站請求。後續批次沿用該次預覽的私人暫存，最長約 30 分鐘。確認寫入的每一批仍會重新讀取 Notion 驗重，並再次檢查目標列與職缺資料。重新按預覽會開始一次新的掃描。

**去重方式：** 預覽及更新前，比對整理過的網址（忽略常見追蹤參數）、已支援招募平台的職缺編號及轉址後網址。同一連結優先補已有較多資料的列，再選最早建立的列；其他重複列跳過，不會刪除。不同網址但公司與職稱相同時，標示疑似重複。不同網址不一定能自動認出是同一職缺。

**驗證範圍：** 已實際唯讀測試 Figma 的 Greenhouse 職缺與 Stripe 官網職缺，成功取得公司、職稱、地點和薪資；Spotify 的 Lever 頁面回傳 403，工具正確標示無法讀取。這些案例不代表每個職缺都能讀；你部署的 Apps Script 與 Notion 帳號仍需先預覽確認。

更新已部署的網頁：用最新 `SingleFile.gs` 取代 Apps Script 的 `Code.gs`，按 **部署 → 管理部署 → 編輯 → 新版本 → 部署**，再重新整理原網址。原 Notion 設定可沿用。

### 方法二：終端機版

**這是在自己的電腦執行工具。** 需要另外做一次 Google 登入設定，不使用 Apps Script 的部署。

#### 1. 安裝並開啟專案

1. 安裝 [Node.js 22 或更新版本](https://nodejs.org/en/download)。
2. 在此 GitHub 儲存庫按 **Code → Download ZIP**，解壓縮。
3. 開啟「終端機」（macOS／Linux）或 PowerShell（Windows）。輸入 `cd `，接著輸入加上引號的解壓縮資料夾路徑，按 Enter；進入的資料夾應包含 `cli.mjs`。
4. 執行 `node --version`，確認 Node.js 已安裝。

保留整個專案資料夾。**不用執行 `npm install`。**

#### 2. 允許本機工具讀 Gmail

1. 開啟 [Google Cloud Console](https://console.cloud.google.com/)，建立或選擇一個專案。
2. 到 **APIs & Services → Library**，搜尋 **Gmail API**，按 **Enable / 啟用**。
3. 開啟 **Google Auth Platform**，填應用名稱與聯絡資料。個人帳號選 **External**；Testing 階段在 **Audience → Test users** 加入收信的 Gmail 帳號。
4. 到 **Clients** 建立 OAuth 用戶端，類型選 **Desktop app**，下載 JSON 檔案。

這份 JSON 用來識別你自己的 Google 應用，請私下保管。一般 API key 或 Web application 類型不能代替。[Google 桌面授權文件](https://developers.google.com/identity/protocols/oauth2/native-app)。

#### 3. 連接 Gmail 和 Notion

在專案資料夾執行：

```sh
node cli.mjs setup
```

依序完成提示：

1. 貼入剛下載 JSON 檔案的完整路徑，**這裡不加前後引號**。
2. 在**同一台電腦**的瀏覽器開啟終端機顯示的 Google 登入連結，選收信帳號，允許 Gmail 唯讀存取。
3. 回終端機，貼入上面準備的 **Notion 密鑰**（輸入不顯示），再貼**資料庫連結**。若有多個表格，選正確的那個。

看到 **Setup complete** 就完成了。設定保存在 Git 忽略的 `.local/` 資料夾。

**Testing 模式的 Gmail 登入七天會過期。** 到期或授權被撤銷時，重跑 `node cli.mjs setup` 並選擇重新連接 Gmail。[Google token 到期說明](https://developers.google.com/identity/protocols/oauth2#expiration)。

#### 4. 預覽與匯入

在同一個專案資料夾執行，日期換成你要查的範圍：

```sh
node cli.mjs preview --start 2026-10-01 --end 2026-10-03
node cli.mjs import --start 2026-10-01 --end 2026-10-03
```

`preview` 只預覽，不新增 Notion 紀錄。`import` 會重新預覽，等你輸入 **IMPORT** 才新增，確認後還會再次去重。

**下次使用：** 在此資料夾開終端機、執行指令即可。保持程式執行、電腦喚醒，直到完成；不必部署 Apps Script，也不必開 Codex。查指令可用 `node cli.mjs help`。

### 日期與結果（兩種方式相同）

- 日期篩選的是**收到信的時間**，依瀏覽器／電腦時區，包含開始與結束整天。**Apply Date** 則採用信裡的應徵日期。
- 網頁版日期預設一週前至今天；留空會套用該欄預設值。終端機省略 `--start`／`--end` 才表示不限該端，兩端省略則查所有支援的歷史確認信。
- **Ready to import**：可新增。**Already exists**：跳過。**Needs review**：要手動核對，不會匯入。
- 這是手動匯入工具，沒有背景同步。不要同時用網頁與終端機對同一資料庫匯入。

### 隱私與模板

Website 讀取只向職缺網站（或 Greenhouse 公開 API）請求職缺資料；公開網域檢查使用 Google DNS。這些請求不會附帶 Gmail／Notion 憑證，網頁內容只作為資料解析，不執行其中程式。



**資安檢查（2026-10-04）：** Gmail 只申請唯讀權限，部署設定預設僅限自己；網頁 API 請求送往 Notion 並拒絕轉址，信件文字不當成 HTML 執行。本機 Google 登入使用 PKCE 與 state 驗證，API 請求限制目的地並拒絕轉址。這是程式層的保護，未驗證你實際部署的副本；專案編輯者可取得 Apps Script 密鑰，本機憑證也未加密。寄件者篩選不等於驗證信件真偽。請保持專案私人，Notion 連線只授權需要的資料庫。

網頁版的密鑰存於私人 Apps Script 專案；終端機版存於 `.local/` 明文檔案，使用系統支援的本機權限保護。請保護該資料夾、下載的 OAuth JSON、備份與求職輸出。`.gitignore` 會排除私人檔案，不要強制加入 Git。

可自行建表格，或從原始頁面取得 [Niko 的 Job Tracker 模板](https://www.notion.com/templates/job-tracker-the-ultimate-job-search-companion)。**本儲存庫提供匯入工具，不散布模板副本。** 先前查核（2026-10-03）未找到明確再散布授權；免費取得不代表可以重新發布模板。若要散布副本，先取得作者許可。[Notion Marketplace 條款](https://www.notion.com/help/template-gallery-guidelines-and-terms)。

<details>
<summary>除錯、更新與錯誤恢復</summary>

| 問題 | 處理方式 |
|---|---|
| `Gmail is not defined` | 在 Apps Script 服務加入 Gmail API v1，再部署新版本。 |
| 沒有找到信 | 確認收信帳號、收信日期與支援的信件格式。 |
| Notion 401 | 用有效密鑰重新連接。 |
| Notion 403／404 | 檢查資料庫 Connections、工作區、存取限制與原始資料庫連結。 |
| `Script function not found: previewWebsiteRows` | 部署缺少 Website 後端。把最新 **SingleFile.gs 全部內容**貼進 Apps Script 的 Code.gs（不是只複製儲存庫的 Code.gs），儲存後到「管理部署」部署**新版本**，再重新整理網頁。 |
| 欄位類型不符 | 依上方 Notion 表格修正。 |
| 網頁預覽過期或換過資料庫 | 重新預覽。 |
| 配額用完／超時 | 等待配額恢復；超時可縮小日期範圍。重新預覽核對完成項目。 |
| CLI Google 登入過期 | 重跑 `node cli.mjs setup`，重新連接 Gmail。 |

**更新網頁版：** 用最新 `SingleFile.gs` 取代 Apps Script 的 `Code.gs`，使用最新 `appsscript.json`，再按 **部署 → 管理部署 → 編輯 → 新版本 → 部署**。重新整理原網址；只儲存不會更新部署，原 Notion 設定可沿用。

**更新終端機版：** 更新專案程式檔，保留 `.local/`。

**匯入中斷：** 已完成的紀錄仍在 Notion，重新預覽再匯入。不確定是否寫入成功時，程式保留 `pending` 標記，避免盲目新增。若仍顯示 Needs review，先手動查 Notion。只有確定沒建立時，才停止工具、私下備份設定，刪除那一筆標記：網頁版在 Script Properties 的 `job:來源:職缺ID`；CLI 在 `.local/ledger.json` 的 `來源:職缺ID`。不要整份清空。

**本機檔案錯誤：** 當機後先確認舊程序已停止，再刪除殘留 `.local/run.lock`。若有 `*.json.tmp`，先保留並檢查對應 JSON，再處理暫存檔。不同本機副本與 Apps Script 的鎖、pending 紀錄各自獨立。

**信件支援：** 英文「Your application was sent to／Your application has been sent to」與繁體中文申請確認信。不支援簡體中文；純 HTML 或其他排版可能無法解析。含糊日期會列為待確認。去重支援 LinkedIn 純數字網址、含職稱的網址、`currentJobId` 搜尋網址，以及 Notion 文字背後的超連結。同 ID 會直接跳過，即使既有描述欄位空白；同公司、同職稱但 ID 不同時，改列 **Needs review**，不自動新增，因為可能是重刊或另一個職缺。沒有相同 ID 時也會比對公司、職稱和日期。英文解析與 CLI 流程以虛構資料測試，真實桌面 OAuth／帳號仍須完成自己的設定後驗證。

**服務限制：** CLI 控制請求速度，遇暫時限流會有限次重試，持續失敗會停止。沒有背景自動續跑；CLI 沒有預覽到期期限。實際配額與計價依服務商規定，工具不會替你開付費或購買配額。

</details>

<details>
<summary>開發者說明</summary>

網頁原始碼：`Code.gs`（Gmail）、`Website.gs`（Website 補資料）、`Index.html`（介面）；終端機原始碼：`cli.mjs`、`lib/`。兩者共用 `Code.gs` 的解析規則。修改共用／網頁程式後，重新產生整合版 `SingleFile.gs`：

```sh
python3 scripts/build-single.py
node tests/core.test.cjs
node tests/website.test.cjs
node --test tests/cli.test.mjs
git config core.hooksPath scripts
python3 scripts/check-private.py
```

隱私檢查只允許已審查的檔案，掃描追蹤內容與歷史，不掃描電腦帳號資料夾。自動檢查不是完整隱私保證，提交前仍須檢查差異。

參考：[Apps Script 部署](https://developers.google.com/apps-script/guides/web)、[權限設定](https://developers.google.com/apps-script/guides/manifest)、[Gmail 服務](https://developers.google.com/apps-script/advanced/gmail)、[Notion 授權](https://developers.notion.com/guides/get-started/authorization)。

</details>
