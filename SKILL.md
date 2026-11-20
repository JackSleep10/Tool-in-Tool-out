# Master Skills Directory (Antigravity AI)
นี่คือไฟล์รวบรวมทักษะ (Skills) ที่จำเป็นสำหรับการพัฒนาโปรเจกต์ ที่ AI (Antigravity) ได้ดึงความรู้มาจาก `awesome-claude-skills` เพื่อใช้เป็นแกนหลักในการทำงานร่วมกับคุณ

เมื่อผู้ใช้สั่งให้ทำงาน AI ควรปฏิบัติตามหลักการของ Skills เหล่านี้โดยอัตโนมัติเมื่อสถานการณ์เหมาะสม:

## 1. Webapp Testing (การทดสอบระบบเว็บ)
- **ความสามารถ:** วิเคราะห์และตรวจสอบ UI/UX ของเว็บแอปพลิเคชัน
- **วิธีการทำงาน:** 
  - ตรวจสอบการแสดงผลในหน้าจอขนาดต่างๆ
  - ค้นหาจุดบกพร่อง (Bug) ในการทำงานของ JavaScript หรือ HTML/CSS
  - แนะนำการแก้ไขโค้ดเพื่อแก้ปัญหาการแสดงผลและปรับปรุงประสิทธิภาพ

## 2. Software Architecture & Clean Code (สถาปัตยกรรมซอฟต์แวร์)
- **ความสามารถ:** ออกแบบและวางโครงสร้างโค้ดให้สะอาดและดูแลรักษาง่าย
- **วิธีการทำงาน:**
  - ยึดหลัก SOLID Principles และ Clean Architecture เสมอ
  - แยกส่วนโค้ดที่ซ้ำซ้อนออกมาเป็น Component หรือ Helper functions
  - ลด Hardcode และใช้ตัวแปร Configuration แทน

## 3. Review Implementing (การตรวจสอบความถูกต้องของโค้ด)
- **ความสามารถ:** ตรวจทานโค้ดก่อนนำไปใช้งานจริง (Code Review)
- **วิธีการทำงาน:**
  - ตรวจสอบหาข้อผิดพลาดด้านความปลอดภัย (Security flaws)
  - ปรับปรุงประสิทธิภาพของโค้ด (Performance optimization)
  - แนะนำแนวทางที่ดีกว่า (Best practices) ก่อนให้ผู้ใช้เซฟงาน

## 4. Theme Factory & UI Design (การออกแบบและธีม)
- **ความสามารถ:** ปรับแต่งความสวยงามของ Web App (Aesthetics)
- **วิธีการทำงาน:**
  - เลือกใช้ Color Palette ที่ดูเป็นมืออาชีพ ทันสมัย (เช่น Glassmorphism)
  - จัดการ Whitespace และ Alignment ให้สมดุล
  - ออกแบบให้ Responsive รองรับการ Print (เช่น A4 PDF) หากจำเป็น

## 5. Test Fixing & Debugging (การแก้ไขข้อผิดพลาด)
- **ความสามารถ:** วิเคราะห์ Root Cause ของ Error และแก้ไข
- **วิธีการทำงาน:**
  - อ่าน Error log อย่างละเอียด
  - ทำการสืบย้อนหลัง (Traceback) เพื่อหาสาเหตุที่แท้จริง ไม่แก้ปัญหาที่ปลายเหตุ
  - เสนอโค้ดชุดใหม่ที่แก้ปัญหาได้อย่างเบ็ดเสร็จ

## 6. Document Processing & File Organization
- **ความสามารถ:** จัดการไฟล์ โครงสร้างโปรเจกต์ และเอกสาร
- **วิธีการทำงาน:**
  - ช่วยแนะนำการจัดระเบียบไฟล์โฟลเดอร์ให้เป็นหมวดหมู่
  - สรุปโครงสร้างข้อมูลหรือไฟล์ให้อ่านเข้าใจง่าย

## 7. GAS Deployment Rule (กฎการ Deploy ขึ้น Google Apps Script)
- **กฎบังคับ:** ทุกครั้งที่แก้โค้ด Frontend (`src/`) หรือ Backend (`gas/`) เพื่อใช้งานจริง หรือเมื่อผู้ใช้สั่ง push/อัปเดต GAS **ห้ามหยุดแค่ `clasp push` เพียงอย่างเดียว** เพราะ `clasp push` อัปเดตแค่ `@HEAD` (`/dev`) ไม่ได้อัปเดตลิงก์ Production (`/exec`)
- **ขั้นตอนที่ต้องทำครบต่อเนื่องกันเสมอ (บน Windows ใช้ `node` รัน CLI ตาม [README.md](README.md)):**
  1. Build Frontend: `node "node_modules/vite/bin/vite.js" build`
  2. คัดลอก bundle: `Copy-Item -Force "dist\index.html" "gas\index.html"`
  3. Push โค้ดขึ้น GAS: `node "node_modules/@google/clasp/build/src/index.js" push`
  4. **Deploy ทับ Deployment ID ใช้งานจริงทันที** (เว้นแต่ผู้ใช้สั่งชัดเจนให้ push แค่ `@HEAD`):
     `node "node_modules/@google/clasp/build/src/index.js" deploy -i AKfycbwFrI5N6LtVDguJgxs4hNjj7SZE4eg0_yikz11v2TGJqSJtG-ISQy1anJEOLMAYs8rM -d "<Release description>"`

---
*หมายเหตุ: เนื่องจากคลังของ `awesome-claude-skills` มีทักษะมากกว่า 1,000 รูปแบบ การดึงมาทั้งหมดจะทำให้ล้นหน่วยความจำ (Context window) ไฟล์นี้จึงสรุปเฉพาะแกนหลัก (Core Skills) ที่ตอบโจทย์การเขียนเว็บแอปพลิเคชันของคุณมากที่สุด หากต้องการเพิ่ม Skill เฉพาะทางอื่นๆ สามารถระบุเพิ่มในไฟล์นี้ได้เลย!*
