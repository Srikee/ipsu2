# Project Instructions & Agent Guidelines

## 1. Project Overview & Architecture
- **Mobile App**: `d:\ionic\ipsu2` (Ionic 8 + Angular 20)
- **API Server**: `d:\Server\ipsu2-api` (PHP Native + MySQL/Oracle/PostgreSQL)
- **API Communication**: 
  - เรียกผ่าน `IpsuService.Ajax()` เป็นหลัก (ส่ง HTTP POST JSON payload)
  - เซิร์ฟเวอร์อ่านค่าผ่าน `php://input` (`$REQUEST = json_decode(...)`)

## 2. Critical Tech Constraints (ข้อจำกัดสำคัญ)
- **Mobile Engine**: โปรเจกต์นี้ใช้ **Apache Cordova** ในการบิลด์และเรียก Native Features
  - **ห้าม** แนะนำหรือรันคำสั่ง `npx cap ...` หรือแปลงโปรเจกต์เป็น Capacitor
  - ใช้ `@ionic/cordova-builders` ในการบิลด์
- **Native Plugins**:
  - Push Notification: `onesignal-cordova-plugin` (ผูกผู้ใช้ด้วย `OneSignal.login(username)` โดยไม่เก็บ Token ที่ API)
  - Web Browser: `cordova-plugin-inappbrowser`
  - Deep Link / SSO Callback: `cordova-plugin-ipsu-deeplink` (Scheme: `ipsu://`)
  - Device / Statusbar / Keyboard: Cordova Plugins

## 3. Coding Conventions & Best Practices
- หน้าจอและการแจ้งเตือนควรใช้ Service กลาง (`IpsuService.ShowAlert()`, `ShowConfirm()`, `ShowToast()`)
- รักษาความเข้ากันได้ของการทำงานร่วมกับ API Server เสมอ

## 4. Commit Message Policy
หลังจากเขียน, แก้ไข หรือปรับปรุงโค้ดเสร็จสิ้นทุกครั้ง ต้องสร้าง **Commit Message ภาษาไทย** สรุปสิ่งที่ทำไว้ท้ายการตอบกลับเสมอ ตามกฎดังนี้:
1. ให้ครอบด้วยบล็อกโค้ด (` ```text `) เพื่อให้ผู้ใช้กด Copy ได้ทันที
2. **ห้ามใส่คำสั่ง Git ใด ๆ** เช่น `git commit -m` หรือ `git add` ให้ส่ง **เฉพาะข้อความ Commit Message ล้วน ๆ** เท่านั้น
3. สรุปใจความสำคัญเป็นภาษาไทยอย่างกระชับและเข้าใจง่าย
