# LinkedIn → Notion 申請紀錄小幫手

**平常只要：選日期 → 預覽 → 匯入。** 支援繁體中文與英文 LinkedIn 申請已送出確認信，新增前會檢查 Notion 是否已有相同申請。

沒有筆數選單，也沒有只查前 50 封的總數限制。工具會自動分頁搜尋你選的日期範圍，再分批匯入；過程中請保持頁面開啟。仍受 Google／Notion 的時間與配額限制，遇到錯誤會明確停止，可重新預覽核對已完成項目。

## 最簡單的安裝方式

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

1. 打開第二步保存的工具網址，展開 **首次設定／更換 Notion 連線**。
2. 貼上 **Notion 連線密鑰**與**資料庫連結**，按 **連接 Notion**。
3. 工具會自動找出資料來源並驗證欄位；若資料庫有多個來源，選擇對應表格後再按一次連接。
4. 看到已連接後即可使用。不必找 data source ID，也不必進入指令碼屬性手動填設定。

密鑰只透過自己的 Apps Script 傳送到 Notion 以驗證，驗證成功後保存在私人 Apps Script 專案設定；不會寫入 GitHub 或回傳到預覽結果。密鑰欄會清空。不要將專案分享給不應存取資料的人，也不要上傳設定畫面的截圖。

## 日常使用

1. 開啟書籤中的工具網址。
2. 選擇開始／結束日期。包含兩端整天；留空代表不限該端，兩端留空會查所有符合條件的歷史確認信。
3. 按 **檢查並預覽**，等待顯示「日期範圍搜尋完成」。工具會自動讀取後續頁，不需要挑筆數。
4. 檢查結果：可新增會匯入，已存在會跳過，待確認請手動核對。
5. 按 **匯入可新增項目**，等待完成。請保持頁面開啟；再次執行時仍會重新比對 Notion。

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
- 不明確的寫入錯誤保留 pending 標記，不直接重試。先到 Notion 確認；只有確定未建立時，才在指令碼屬性刪除對應 `job:資料來源:職缺編號` 標記。
- 執行鎖僅涵蓋本 Apps Script 專案，其他獨立程式同時新增仍可能競態。

## 第三方模板與授權

可選模板：[Job Tracker: The Ultimate Job Search Companion](https://www.notion.com/templates/job-tracker-the-ultimate-job-search-companion)，作者 **Niko**。請從作者的原始頁面取得模板，再在自己的工作區使用。也可以完全不使用模板，自己建立符合五個欄位的空白資料庫。

**本儲存庫只提供獨立匯入工具與必要欄位設定，不附帶第三方模板的頁面、版型、圖片、文案、匯出檔或可供重新散布的副本；亦未獲作者或 Notion 背書。**

授權查核日期：2026-10-03。查閱公開模板頁面及其連結的作者商店後，未找到明確授權將此模板重新打包、公開散布或以開源授權發布的聲明。免費取得不代表獲得這些權利；若另有作者提供的授權文件，應再依該文件確認。

[Notion Marketplace 條款](https://www.notion.com/help/template-gallery-guidelines-and-terms)保留創作者對模板內容的所有權，並授予終端使用者存取及使用權。條款另明文禁止重貼向其他創作者購買的內容；該句針對購買內容，不能單憑它斷言所有免費模板都被同樣禁止，也不能反過來推定免費模板可任意再散布。

本專案的做法是公開獨立程式與原始模板連結，讓使用者各自向作者取得模板。如果要把模板本身或改版副本放上 GitHub，應先取得作者明確的再散布許可。作者聯絡入口在模板頁面的 **Email the creator**。這是依公開資料作的實務判斷，並非作者的授權確認。

## 隱私與開發者說明

儲存庫不包含帳號、Notion ID、密鑰、真實信件、求職資料或私人截圖。`.gitignore` 預設拒絕新檔案，只允許審查過的程式及說明；已追蹤檔案仍需檢查差異。

開發者修改 `Code.gs`、`Index.html` 後，重新產生整合版並測試：

```sh
python3 scripts/build-single.py
node tests/core.test.cjs
git config core.hooksPath scripts
python3 scripts/check-private.py
```

提交／推送檢查會掃描已追蹤內容與歷史，不會掃描電腦帳號資料夾。自動掃描不是完整隱私保證，提交前仍須審查內容。`SingleFile.gs` 是產生的完整程式；部署者只需使用該檔。

## 官方文件

- [Google 網頁部署](https://developers.google.com/apps-script/guides/web)
- [Google 資訊清單設定](https://developers.google.com/apps-script/guides/manifest)
- [Gmail API 服務](https://developers.google.com/apps-script/advanced/gmail)
- [Notion 授權](https://developers.notion.com/guides/get-started/authorization)
