import { Injectable, NgZone } from '@angular/core';
import { Platform } from '@ionic/angular';
import OneSignal from 'onesignal-cordova-plugin';
import { IpsuService } from './ipsu.service';

// TODO: เปลี่ยนเป็น OneSignal App ID จริงของคุณ
// ดูได้ที่ OneSignal Dashboard -> Settings -> Keys & IDs
const ONESIGNAL_APP_ID = '129be3c9-587d-45c7-9c66-af979f9a7df0';


@Injectable({
    providedIn: 'root'
})
export class PushService {

    // กันการเรียก initialize ซ้ำถ้า InitPush() ถูกเรียกมากกว่า 1 ครั้ง
    private initialized: boolean = false;

    constructor(
        private ipsu: IpsuService,
        private platform: Platform,
        private zone: NgZone,
    ) { }

    // -------------------------------------------------------------------------
    // [1] เริ่มต้นระบบ push ทั้งหมด เรียกครั้งเดียวตอน bootstrap แอป
    // -------------------------------------------------------------------------
    public async InitPush() {
        // OneSignal SDK ทำงานเฉพาะบนเครื่องจริงที่รันผ่าน Cordova เท่านั้น
        // ถ้ารันบน browser (ionic serve) ให้ข้ามไปเงียบ ๆ ไม่ throw error
        if (!this.isCordovaPluginReady()) {
            console.warn('[PUSH] OneSignal only works on device, skipped on browser');
            return;
        }

        if (this.initialized) return;

        try {
            // เปิด verbose log ไว้ตอน dev เพื่อ debug ง่าย ตอนขึ้น production ควรลบ/comment บรรทัดนี้ทิ้ง
            OneSignal.Debug.setLogLevel(6);

            // เริ่มต้น SDK ด้วย App ID จาก dashboard
            OneSignal.initialize(ONESIGNAL_APP_ID);

            // ผูก listener ก่อนขอ permission เผื่อมีข้อความเข้ามาเร็ว
            this.BindListeners();
            this.initialized = true;

            // ขอ permission แจ้งเตือนจากผู้ใช้ (false = ใช้ native prompt ของระบบตรง ๆ
            // ไม่ผ่าน soft-prompt ของ OneSignal เอง)
            const accepted = await OneSignal.Notifications.requestPermission(false);
            console.log('[PUSH] Notification permission accepted:', accepted);

            // ถ้ามี user login ค้างอยู่แล้วตอนเปิดแอป (เช่นปิดแอปแล้วเปิดใหม่ session ยังไม่หมด)
            // ให้ผูกเครื่องนี้เข้ากับ username ทันที
            if (this.ipsu.auth?.status && this.ipsu.auth?.username) {
                this.Login(this.ipsu.auth.username);
            }
        } catch (err) {
            this.initialized = false;
            // ห้ามให้ push error แล้วทำให้แอปหลักพัง
            console.error('[PUSH] InitPush error:', err);
        }
    }

    // -------------------------------------------------------------------------
    // [2] ผูกเครื่องนี้เข้ากับ username เรียกตอน login สำเร็จ
    //     ตรงนี้คือจุดต่างหลักจาก Firebase: ไม่ต้องส่ง token ไปเก็บที่ backend เอง
    //     OneSignal จะจำ mapping "เครื่องนี้ <-> external_id (username)" ไว้ในระบบของเขาเอง
    //     ตอนจะยิง push ก็แค่ระบุ external_id/username เป้าหมายจากฝั่งเราได้เลย
    // -------------------------------------------------------------------------
    public Login(username: string) {
        if (!username || !this.isCordovaPluginReady()) return;
        try {
            OneSignal.login(username);
        } catch (err) {
            console.error('[PUSH] OneSignal.login error:', err);
        }
    }

    // -------------------------------------------------------------------------
    // [3] เลิกผูกเครื่องนี้จาก username เดิม เรียกตอน logout
    // -------------------------------------------------------------------------
    public Logout() {
        if (!this.isCordovaPluginReady()) return;
        try {
            OneSignal.logout();
        } catch (err) {
            console.error('[PUSH] OneSignal.logout error:', err);
        }
    }

    // -------------------------------------------------------------------------
    // [4] ผูก listener สำหรับข้อความที่เข้ามา (foreground + ตอนผู้ใช้แตะที่ noti)
    // -------------------------------------------------------------------------
    private BindListeners() {
        // ข้อความที่เข้ามาตอนแอปเปิดอยู่ (foreground)
        OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
            this.zone.run(() => {
                const notification = event?.getNotification ? event.getNotification() : event?.notification;
                console.log('[PUSH] Foreground notification:', notification);

                const title = notification?.title || 'แจ้งเตือน';
                const body = notification?.body || '';
                this.ipsu.ShowToast(`${title}: ${body}`, 3000);

                // หมายเหตุ: ไม่ได้เรียก event.preventDefault() จึงปล่อยให้ noti ของระบบขึ้นตามปกติด้วย
                // ถ้าอยากคุมเองแบบ toast อย่างเดียวไม่ให้ noti ระบบขึ้นซ้ำ ให้เรียก event.preventDefault()
            });
        });

        // ผู้ใช้แตะที่ noti (ไม่ว่าแอปจะเปิดอยู่ พื้นหลัง หรือถูกปิดสนิทไปแล้ว)
        OneSignal.Notifications.addEventListener('click', (event: any) => {
            this.zone.run(() => {
                console.log('[PUSH] Notification clicked:', event);

                // ฝั่งที่ยิง push สามารถแนบ additional data เช่น { "route": "/main/announcement" } มาได้
                const route = event?.notification?.additionalData?.route;
                if (route) {
                    this.ipsu.LinkTo(route);
                }
            });
        });
    }

    private isCordovaPluginReady(): boolean {
        if (!this.platform.is('cordova') || typeof window === 'undefined') return false;

        const cordova = (window as any).cordova;
        return !!cordova && typeof cordova.exec === 'function';
    }
}
