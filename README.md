# GSE Store Management (Tool in - Tool out)

ระบบจัดการเบิก-คืนอุปกรณ์เครื่องมือช่าง (GSE Store Management) บน **React + Vite (Single-File Bundle)** และ **Google Apps Script + Google Sheets**

---

## โครงสร้างโปรเจกต์

| Path | หน้าที่ |
|---|---|
| `src/` | โค้ด Frontend (React 18, Context API, QR Scanner, QR Generator) |
| `src/utils/` | Helpers กลาง (`date.js` เวลา `Asia/Bangkok`, `transactions.js`, `tools.js`, `csv.js`) |
| `src/hooks/` | Custom Hooks (`useQrScanner.js`, `useModal.js`) |
| `gas/` | โค้ดสำหรับขึ้น Google Apps Script (`Code.js`, `Migration.js`, `appsscript.json`, `index.html`) |
| `tests/` | Unit tests & GAS mock VM tests (Vitest) |
| `tools/` | Python utility scripts และ `sheet_repair.gs` สำหรับตรวจ/ซ่อมข้อมูลใน Sheet |

---

## คำสั่งพัฒนา & ทดสอบ

```bash
npm install
npm run dev        # รัน dev server (http://localhost:5173)
npm test           # รัน unit tests + GAS backend tests (Vitest)
npm run lint       # ตรวจสอบโค้ดด้วย ESLint (--max-warnings 0)
```

---

## ขั้นตอน Build และ Deploy ขึ้น Google Apps Script

> โปรเจกต์นี้ใช้ `vite-plugin-singlefile` (`minify: true`) เพื่อรวม Frontend ทั้งหมดเป็นไฟล์เดียวที่ `dist/index.html` ซึ่งต้องคัดลอกไปทับ `gas/index.html` ก่อน `clasp push` เสมอ

### Windows (CMD)

```cmd
cd /d "D:\Project Tool in & Tool out"
npm run build
copy /Y dist\index.html gas\index.html
node "node_modules/@google/clasp/build/src/index.js" push
node "node_modules/@google/clasp/build/src/index.js" deploy -i AKfycbwFrI5N6LtVDguJgxs4hNjj7SZE4eg0_yikz11v2TGJqSJtG-ISQy1anJEOLMAYs8rM -d "Release description"
```

### Linux / macOS

```bash
npm run build
cp dist/index.html gas/index.html
npx clasp push
npx clasp deploy -i AKfycbwFrI5N6LtVDguJgxs4hNjj7SZE4eg0_yikz11v2TGJqSJtG-ISQy1anJEOLMAYs8rM -d "Release description"
```

> **Rollback:** หากต้องการย้อนกลับเวอร์ชันเดิมบน Production (เช่น Version 45)
> ```cmd
> node "node_modules/@google/clasp/build/src/index.js" deploy -i AKfycbwFrI5N6LtVDguJgxs4hNjj7SZE4eg0_yikz11v2TGJqSJtG-ISQy1anJEOLMAYs8rM -V 45 -d "Rollback to v45"
> ```

---

## การดูแลรักษาข้อมูล Google Sheet (Manual Tasks)

1. **สำรองข้อมูลก่อนแก้ไขเสมอ:** เปิด Google Sheet → `File → Make a copy`
2. **ตั้ง GitHub Repository เป็น Private:** GitHub → `Settings → Danger Zone → Change repository visibility`
3. **ตรวจ/ซ่อมคอลัมน์พนักงานสลับ (`2.1 / H1`) และรายงาน Orphan `tool_id` (`2.10 / M6`):**
   - คัดลอกฟังก์ชันใน [`tools/sheet_repair.gs`](tools/sheet_repair.gs) ไปวางในไฟล์แยกชั่วคราวใน Apps Script Editor (ไม่ผูกกับ `doGet`/`doPost`)
   - รัน `inspectEmployeesAndTransactions()` และ `reportOrphanToolIds()` (โหมดอ่าน/Dry-Run เท่านั้น) เพื่อดู `Execution log`
   - หากยืนยันว่ามีแถวสลับจริงและสำรอง Sheet แล้ว ค่อยรัน `repairSwappedEmployees(false)`
4. **เปิดใช้ Keep-Warm Trigger (ทางเลือก — ลด cold start เฉพาะเวลาทำงาน 07:00–19:00 น.):**
   - เปิด Apps Script Editor → เลือกฟังก์ชัน `setupKeepWarmTrigger` แล้วกด Run 1 ครั้ง (หากต้องการปิด ให้รัน `removeKeepWarmTrigger`)
