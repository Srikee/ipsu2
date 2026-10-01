import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute, NavigationExtras, Router, UrlTree } from '@angular/router';
import { LoadingController, AlertController, ToastController, NavController, MenuController } from '@ionic/angular';
import { timeout } from 'rxjs';
import { Storage } from '@ionic/storage-angular';
import { Platform } from '@ionic/angular';
import { APP_TRANSLATIONS, AppLanguage } from './translations';
import { AppTheme, ThemeService } from './theme.service';

@Injectable({
    providedIn: 'root'
})
export class IpsuService {
    // public api: string = "http://localhost/ipsu2-api/";
    public api: string = "https://intranet2.pn.psu.ac.th/ipsu/api-app/";
    private apiTimeout: number = 15000;
    public app: any = {};
    public language: AppLanguage = 'th';
    public theme: AppTheme = 'system';
    public get isDarkTheme(): boolean {
        return this.themeService.resolvedTheme === 'dark';
    }
    public unreadMessageCount = 0;
    public isMessageSelectionMode = false;
    public quickMenuItems: any[] = [];
    public auth: any = {
        status: false,
        psu_id: '',
        username: '',
        group: '',           // staff, student
        fullname_th: '',
        fullname_en: '',
        image: '',
    };
    constructor(
        private http: HttpClient,
        private loadingCtrl: LoadingController,
        private alertCtrl: AlertController,
        private toastController: ToastController,
        private router: Router,
        private route: ActivatedRoute,
        private nav: NavController,
        private storage: Storage,
        private platform: Platform,
        private themeService: ThemeService,
    ) {

    }
    public async Ajax(url: any, data: any, isloading: boolean, isJson = true) {
        let loading: any;
        const requestData = data && typeof data === 'object' && !Array.isArray(data)
            ? { ...data, language: data.language || this.language }
            : data;
        if (isloading == true) {
            loading = await this.loadingCtrl.create({
                // message: this.translate.instant("ALL.processing"),
                message: this.T('common.processing')
            });
            await loading.present();
        }
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                this.http.post(url, JSON.stringify(requestData), { responseType: 'text' })
                    .pipe(
                        timeout(this.apiTimeout)
                    )
                    .subscribe((response: any) => {
                        if (isloading == true) { loading.dismiss(); }
                        if (isJson) {
                            try {
                                var rs = JSON.parse(response);
                                resolve(rs);
                            } catch (e) {
                                reject(response);
                            }
                        } else {
                            resolve(response);
                        }
                    }, (error: any) => {
                        if (isloading == true) { loading.dismiss(); }
                        // reject(this.translate.instant("ALL.nonetwork"));
                        reject(this.T('common.server_unavailable'));
                    });
            }, 0);
        });
    }
    public ShowAlert(message: any, header: string = this.T('common.alert'), okText: string = this.T('common.ok')) {
        let msg: any = message;
        if (typeof message === 'object') msg = JSON.stringify(message);
        if (typeof message === 'string') msg = message;
        return new Promise(async resolve => {
            const alert = await this.alertCtrl.create({
                header: header,
                message: msg,
                backdropDismiss: false,
                cssClass: 'modern-confirm-alert single-button-alert',
                mode: 'ios',
                buttons: [
                    {
                        text: okText,
                        cssClass: 'alert-btn-confirm',
                        handler: () => {
                            resolve(true);
                        }
                    },
                ]
            });
            await alert.present();
        });
    }
    public ShowConfirm(
        message: any,
        header: string = this.language === 'en' ? 'Confirm action' : 'ยืนยันการทำรายการ',
        confirmText: string = this.T('common.ok'),
        cancelText: string = this.T('common.cancel'),
        isDanger: boolean = false
    ) {
        let msg: any = message;
        let title: string = header;
        let okBtnText: string = confirmText;
        let cancelBtnText: string = cancelText;
        let danger: boolean = isDanger;

        if (typeof message === 'object' && message !== null) {
            if ('message' in message) msg = message.message;
            if ('header' in message) title = message.header;
            if ('confirmText' in message) okBtnText = message.confirmText;
            if ('cancelText' in message) cancelBtnText = message.cancelText;
            if ('isDanger' in message) danger = !!message.isDanger;
            if (!('message' in message)) msg = JSON.stringify(message);
        } else if (typeof message === 'string') {
            msg = message;
        }

        // Auto-detect logout, delete, or login keywords
        if (!danger && typeof msg === 'string') {
            if (msg.includes('ออกจากระบบ') || msg.includes('ลบ') || msg.toLowerCase().includes('sign out') || msg.toLowerCase().includes('delete')) {
                danger = true;
                if (title === 'ยืนยันการทำรายการ' || title === 'คำยืนยัน ?') {
                    title = 'ออกจากระบบ';
                }
                if (okBtnText === 'ตกลง') {
                    okBtnText = 'ออกจากระบบ';
                }
            } else if (msg.includes('เข้าสู่ระบบ') || msg.toLowerCase().includes('sign in')) {
                if (title === 'ยืนยันการทำรายการ' || title === 'คำยืนยัน ?') {
                    title = 'เข้าสู่ระบบ';
                }
                if (okBtnText === 'ตกลง') {
                    okBtnText = 'เข้าสู่ระบบ';
                }
            }
        }

        const alertClass = danger ? 'modern-confirm-alert danger-alert' : 'modern-confirm-alert';

        return new Promise(async resolve => {
            let alert = await this.alertCtrl.create({
                header: title,
                message: msg,
                backdropDismiss: false,
                cssClass: alertClass,
                mode: 'ios',
                buttons: [
                    {
                        text: cancelBtnText,
                        role: 'cancel',
                        cssClass: 'alert-btn-cancel',
                        handler: () => {
                            resolve(false);
                        }
                    },
                    {
                        text: okBtnText,
                        cssClass: danger ? 'alert-btn-confirm alert-btn-danger' : 'alert-btn-confirm',
                        handler: () => {
                            resolve(true);
                        }
                    }
                ]
            });
            await alert.present();
        });
    }
    public async ShowToast(message: any, duration = 2000) {
        const toast = await this.toastController.create({
            color: 'dark',
            message: message,
            duration: duration,
            mode: 'ios',
            buttons: [{
                icon: 'close-outline',
                // text: this.translate.instant("ALL.close"),
                text: "",
                role: 'cancel',
                handler: () => { }
            }]
        });
        toast.present();
    }
    public LinkTo(page: string, type = true) { // type=false ไม่จำ/ true=จำ
        if (type == false) {
            this.router.navigateByUrl(page, { replaceUrl: true }); // ไม่จำประวัติหน้าก่อนหน้า
        } else {
            this.router.navigateByUrl(page);  // จำประวัติหน้าก่อนหน้า
        }
    }
    public LinkToWithParam(page: string, queryParams: any) {
        let navigationExtras: NavigationExtras = {
            queryParams: queryParams
        };
        this.router.navigate([page], navigationExtras);
    }
    public GetUrlParam(feild: string) {
        return new Promise((resolve, reject) => {
            this.route.queryParams.subscribe((params: any) => {
                if (params && params[feild]) {
                    resolve(params[feild]);
                } else {
                    resolve("");
                }
            });
        });
    }
    public Back() { // ฟังก์ชันสำหรับถอยไปยังหน้าก่อนหน้า
        this.nav.pop();
    }
    public async InitStorage() {
        await this.storage.create();
    }
    public SetStorage(key: string, value: any) {
        return this.storage.set(key, value);
    }
    public GetStorage(key: string) {
        return this.storage.get(key);
    }
    public RemoveStorage(key: string) {
        return this.storage.remove(key);
    }

    public UserStorageKey(namespace: string, suffix = '', psuId = ''): string {
        const rawUserId = String(psuId || this.auth.psu_id || this.auth.username || '').trim();
        const safeUserId = rawUserId.replace(/[^a-zA-Z0-9._-]/g, '_') || 'guest';
        const baseKey = `${namespace}:${safeUserId}`;
        return suffix ? `${baseKey}:${suffix}` : baseKey;
    }

    public T(key: string, params: Record<string, string | number> = {}): string {
        const selected = APP_TRANSLATIONS[this.language]?.[key];
        const fallback = APP_TRANSLATIONS.th[key] || key;
        let text = selected || fallback;

        for (const [name, value] of Object.entries(params)) {
            text = text.replace(new RegExp(`{{\\s*${name}\\s*}}`, 'g'), String(value));
        }
        return text;
    }

    public Localized(source: any, field: string): string {
        if (!source) return '';
        if (this.language === 'en') {
            return String(source[`${field}_en`] || source[field] || source[`${field}_th`] || '');
        }
        return String(source[`${field}_th`] || source[field] || source[`${field}_en`] || '');
    }

    private isSupportedLanguage(value: any): value is AppLanguage {
        return value === 'th' || value === 'en';
    }

    private applyLanguage(language: AppLanguage) {
        this.language = language;
        if (typeof document !== 'undefined') {
            document.documentElement.lang = language;
        }
    }

    public async LoadLanguagePreference(syncRemote = false): Promise<AppLanguage> {
        const valueKey = this.UserStorageKey('ipsu-language', 'value');
        const localLanguage = await this.GetStorage(valueKey);
        if (this.isSupportedLanguage(localLanguage)) {
            this.applyLanguage(localLanguage);
        }

        if (syncRemote && this.auth.status) {
            await this.SyncLanguagePreference();
        }
        return this.language;
    }

    public async LoadUserPreferences(syncRemote = false): Promise<void> {
        await this.LoadLanguagePreference(false);
        await this.LoadThemePreference(false);

        if (syncRemote && this.auth.status) {
            await this.SyncUserPreferences();
        }
    }

    public async SyncUserPreferences(): Promise<void> {
        if (!this.auth.status || !this.auth.psu_id) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

        const languageValueKey = this.UserStorageKey('ipsu-language', 'value');
        const languagePendingKey = this.UserStorageKey('ipsu-language', 'pending');
        const themeValueKey = this.UserStorageKey('ipsu-theme', 'value');
        const themePendingKey = this.UserStorageKey('ipsu-theme', 'pending');
        const [languagePending, themePending] = await Promise.all([
            this.GetStorage(languagePendingKey),
            this.GetStorage(themePendingKey),
        ]);

        try {
            if (languagePending || themePending) {
                const saved: any = await this.Ajax(this.api + 'user-setting.php', {
                    action: 'save',
                    psu_id: this.auth.psu_id,
                    language: this.language,
                    theme: this.theme,
                }, false);

                if (saved?.status === 'ok') {
                    await Promise.all([
                        this.RemoveStorage(languagePendingKey),
                        this.RemoveStorage(themePendingKey),
                        this.SetStorage(languageValueKey, this.language),
                        this.SetStorage(themeValueKey, this.theme),
                    ]);
                }
                return;
            }

            const response: any = await this.Ajax(this.api + 'user-setting.php', {
                action: 'get',
                psu_id: this.auth.psu_id,
            }, false);

            if (response?.status !== 'ok') return;

            const hasLanguage = this.isSupportedLanguage(response.language);
            const hasTheme = this.themeService.isSupportedTheme(response.theme);
            const writes: Promise<any>[] = [];
            if (hasLanguage) {
                this.applyLanguage(response.language);
                writes.push(this.SetStorage(languageValueKey, response.language));
            }
            if (hasTheme) {
                this.applyTheme(response.theme);
                writes.push(this.SetStorage(themeValueKey, response.theme));
            }
            await Promise.all(writes);

            if (!hasLanguage || !hasTheme) {
                const saved: any = await this.Ajax(this.api + 'user-setting.php', {
                    action: 'save',
                    psu_id: this.auth.psu_id,
                    language: this.language,
                    theme: this.theme,
                }, false);
                if (saved?.status === 'ok') {
                    await Promise.all([
                        this.SetStorage(languageValueKey, this.language),
                        this.SetStorage(themeValueKey, this.theme),
                    ]);
                }
            }
        } catch (e) {
            // ใช้ค่าที่เก็บไว้ในเครื่องต่อเมื่อออฟไลน์หรือ API ไม่พร้อมใช้งาน
        }
    }

    public async SetLanguage(language: AppLanguage, syncRemote = true): Promise<void> {
        if (!this.isSupportedLanguage(language)) return;

        this.applyLanguage(language);
        await this.SetStorage(this.UserStorageKey('ipsu-language', 'value'), language);

        if (this.auth.status) {
            await this.SetStorage(this.UserStorageKey('ipsu-language', 'pending'), true);
            if (syncRemote) {
                await this.SyncLanguagePreference();
            }
        }
    }

    public async SyncLanguagePreference(): Promise<void> {
        if (!this.auth.status || !this.auth.psu_id) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

        const valueKey = this.UserStorageKey('ipsu-language', 'value');
        const pendingKey = this.UserStorageKey('ipsu-language', 'pending');
        const pending = await this.GetStorage(pendingKey);

        try {
            if (pending) {
                const saved: any = await this.Ajax(this.api + 'user-setting.php', {
                    action: 'save',
                    psu_id: this.auth.psu_id,
                    language: this.language,
                }, false);
                if (saved?.status === 'ok') {
                    await this.RemoveStorage(pendingKey);
                }
                return;
            }

            const response: any = await this.Ajax(this.api + 'user-setting.php', {
                action: 'get',
                psu_id: this.auth.psu_id,
            }, false);

            if (response?.status === 'ok' && this.isSupportedLanguage(response.language)) {
                this.applyLanguage(response.language);
                await this.SetStorage(valueKey, response.language);
                return;
            }

            const saved: any = await this.Ajax(this.api + 'user-setting.php', {
                action: 'save',
                psu_id: this.auth.psu_id,
                language: this.language,
            }, false);
            if (saved?.status === 'ok') {
                await this.SetStorage(valueKey, this.language);
            }
        } catch (e) {
            // ใช้ค่าภาษาในเครื่องต่อ และลองซิงก์ใหม่เมื่อเปิดแอปครั้งถัดไป
        }
    }

    public async LoadThemePreference(syncRemote = false): Promise<AppTheme> {
        const valueKey = this.UserStorageKey('ipsu-theme', 'value');
        const localTheme = await this.GetStorage(valueKey);
        if (this.themeService.isSupportedTheme(localTheme)) {
            this.applyTheme(localTheme);
        } else {
            this.applyTheme(this.themeService.preference);
        }

        if (syncRemote && this.auth.status) {
            await this.SyncThemePreference();
        }
        return this.theme;
    }

    public async SetTheme(theme: AppTheme, syncRemote = true): Promise<void> {
        if (!this.themeService.isSupportedTheme(theme)) return;

        this.applyTheme(theme);
        await this.SetStorage(this.UserStorageKey('ipsu-theme', 'value'), theme);

        if (this.auth.status) {
            await this.SetStorage(this.UserStorageKey('ipsu-theme', 'pending'), true);
            if (syncRemote) {
                await this.SyncThemePreference();
            }
        }
    }

    public async SyncThemePreference(): Promise<void> {
        if (!this.auth.status || !this.auth.psu_id) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

        const valueKey = this.UserStorageKey('ipsu-theme', 'value');
        const pendingKey = this.UserStorageKey('ipsu-theme', 'pending');
        const pending = await this.GetStorage(pendingKey);

        try {
            if (pending) {
                const saved: any = await this.Ajax(this.api + 'user-setting.php', {
                    action: 'save',
                    psu_id: this.auth.psu_id,
                    theme: this.theme,
                }, false);
                if (saved?.status === 'ok') {
                    await this.RemoveStorage(pendingKey);
                }
                return;
            }

            const response: any = await this.Ajax(this.api + 'user-setting.php', {
                action: 'get',
                psu_id: this.auth.psu_id,
            }, false);

            if (response?.status === 'ok' && this.themeService.isSupportedTheme(response.theme)) {
                this.applyTheme(response.theme);
                await this.SetStorage(valueKey, response.theme);
                return;
            }

            const saved: any = await this.Ajax(this.api + 'user-setting.php', {
                action: 'save',
                psu_id: this.auth.psu_id,
                theme: this.theme,
            }, false);
            if (saved?.status === 'ok') {
                await this.SetStorage(valueKey, this.theme);
            }
        } catch (e) {
            // ใช้ค่าธีมในเครื่องต่อ และลองซิงก์ใหม่เมื่อเปิดแอปครั้งถัดไป
        }
    }

    private applyTheme(theme: AppTheme): void {
        this.theme = theme;
        this.themeService.applyTheme(theme);
    }

    public async ClearStorage() {
        this.quickMenuItems = [];
        try {
            await this.storage.clear();
        } catch (e) {
            console.error('ClearStorage error:', e);
        }
        try {
            if (typeof window !== 'undefined') {
                window.sessionStorage?.clear();
                window.localStorage?.clear();
            }
        } catch (e) { }
        this.applyTheme('system');
    }
    public GetPlatform() {
        var rs = '';
        if (this.platform.is('ios')) {
            rs = 'ios';
        } else if (this.platform.is('android')) {
            rs = 'android';
        } else {
            rs = 'browser';
        }
        return rs;
    }
    public async RefreshUnreadMessageCount(fetchRemote = false): Promise<number> {
        if (!this.auth.status) {
            this.unreadMessageCount = 0;
            return 0;
        }

        const countsKey = `ipsu-message-v2-${this.auth.psu_id}-counts`;
        let counts: any = await this.GetStorage(countsKey);

        if (fetchRemote && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
            try {
                const response: any = await this.Ajax(this.api + 'message-list.php', {
                    psu_id: this.auth.psu_id,
                    message_type: 'task',
                    page: 1,
                    limit: 1,
                    include_counts: true
                }, false);
                if (response?.status === 'ok' && response?.meta?.counts) {
                    counts = response.meta.counts;
                    await this.SetStorage(countsKey, counts);
                }
            } catch (e) {
                // ใช้ยอดจาก Cache ต่อเมื่อโหลดจาก API ไม่สำเร็จ
            }
        }

        this.unreadMessageCount = ['task', 'alert', 'message'].reduce((total, type) => {
            return total + Math.max(0, Number(counts?.[type]) || 0);
        }, 0);

        return this.unreadMessageCount;
    }
    public RandomString(length: number = 32): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}
