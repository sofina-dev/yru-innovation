# YRU Innovation Portal v.2

Google Apps Script web app for the innovation competition & showcase system.
Single-page app (one `doGet`, client-side hash router) backed by 3 Google
Sheets (`Users`, `Submissions`, `Scores`). See the code comments in
`Database.gs`, `Code.gs`, and `AdminApi.gs` for the performance decisions
that fix the sluggishness of the v1 prototype.

## Deployment (run these from this folder)

All of this should be done while logged into **marorseh.l@yru.ac.th**.

1. **Login to clasp with the target Google account**
   ```
   clasp login
   ```
   This opens a browser window — sign in as `marorseh.l@yru.ac.th` and approve access.

2. **Create the Apps Script project** (creates `.clasp.json` + a new script)
   ```
   clasp create --type standalone --title "YRU Innovation Portal v2" --rootDir .
   ```

3. **Push the code**
   ```
   clasp push
   ```

4. **Run the one-time database setup**
   Open the project (`clasp open`), select `setupDatabase` in the function
   dropdown, and click Run. On first run it will:
   - Create a brand-new Google Spreadsheet ("YRU Innovation Portal - Database")
   - Create the `Users`, `Submissions`, `Scores` sheets with headers
   - Seed one Admin account (`admin` / a generated password)

   Check **Executions > setupDatabase > Logs** for the generated admin
   username/password — it is only printed once. You can change it later
   from Admin > ตั้งค่า once logged in (or by re-running with a manual edit).

5. **Deploy as a Web App**
   In the Apps Script editor: Deploy > New deployment > type "Web app".
   - Execute as: **Me** (marorseh.l@yru.ac.th)
   - Who has access: **Anyone**

   Copy the `/exec` URL from the deployment dialog.

6. **Embed in the KM system**
   Use the `/exec` URL as an iframe `src` inside
   `https://yru-km.pages.dev/?system=innovation`, e.g.:
   ```html
   <iframe src="PASTE_EXEC_URL_HERE" style="width:100%;min-height:100vh;border:0;"></iframe>
   ```
   The app already sets `X-Frame-Options: ALLOWALL` so iframe embedding on
   another domain works.

## After deployment

- Log in as `admin`, go to **ตั้งค่าระบบ** to rename the 3 categories, edit
  the ~12 default judging criteria (labels/max scores), and turn on
  "เปิดรับ/แก้ไขผลงาน" when the competition opens.
- Create judge accounts from **ผู้ใช้งาน**, assigning each judge to exactly
  one category.
- When judging is done, use the single **เผยแพร่ผลงานทั้งหมดสู่สาธารณะ**
  button on the Overview tab to flip every submitted entry public at once,
  then set award status per item from the **ผลงาน & รางวัล** tab.

## Redeploying after code changes

```
clasp push
```
then, in the Apps Script editor: Deploy > Manage deployments > edit the
existing Web App deployment > New version. (A plain `clasp push` updates
the underlying script but not a already-published Web App version.)
