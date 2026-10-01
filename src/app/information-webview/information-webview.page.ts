import { Component, OnInit, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';
import { IpsuService } from '../services/ipsu.service';

@Component({
    selector: 'app-information-webview',
    templateUrl: './information-webview.page.html',
    styleUrls: ['./information-webview.page.scss'],
    standalone: false,
})
export class InformationWebviewPage implements OnInit, OnDestroy {
    menu: any = null;
    rawUrl: string = '';
    safeUrl: SafeResourceUrl | null = null;
    isLoading: boolean = true;
    hasLoadTimeout: boolean = false;
    private timeoutTimer: any = null;

    constructor(
        public ipsu: IpsuService,
        private sanitizer: DomSanitizer,
        private iab: InAppBrowser
    ) { }

    async ngOnInit() {
        try {
            const menuParam: any = await this.ipsu.GetUrlParam("menu");
            if (menuParam) {
                this.menu = typeof menuParam === 'string' ? JSON.parse(menuParam) : menuParam;
            }
        } catch (e) {
            console.error('Failed to parse menu param', e);
            this.menu = {};
        }

        if (this.menu && this.menu.link) {
            this.rawUrl = this.menu.link;
            this.loadUrl(this.rawUrl);
        } else {
            this.isLoading = false;
        }
    }

    ngOnDestroy() {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }
    }

    loadUrl(url: string) {
        if (!url) return;
        this.isLoading = true;
        this.hasLoadTimeout = false;
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }

        // Fallback timer: If iframe is slow or blocked by X-Frame-Options, stop the spinner and show helper
        this.timeoutTimer = setTimeout(() => {
            if (this.isLoading) {
                this.isLoading = false;
                this.hasLoadTimeout = true;
            }
        }, 8000);
    }

    onIframeLoad() {
        this.isLoading = false;
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }
    }

    reload() {
        if (!this.rawUrl) return;
        this.safeUrl = null;
        this.isLoading = true;
        setTimeout(() => {
            this.loadUrl(this.rawUrl);
        }, 100);
    }

    openInBrowser() {
        if (!this.rawUrl) return;
        try {
            if (this.ipsu.GetPlatform() !== 'browser') {
                this.iab.create(this.rawUrl, '_system');
            } else {
                window.open(this.rawUrl, '_blank');
            }
        } catch (e) {
            window.open(this.rawUrl, '_blank');
        }
    }

    get displayTitle(): string {
        return this.ipsu.Localized(this.menu, 'title');
    }

    get displayHost(): string {
        if (!this.rawUrl) return '';
        try {
            const u = new URL(this.rawUrl);
            return u.hostname;
        } catch (e) {
            return this.rawUrl;
        }
    }
}
