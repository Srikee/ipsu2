import { Component, NgZone } from '@angular/core';
import { Router, NavigationStart, NavigationEnd } from '@angular/router';
import { ActionSheetController, MenuController, ModalController, Platform } from '@ionic/angular';
import { LoginPage } from './login/login.page';
import { IpsuService } from './services/ipsu.service';
import { PushService } from './services/push.service';
import { LockService } from './services/lock.service';

// ใช้ชื่อปลั๊กอินใหม่เท่านั้น
// ต้องติดตั้ง cordova-plugin-ipsu-deeplink แล้วจึงจะมี object นี้บนเครื่องจริง
// ถ้ารันบน browser จะเป็น undefined ได้
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const IpsuDeeplink: any;

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss'],
    standalone: false,
})
export class AppComponent {

    // -------------------------------------------------------------------------
    // [1] ตัวแปรสถานะหลักของ AppComponent
    // -------------------------------------------------------------------------

    // เก็บ URL ปัจจุบัน ใช้ควบคุม ion-menu ใน app.component.html
    CurrUrl = '';

    // ใช้กัน deeplink URL เดิมซ้ำในเวลาสั้น ๆ
    private lastDeepLinkUrl = '';
    private lastDeepLinkAt = 0;

    // true ระหว่างที่แอปกำลัง bootstrap เช่น InitStorage / โหลด auth / ข้อมูลแอป
    // เหตุผล: ระหว่างนี้ถ้า deeplink กลับมา เราจะ "เก็บไว้ก่อน" แต่ยังไม่รีบ route
    // เพื่อไม่ให้ชนกับการโหลดข้อมูลแอปหรือการเด้งหน้า title/home
    private appBootstrapping = true;

    // เก็บ deeplink ที่เข้ามาระหว่าง bootstrap
    // หลังโหลดข้อมูลแอปเสร็จแล้วค่อยนำไปเปิด callback
    private pendingDeepLinkUrl = '';

    // ใช้บอกว่า startup นี้มี deeplink เข้ามาแล้ว
    // ถ้ามี deeplink ห้ามเด้งไป /title หรือ /tabs/home ทับ
    private deepLinkHandledAtStartup = false;

    // กันไม่ให้ผูก listener ซ้ำ ถ้า InitDeepLinkEarly() ถูกเรียกซ้ำโดยไม่ตั้งใจ
    private deeplinkListenerReady = false;

    constructor(
        private platform: Platform,
        private router: Router,
        private modalCtrl: ModalController,
        private menuCtrl: MenuController,
        private actionSheetCtrl: ActionSheetController,
        private zone: NgZone,
        public ipsu: IpsuService,
        private pushService: PushService,
        public lock: LockService,
    ) {
        // รอ Cordova/Ionic พร้อมก่อน เพราะปลั๊กอิน native จะพร้อมหลัง platform.ready()
        this.platform.ready().then(async () => {
            await this.BootstrapApp();
        });
    }

    ngOnInit() {
        this.TrackRouter();
    }

    // -------------------------------------------------------------------------
    // [2] เริ่มต้นระบบหลักของแอป
    // -------------------------------------------------------------------------

    private async BootstrapApp() {
        // เริ่มสถานะ bootstrap
        this.appBootstrapping = true;

        // 1) เปิดใช้งาน Ionic Storage ก่อนอ่าน/เขียนข้อมูล
        await this.ipsu.InitStorage();

        // 2) โหลด auth จาก storage ก่อน เพื่อให้รู้ username/status ล่าสุด
        await this.LoadAuthFromStorage();

        // ล็อกหน้าจอทันทีถ้าผู้ใช้เปิดการล็อกไว้ แอปยังโหลดข้อมูลต่อด้านหลังหน้าล็อก
        await this.lock.Init();

        // โหลดภาษาในเครื่องก่อน แล้วจึงซิงก์ค่าของผู้ใช้จาก MySQL
        await this.ipsu.LoadUserPreferences(true);

        // 2.1) เริ่มระบบ push แจ้งเตือน (ขอ permission + token + ผูก listener)
        //      วางไว้หลังโหลด auth เพราะถ้า login ค้างอยู่แล้วจะได้ผูก token กับ username ได้เลย
        //      ไม่ await เพราะไม่อยากให้ permission dialog ของ push บล็อกการเปิดแอป
        this.pushService.InitPush();

        // โหลดจำนวนข้อความที่ยังไม่ได้อ่านไว้ใช้กับ badge ทุกจุดของแอป
        void this.ipsu.RefreshUnreadMessageCount(true);

        // 3) สำคัญมาก: ผูก Deeplink listener ให้เร็วที่สุด
        // ผูก listener ก่อนรอ API เพราะบน iOS เครื่องจริง deeplink อาจกลับมาตั้งแต่ช่วงเปิดแอป
        await this.InitDeepLinkEarly();

        // 4) โหลดข้อมูลแอปจาก cache ก่อน แล้วอัปเดตจาก app-info.php
        //    แต่ตอนนี้ปลอดภัยขึ้น เพราะ listener ถูกผูกไว้แล้ว
        //    ถ้า deeplink เข้ามาระหว่างรอ API เราจะเก็บไว้ใน pendingDeepLinkUrl ก่อน
        await this.LoadAppInfoSafely();

        // 5) จบช่วง bootstrap แล้ว ต่อจากนี้ถ้ามี deeplink ใหม่เข้ามา ให้ route ได้ทันที
        this.appBootstrapping = false;

        // 6) ถ้าระหว่าง bootstrap มี deeplink ค้างอยู่ ให้จัดการก่อนทุกอย่าง
        //    ห้ามเด้ง /title หรือ /tabs/home ทับ callback
        if (this.pendingDeepLinkUrl) {
            const url = this.pendingDeepLinkUrl;
            this.pendingDeepLinkUrl = '';
            await this.HandleDeepLink(url);
            return;
        }

        // 7) ถ้า deeplink ถูกจัดการไปแล้ว ก็ไม่ต้องเปิด Home/Title ทับ
        if (this.deepLinkHandledAtStartup) {
            return;
        }

        // 8) ถ้ายังไม่เคยผ่านหน้าไตเติล ให้ไปหน้า title
        //    จุดนี้ย้ายมาไว้หลัง InitDeepLinkEarly() แล้ว จึงไม่ทำให้ listener หายเหมือนเดิม
        const isTitle = await this.ipsu.GetStorage('ipsu-title');
        if (!isTitle) {
            this.ipsu.LinkTo('/title', false);
            return;
        }

        // 9) ถ้าเปิดแอปปกติ ไม่มี deeplink และผ่าน title แล้ว ค่อยเปิด Home
        await this.OpenHomeIfStillAtRoot();
    }

    private async LoadAuthFromStorage() {
        const auth = await this.ipsu.GetStorage('ipsu-auth');

        // ถ้ามีข้อมูล auth ที่เคยบันทึกไว้ ให้ใช้ข้อมูลนั้น
        if (auth) {
            this.ipsu.auth = auth;
            return;
        }

        // ถ้าไม่มี ให้คงค่า default เดิมของ service ไว้
        this.ipsu.auth = JSON.parse(JSON.stringify(this.ipsu.auth));
    }

    private async LoadAppInfoSafely() {
        const cacheKey = 'ipsu-app-info';
        const cached = await this.ipsu.GetStorage(cacheKey);
        if (cached && typeof cached === 'object') {
            this.ipsu.app = cached;
        }

        try {
            const res: any = await this.ipsu.Ajax(this.ipsu.api + 'app-info.php', {}, false);

            if (res?.status === 'ok' && res?.data?.app) {
                this.ipsu.app = res.data.app;
                await Promise.all([
                    this.ipsu.SetStorage(cacheKey, res.data.app),
                    this.ipsu.SetStorage('ipsu-app-info-updated-at', Date.now()),
                ]);
            }
        } catch (err) {
            // ใช้ข้อมูลจาก cache ต่อ และห้ามให้ API ขัดขวางการเปิดแอป
            console.error('[IPSU-APP] app-info.php error:', err);
        }
    }

    // -------------------------------------------------------------------------
    // [3] ติดตาม Router เพื่อรู้ว่าแอปอยู่หน้าไหน
    // -------------------------------------------------------------------------

    private TrackRouter() {
        this.router.events.subscribe((event) => {
            if (event instanceof NavigationStart) {
                this.CurrUrl = event.url;
            }

            if (event instanceof NavigationEnd) {
                // ถ้าต้อง debug route ให้เปิดบรรทัดนี้
                // console.log('[ROUTER-END]', event.urlAfterRedirects);
            }
        });
    }

    // -------------------------------------------------------------------------
    // [4] ระบบ Deeplink
    // -------------------------------------------------------------------------

    private async InitDeepLinkEarly() {
        // ถ้าไม่มีปลั๊กอิน เช่น รันบน browser ให้ข้ามไป
        // Browser ไม่ต้องใช้ native deeplink listener
        if (typeof IpsuDeeplink === 'undefined') {
            return;
        }

        // กันผูก listener ซ้ำ
        if (!this.deeplinkListenerReady) {
            this.deeplinkListenerReady = true;

            // 4.1 ผูก listener ก่อนเสมอ
            // callback จาก Cordova อาจมานอก Angular Zone จึงต้องครอบด้วย zone.run()
            IpsuDeeplink.onOpenUrl((url: string) => {
                this.zone.run(async () => {
                    await this.ReceiveDeepLink(url);
                });
            });
        }

        // 4.2 รองรับกรณีเปิดแอปจากปิดสนิทด้วย deeplink
        // อ่านมาเก็บไว้ก่อน ถ้ายัง bootstrap อยู่จะยังไม่ route ทันที
        try {
            const url = await IpsuDeeplink.getInitialUrlPromise();

            if (url) {
                await this.ReceiveDeepLink(url);
                IpsuDeeplink.clearInitialUrl();
            }
        } catch (err) {
            console.error('[IPSU-DEEPLINK] getInitialUrlPromise error:', err);
        }
    }

    private async ReceiveDeepLink(url: string) {
        if (!url) {
            return;
        }

        // ถ้า deeplink เข้ามาแล้ว ให้จำไว้ว่า startup นี้มี deeplink
        this.deepLinkHandledAtStartup = true;

        // ถ้าแอปยัง bootstrap อยู่ เช่น ยังรอข้อมูลแอป
        // ให้เก็บ URL ไว้ก่อน แล้วให้ BootstrapApp() จัดการหลังโหลดข้อมูลแอปเสร็จ
        if (this.appBootstrapping) {
            this.pendingDeepLinkUrl = url;
            return;
        }

        // ถ้า bootstrap จบแล้ว ให้เปิด deeplink ทันที
        await this.HandleDeepLink(url);
    }

    private async HandleDeepLink(url: string) {
        // กัน URL ซ้ำภายใน 1.5 วินาที
        const now = Date.now();
        if (url === this.lastDeepLinkUrl && (now - this.lastDeepLinkAt) < 1500) {
            return;
        }

        this.lastDeepLinkUrl = url;
        this.lastDeepLinkAt = now;

        // ถ้ากลับมาจาก PSU Passport แล้ว login modal ยังเปิดค้างอยู่
        // ให้ปิดก่อน เพื่อไม่ให้ modal บังหน้า callback/home
        await this.CloseAnyOpenModalSafely();

        const target = this.ExtractRouteFromDeepLink(url);
        if (!target) {
            await this.ipsu.ShowAlert('Deep link ไม่ถูกต้อง: ' + url);
            return;
        }

        // ใช้ Router โดยตรง และทำใน Angular Zone แล้วจาก InitDeepLinkEarly()/ReceiveDeepLink()
        await this.router.navigateByUrl(target, { replaceUrl: true });
    }

    private ExtractRouteFromDeepLink(url: string): string {
        try {
            const u = new URL(url);

            // custom scheme เช่น ipsu://callback?code=123
            // protocol = ipsu:
            // hostname = callback
            // pathname = ''
            if (u.protocol !== 'http:' && u.protocol !== 'https:') {
                const hostPart = u.hostname || '';
                const pathPart = u.pathname || '';
                const queryPart = u.search || '';
                const route = '/' + (hostPart + pathPart).replace(/^\/+/, '');
                return route + queryPart;
            }

            // universal/app link เช่น https://domain/callback?code=123
            return (u.pathname || '/') + (u.search || '');
        } catch (e) {
            // fallback สำหรับ URL รูปแบบเก่า
            const cleaned = url
                .replace(/^\w+:\/\//, '/')
                .replace(/^\w+:\//, '/');

            return cleaned.startsWith('/') ? cleaned : '/' + cleaned;
        }
    }

    private async CloseAnyOpenModalSafely() {
        try {
            const top = await this.modalCtrl.getTop();
            if (top) {
                await this.modalCtrl.dismiss();
            }
        } catch (e) {
            // ไม่มี modal หรือปิดไม่ได้ก็ไม่ต้องให้ระบบล่ม
        }
    }

    // -------------------------------------------------------------------------
    // [5] เปิด Home เฉพาะกรณีเปิดแอปปกติ ไม่ได้มาจาก deeplink
    // -------------------------------------------------------------------------

    private async OpenHomeIfStillAtRoot() {
        setTimeout(() => {
            const current = this.router.url || '';

            // เปิด Home เฉพาะตอนยังอยู่หน้าต้นทางจริง ๆ
            // ถ้า deeplink พาไป /callback แล้ว จะไม่เข้าเงื่อนไขนี้
            if (current === '/' || current === '' || current === '/loading') {
                this.ipsu.LinkTo('/tabs/home', false);
            }
        }, 150);
    }

    // -------------------------------------------------------------------------
    // [6] Login / Logout
    // -------------------------------------------------------------------------

    async Login() {
        // Close the side menu before presenting an overlay. Closing it while a
        // modal is active is unreliable because both components manage overlays.
        await this.menuCtrl.close('menu');

        const modal = await this.modalCtrl.create({
            component: LoginPage,
            componentProps: {
                showRegister: true,
            },
        });

        await modal.present();
        return await modal.onDidDismiss();
    }

    async Logout() {
        // ฟังก์ชันนี้เหมือนใน profile.page.ts
        const rs: any = await this.ipsu.ShowConfirm(
            this.ipsu.T('logout.confirm'),
            this.ipsu.T('logout.title'),
            this.ipsu.T('menu.logout'),
            this.ipsu.T('common.cancel'),
            true
        );
        if (rs) {
            // ปลด mapping เครื่องนี้ออกจาก username เดิมใน OneSignal
            this.pushService.Logout();
            this.ipsu.unreadMessageCount = 0;
            this.ipsu.auth = {
                status: false,
                psu_id: '',
                username: '',
                type: '',           // staff, student
                group: '',
                fullname_th: '',
                fullname_en: '',
                image: '',
            };
            await this.ipsu.ClearStorage();
            await this.menuCtrl.close('menu');      // ปิดเมนูด้านข้าง
            await this.ipsu.LinkTo('/title', false);
        }
    }

    async openProfile() {
        await this.menuCtrl.close('menu');
        if (this.ipsu.auth.status) {
            this.router.navigate(['/tabs/profile']);
        } else {
            this.Login();
        }
    }

    async navigateTo(path: string) {
        await this.menuCtrl.close('menu');
        this.router.navigate([path]);
    }

    async ChooseLanguage() {
        const actionSheet = await this.actionSheetCtrl.create({
            header: this.ipsu.T('language.title'),
            mode: 'ios',
            buttons: [
                {
                    text: this.ipsu.T('language.th'),
                    icon: this.ipsu.language === 'th' ? 'checkmark-circle' : 'language-outline',
                    handler: () => this.ChangeLanguage('th'),
                },
                {
                    text: this.ipsu.T('language.en'),
                    icon: this.ipsu.language === 'en' ? 'checkmark-circle' : 'language-outline',
                    handler: () => this.ChangeLanguage('en'),
                },
                {
                    text: this.ipsu.T('common.cancel'),
                    icon: 'close-outline',
                    role: 'cancel',
                }
            ]
        });
        await actionSheet.present();
    }

    private async ChangeLanguage(language: 'th' | 'en') {
        await this.ipsu.SetLanguage(language);
        await this.ipsu.ShowToast(this.ipsu.T('language.changed'));
    }

    async ChooseTheme() {
        const actionSheet = await this.actionSheetCtrl.create({
            header: this.ipsu.T('theme.title'),
            mode: 'ios',
            buttons: [
                {
                    text: this.ipsu.T('theme.system'),
                    icon: this.ipsu.theme === 'system' ? 'checkmark-circle' : 'phone-portrait-outline',
                    handler: () => this.ChangeTheme('system'),
                },
                {
                    text: this.ipsu.T('theme.light'),
                    icon: this.ipsu.theme === 'light' ? 'checkmark-circle' : 'sunny-outline',
                    handler: () => this.ChangeTheme('light'),
                },
                {
                    text: this.ipsu.T('theme.dark'),
                    icon: this.ipsu.theme === 'dark' ? 'checkmark-circle' : 'moon-outline',
                    handler: () => this.ChangeTheme('dark'),
                },
                {
                    text: this.ipsu.T('common.cancel'),
                    icon: 'close-outline',
                    role: 'cancel',
                }
            ]
        });
        await actionSheet.present();
    }

    private async ChangeTheme(theme: 'system' | 'light' | 'dark') {
        await this.ipsu.SetTheme(theme);
        await this.ipsu.ShowToast(this.ipsu.T('theme.changed'));
    }

    async openExternal(url: string) {
        await this.menuCtrl.close('menu');
        window.open(url, '_blank');
    }
}
