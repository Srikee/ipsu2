import { Component, OnInit } from '@angular/core';
import { IpsuService } from '../services/ipsu.service';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';

@Component({
    selector: 'app-about',
    templateUrl: './about.page.html',
    styleUrls: ['./about.page.scss'],
    standalone: false,
})
export class AboutPage implements OnInit {
    appVersion: string = '5.0.0';
    buildNumber: string = '30';
    isCheckingUpdate: boolean = false;
    currentYear: number = new Date().getFullYear();
    supportEmail: string = 'ipsupattani@gmail.com';
    websiteUrl: string = 'http://ipsu.pn.psu.ac.th/';
    appImageUrl: string = 'assets/imgs/icon.png';
    appInfo: any = {};

    private readonly appInfoCacheKey = 'ipsu-app-info';
    private readonly appInfoUpdatedAtKey = 'ipsu-app-info-updated-at';
    private readonly appInfoCacheTtl = 15 * 60 * 1000;

    constructor(
        public ipsu: IpsuService,
        private iab: InAppBrowser
    ) { }

    ngOnInit() {
        this.applyAppInfo(this.ipsu.app);
    }

    ionViewWillEnter() {
        void this.loadAppInfo(false);
    }

    private applyAppInfo(app: any) {
        if (!app || typeof app !== 'object') return;

        this.appInfo = app;
        this.supportEmail = app.email || this.supportEmail;
        this.websiteUrl = app.website || this.websiteUrl;
        this.appImageUrl = app.app_image || this.appImageUrl;

        const platform = this.ipsu.GetPlatform();
        const platformVersion = platform === 'ios'
            ? app.version_ios
            : app.version_android;
        this.appVersion = platformVersion || app.version_ios || app.version_android || this.appVersion;
    }

    private async loadAppInfo(forceRefresh = false) {
        const cached = await this.ipsu.GetStorage(this.appInfoCacheKey);
        this.applyAppInfo(cached);

        const updatedAt = Number(await this.ipsu.GetStorage(this.appInfoUpdatedAtKey)) || 0;
        if (!forceRefresh && cached && (Date.now() - updatedAt) < this.appInfoCacheTtl) {
            return;
        }

        try {
            const response: any = await this.ipsu.Ajax(
                this.ipsu.api + 'app-info.php',
                {},
                false
            );

            if (response?.status === 'ok' && response?.data?.app) {
                this.applyAppInfo(response.data.app);
                this.ipsu.app = { ...this.ipsu.app, ...response.data.app };
                await Promise.all([
                    this.ipsu.SetStorage(this.appInfoCacheKey, response.data.app),
                    this.ipsu.SetStorage(this.appInfoUpdatedAtKey, Date.now()),
                ]);
            }
        } catch (e) {
            // ใช้ข้อมูลเดิมจากหน่วยความจำหรือค่าพื้นฐานเมื่อออฟไลน์
        }
    }

    async checkUpdate() {
        this.isCheckingUpdate = true;
        try {
            await this.loadAppInfo(true);

            setTimeout(() => {
                this.isCheckingUpdate = false;
                this.ipsu.ShowToast(this.ipsu.T('about.up_to_date', { version: this.appVersion }), 2200);
            }, 800);
        } catch (e) {
            setTimeout(() => {
                this.isCheckingUpdate = false;
                this.ipsu.ShowToast(this.ipsu.T('about.up_to_date', { version: this.appVersion }), 2000);
            }, 600);
        }
    }

    useLocalAppIcon() {
        this.appImageUrl = 'assets/imgs/icon.png';
    }

    openUrl(url: string) {
        if (!url) return;
        try {
            if (this.ipsu.GetPlatform() !== 'browser') {
                this.iab.create(url, '_system');
            } else {
                window.open(url, '_blank');
            }
        } catch (e) {
            window.open(url, '_blank');
        }
    }
}
