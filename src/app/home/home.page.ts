import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { IpsuService } from '../services/ipsu.service';
import { LoginPage } from '../login/login.page';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';
import { register } from 'swiper/element/bundle';

register();

export interface QuickService {
    id: number;
    title_th: string;
    title_en: string;
    iconName: string;
    gradient: string;
    linkType: string;
    link: string;
    sort_order?: number;
}

export interface HotlineItem {
    name: string;
    dept: string;
    tel: string;
    displayTel: string;
    icon: string;
    color: string;
}

@Component({
    selector: 'app-home',
    templateUrl: './home.page.html',
    styleUrls: ['./home.page.scss'],
    standalone: false
})
export class HomePage {
    private inAppBrowser = inject(InAppBrowser);
    isLoading = true;
    isRefreshing = false;
    banner: any[] = [];
    news: any[] = [];
    filteredNews: any[] = [];
    activeCategory: string = 'all';

    // Greeting & Date
    greetingText: string = 'สวัสดี';
    greetingIcon: string = 'sunny-outline';
    currentDateStr: string = '';

    get greetingDisplay(): string {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return this.ipsu.T('home.morning');
        if (hour >= 12 && hour < 18) return this.ipsu.T('home.afternoon');
        return this.ipsu.T('home.evening');
    }

    get currentDateDisplay(): string {
        return new Intl.DateTimeFormat(this.ipsu.language === 'en' ? 'en-GB' : 'th-TH', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: '2-digit',
        }).format(new Date());
    }

    // Quick Services
    isQuickServicesLoading = false;

    get quickServices(): QuickService[] {
        return this.ipsu.quickMenuItems as QuickService[];
    }

    set quickServices(items: QuickService[]) {
        this.ipsu.quickMenuItems = Array.isArray(items) ? items : [];
    }

    private get quickServicesCacheKey(): string {
        return this.ipsu.UserStorageKey('ipsu-quick-menu', 'selected');
    }

    private readonly bannerCacheKey = 'ipsu-home-banner';
    private readonly newsCacheKey = 'ipsu-home-news';
    private readonly publicContentCacheTtl = 15 * 60 * 1000;

    // News Detail Modal
    selectedNews: any = null;
    isNewsModalOpen: boolean = false;

    // Hotline Modal
    isHotlineModalOpen: boolean = false;
    isProfilePhotoOpen: boolean = false;
    hotlineList: HotlineItem[] = [
        {
            name: 'หน่วยพยาบาล ม.อ. ปัตตานี',
            dept: 'กองพัฒนานักศึกษา อาคารกิจการนักศึกษา',
            tel: '073313928,1109',
            displayTel: '073-313928 ต่อ 1109',
            icon: 'medkit-outline',
            color: '#ef4444'
        },
        {
            name: 'งานรักษาความปลอดภัย (รปภ. กลาง)',
            dept: 'ศูนย์ควบคุมและรับแจ้งเหตุฉุกเฉินตลอด 24 ชม.',
            tel: '073313930',
            displayTel: '073-313930',
            icon: 'shield-checkmark-outline',
            color: '#005696'
        },
        {
            name: 'ศูนย์คอมพิวเตอร์ / Helpdesk',
            dept: 'สำนักวิทยบริการ บริการบัญชี PSU Passport & Wi-Fi',
            tel: '073313928,2115',
            displayTel: '073-313928 ต่อ 2115',
            icon: 'hardware-chip-outline',
            color: '#0284c7'
        },
        {
            name: 'งานบริการยานพาหนะและการเดินทาง',
            dept: 'ประสานงานรถยนต์ส่วนกลางและกรณีฉุกเฉิน',
            tel: '073313928,1105',
            displayTel: '073-313928 ต่อ 1105',
            icon: 'bus-outline',
            color: '#f59e0b'
        },
        {
            name: 'โรงพยาบาลปัตตานี (ฉุกเฉิน)',
            dept: 'โรงพยาบาลศูนย์ประจำจังหวัดปัตตานี',
            tel: '073348500',
            displayTel: '073-348500',
            icon: 'heart-half-outline',
            color: '#e11d48'
        },
        {
            name: 'สถานีดับเพลิงเมืองปัตตานี',
            dept: 'ศูนย์ดับเพลิงและกู้ภัย',
            tel: '199',
            displayTel: '199',
            icon: 'flame-outline',
            color: '#ea580c'
        }
    ];

    constructor(
        public ipsu: IpsuService,
        private router: Router,
        private modalCtrl: ModalController,
    ) { }

    ionViewWillEnter() {
        this.updateGreeting();
        if (this.ipsu.auth.status) {
            void this.loadQuickServices();
        } else {
            this.quickServices = [];
            this.isQuickServicesLoading = false;
        }
        void this.ipsu.RefreshUnreadMessageCount(false);
        this.LoadData(this.isLoading);
        this.isLoading = false;
    }

    updateGreeting() {
        const now = new Date();
        const hour = now.getHours();
        if (hour >= 5 && hour < 12) {
            this.greetingText = 'สวัสดีตอนเช้า';
            this.greetingIcon = 'sunny-outline';
        } else if (hour >= 12 && hour < 18) {
            this.greetingText = 'สวัสดีตอนบ่าย';
            this.greetingIcon = 'partly-sunny-outline';
        } else {
            this.greetingText = 'สวัสดีตอนค่ำ';
            this.greetingIcon = 'moon-outline';
        }

        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = [
            'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
            'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ];
        const dayName = days[now.getDay()];
        const dateNum = now.getDate();
        const monthName = months[now.getMonth()];
        const thaiYear = (now.getFullYear() + 543).toString().slice(-2);
        this.currentDateStr = `วัน${dayName}ที่ ${dateNum} ${monthName} ${thaiYear}`;
    }

    openProfilePhoto() {
        if (this.ipsu.auth.status) this.isProfilePhotoOpen = true;
    }

    closeProfilePhoto() {
        this.isProfilePhotoOpen = false;
    }

    async loadQuickServices(): Promise<void> {
        if (!this.ipsu.auth.status) {
            this.quickServices = [];
            this.isQuickServicesLoading = false;
            return;
        }

        this.isQuickServicesLoading = true;
        const cached = await this.ipsu.GetStorage(this.quickServicesCacheKey);
        if (Array.isArray(cached)) {
            this.quickServices = cached.slice(0, 8);
        }

        try {
            const response: any = await this.ipsu.Ajax(this.ipsu.api + 'information-quick-menu.php', {
                action: 'get',
                psu_id: this.ipsu.auth.psu_id,
                group: this.ipsu.auth.group || this.ipsu.auth.type,
            }, false);

            if (response?.status === 'ok' && Array.isArray(response.items)) {
                this.quickServices = response.items.slice(0, 8);
                await this.ipsu.SetStorage(this.quickServicesCacheKey, this.quickServices);
            }
        } catch (e) {
            // ใช้ข้อมูล Cache ต่อเมื่อออฟไลน์หรือ API ไม่พร้อมใช้งาน
        } finally {
            this.isQuickServicesLoading = false;
        }
    }

    async LoadData(loading = false, forceRefresh = false) {
        try {
            await Promise.all([
                this.fetchBanner(loading, forceRefresh),
                this.fetchNews(loading, forceRefresh)
            ]);
        } catch (e) {
            // ignore
        }
    }

    async fetchBanner(loading = false, forceRefresh = false): Promise<void> {
        const cached: any = await this.ipsu.GetStorage(this.bannerCacheKey);
        if (Array.isArray(cached?.data) && cached.data.length > 0) {
            this.banner = cached.data;
            if (!forceRefresh && (Date.now() - Number(cached.updatedAt || 0)) < this.publicContentCacheTtl) {
                return;
            }
        }

        try {
            const res: any = await this.ipsu.Ajax(this.ipsu.api + 'content-banner.php', {}, loading);
            if (Array.isArray(res?.data) && res.data.length > 0) {
                this.banner = res.data;
                await this.ipsu.SetStorage(this.bannerCacheKey, {
                    data: this.banner,
                    updatedAt: Date.now(),
                });
                return;
            }
        } catch (e) {
            // ใช้ข้อมูลจาก cache หรือ fallback ต่อเมื่อ API ไม่พร้อมใช้งาน
        }

        if (!this.banner || this.banner.length === 0) {
            this.banner = [{
                image: 'assets/imgs/splash.png',
                title: 'มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตปัตตานี'
            }];
        }
    }

    async fetchNews(loading = false, forceRefresh = false): Promise<void> {
        const cached: any = await this.ipsu.GetStorage(this.newsCacheKey);
        if (Array.isArray(cached?.data)) {
            this.news = cached.data;
            this.setCategory(this.activeCategory);
            if (!forceRefresh && (Date.now() - Number(cached.updatedAt || 0)) < this.publicContentCacheTtl) {
                return;
            }
        }

        try {
            const res: any = await this.ipsu.Ajax(this.ipsu.api + 'content-news.php', {}, loading);
            if (Array.isArray(res?.data)) {
                this.news = res.data;
                await this.ipsu.SetStorage(this.newsCacheKey, {
                    data: this.news,
                    updatedAt: Date.now(),
                });
            }
        } catch (e) {
            if (!Array.isArray(cached?.data)) {
                this.news = [];
            }
        }
        this.setCategory(this.activeCategory);
    }

    handleRefresh(event: any) {
        this.updateGreeting();
        Promise.all([
            this.fetchBanner(false, true),
            this.fetchNews(false, true),
            this.ipsu.auth.status ? this.loadQuickServices() : Promise.resolve()
        ]).finally(() => {
            event.target.complete();
        });
    }

    setCategory(cat: string) {
        this.activeCategory = cat;
        if (!this.news || this.news.length === 0) {
            this.filteredNews = [];
            return;
        }

        if (cat === 'all') {
            this.filteredNews = this.news;
        } else if (cat === 'event') {
            this.filteredNews = this.news.filter((item: any) => {
                const title = (item.title || '').toLowerCase();
                return title.includes('กิจกรรม') || title.includes('อบรม') || title.includes('สัมมนา') || title.includes('เสวนา') || title.includes('ประกวด');
            });
        } else if (cat === 'scholarship') {
            this.filteredNews = this.news.filter((item: any) => {
                const title = (item.title || '').toLowerCase();
                return title.includes('ทุน') || title.includes('กู้ยืม') || title.includes('กยศ') || title.includes('เงินกู้');
            });
        } else if (cat === 'general') {
            this.filteredNews = this.news.filter((item: any) => {
                const title = (item.title || '').toLowerCase();
                return !title.includes('กิจกรรม') && !title.includes('ทุน') && !title.includes('กยศ');
            });
        }
    }

    getCategoryBadge(item: any): { label: string; class: string } {
        const title = (item?.title || '').toLowerCase();
        if (title.includes('ทุน') || title.includes('กู้ยืม') || title.includes('กยศ')) {
            return { label: this.ipsu.T('home.scholarships'), class: 'badge-scholarship' };
        }
        if (title.includes('กิจกรรม') || title.includes('อบรม') || title.includes('สัมมนา')) {
            return { label: this.ipsu.T('home.activities'), class: 'badge-event' };
        }
        return { label: this.ipsu.T('home.general'), class: 'badge-general' };
    }

    // Quick Actions
    openQuickMenu() {
        this.router.navigate(['/quick-menu']);
    }

    openQuickService(item: QuickService) {
        if (!item) return;

        if (item.linkType === 'none' || !item.link) {
            this.ipsu.ShowToast(this.ipsu.T('information.not_available'), 1800);
            return;
        }

        if (item.linkType === 'route' || item.link.startsWith('/')) {
            this.router.navigate([item.link]);
            return;
        }

        if (item.linkType === 'iframe') {
            this.ipsu.LinkToWithParam('information-webview', {
                menu: JSON.stringify(item)
            });
            return;
        }

        if (item.linkType === 'link') {
            try {
                if (this.ipsu.GetPlatform() !== 'browser') {
                    this.inAppBrowser.create(item.link, '_system');
                } else {
                    window.open(item.link, '_blank', 'noopener');
                }
            } catch (e) {
                window.open(item.link, '_blank', 'noopener');
            }
        }
    }

    async openDigitalPass() {
        if (this.ipsu.auth.status) {
            this.router.navigate(['/tabs/profile']);
        } else {
            const rs = await this.ipsu.ShowConfirm(
                this.ipsu.T('home.digital_login_required'),
                this.ipsu.T('login.title'),
                this.ipsu.T('login.sign_in'),
                this.ipsu.T('common.cancel'),
                false
            );
            if (rs) {
                this.openLogin();
            }
        }
    }

    async openInformation(targetSection?: string) {
        if (this.ipsu.auth.status) {
            this.router.navigate(['/tabs/information']);
        } else {
            const rs = await this.ipsu.ShowConfirm(
                this.ipsu.T('home.info_login_required'),
                this.ipsu.T('login.title'),
                this.ipsu.T('login.sign_in'),
                this.ipsu.T('common.cancel'),
                false
            );
            if (rs) {
                this.openLogin();
            }
        }
    }

    openMessages() {
        this.router.navigate(['/tabs/message']);
    }

    openAbout() {
        this.router.navigate(['/about']);
    }

    openHotline() {
        this.isHotlineModalOpen = true;
    }

    closeHotline() {
        this.isHotlineModalOpen = false;
    }

    openExternal(url: string) {
        window.open(url, '_blank');
    }

    async openLogin() {
        this.ipsu.SetStorage('ipsu-callback', '/tabs/home');
        const modal = await this.modalCtrl.create({
            component: LoginPage
        });
        modal.onWillDismiss().then(() => {
            this.updateGreeting();
            this.LoadData(false);
            if (this.ipsu.auth.status) {
                void this.loadQuickServices();
            }
        });
        return await modal.present();
    }

    // News reader modal
    openNewsDetail(item: any) {
        this.selectedNews = item;
        this.isNewsModalOpen = true;
    }

    closeNewsDetail() {
        this.isNewsModalOpen = false;
        this.selectedNews = null;
    }

    onBannerClick(item: any) {
        if (item.url) {
            this.openExternal(item.url);
        } else if (item.link) {
            this.openExternal(item.link);
        } else if (item.title) {
            this.openNewsDetail({
                title: item.title,
                date: this.currentDateDisplay,
                user: 'งานประชาสัมพันธ์ ม.อ. ปัตตานี',
                detail: item.detail || 'ประชาสัมพันธ์ข้อมูลและกิจกรรม มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตปัตตานี'
            });
        }
    }
}
