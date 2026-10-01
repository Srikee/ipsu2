import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { IpsuService } from '../services/ipsu.service';
import { LoginPage } from '../login/login.page';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';

@Component({
    selector: 'app-information',
    templateUrl: './information.page.html',
    styleUrls: ['./information.page.scss'],
    standalone: false,
})
export class InformationPage implements OnInit {
    isLoading = false;
    private readonly cachePrefix = 'ipsu-information';

    private get keySectionsStorage(): string {
        return this.ipsu.UserStorageKey(this.cachePrefix, 'sections');
    }

    private get keyTermStorage(): string {
        return this.ipsu.UserStorageKey(this.cachePrefix, 'term');
    }

    sections: any[] = [];
    menus: any[] = [];
    isComingSoon = false;
    isSearchOpen = false;
    searchTerm = '';
    searchResults: any[] = [];

    currentTerm: any = null;
    userGroup = 'student';

    constructor(
        public ipsu: IpsuService,
        private router: Router,
        private modalController: ModalController,
        private inAppBrowser: InAppBrowser,
    ) { }

    ngOnInit() {
        this.initDefaultData();
    }

    ionViewWillEnter() {
        this.PageEnter();
    }

    initDefaultData() {
        this.userGroup = this.ipsu.auth.group || this.ipsu.auth.type || 'student';
        this.isComingSoon = (this.userGroup === 'staff');
        this.sections = [];
        this.currentTerm = null;
        this.updateFlatMenus();
    }

    async PageEnter() {
        if (this.ipsu.auth.status) {
            this.initDefaultData();

            // Restore cached data for fast display
            const cachedSections = await this.ipsu.GetStorage(this.keySectionsStorage);
            if (cachedSections && Array.isArray(cachedSections) && cachedSections.length > 0) {
                this.sections = cachedSections;
            }

            const cachedTerm = await this.ipsu.GetStorage(this.keyTermStorage);
            if (cachedTerm) {
                this.currentTerm = cachedTerm;
            }

            this.updateFlatMenus();
            this.LoadData(this.sections.length === 0);
        } else {
            this.sections = [];
            this.menus = [];
            this.searchResults = [];
            this.ipsu.SetStorage("ipsu-callback", "/tabs/information");
            let rs = await this.ipsu.ShowConfirm(this.ipsu.T('information.login_required'));
            if (rs) {
                const modal = await this.modalController.create({
                    component: LoginPage
                });
                modal.onWillDismiss().then(() => {
                    this.PageEnter();
                });
                return await modal.present();
            } else {
                this.ipsu.LinkTo('/tabs/home');
            }
        }
    }

    LoadData(loading = false, refresher?: any) {
        if (!this.ipsu.auth.status) {
            if (refresher) refresher.target.complete();
            return;
        }
        this.isLoading = loading;
        const group = this.ipsu.auth.group || this.ipsu.auth.type || 'student';

        this.ipsu.Ajax(this.ipsu.api + "information-menu.php", {
            psu_id: this.ipsu.auth.psu_id,
            username: this.ipsu.auth.username,
            group: group,
        }, loading).then((res: any) => {
            this.isLoading = false;
            if (refresher) refresher.target.complete();

            if (res && res.status === 'ok') {
                this.processApiResponse(res);
            }
        }).catch(() => {
            this.isLoading = false;
            if (refresher) refresher.target.complete();
        });
    }

    processApiResponse(res: any) {
        if (!res) return;

        this.userGroup = res.group || this.userGroup;
        this.isComingSoon = res.coming_soon === true || (this.userGroup === 'staff');
        if (res.current_term) {
            this.currentTerm = res.current_term;
        }

        // 1. Sections
        if (res.sections && Array.isArray(res.sections) && res.sections.length > 0) {
            this.sections = res.sections.map((sec: any) => ({
                title_th: sec.title_th || sec.title || '',
                title_en: sec.title_en || sec.title_th || sec.title || '',
                items: (sec.items || []).map((item: any) => this.formatMenuItem(item))
            }));
        } else {
            this.sections = [];
        }

        // 2. Cache
        this.ipsu.SetStorage(this.keySectionsStorage, this.sections);
        if (this.currentTerm) {
            this.ipsu.SetStorage(this.keyTermStorage, this.currentTerm);
        }

        this.updateFlatMenus();
        this.applyFilter();
    }

    updateFlatMenus() {
        this.menus = [];
        for (const sec of this.sections) {
            if (sec && Array.isArray(sec.items)) {
                for (const item of sec.items) {
                    this.menus.push(item);
                }
            }
        }
    }

    formatMenuItem(item: any): any {
        return {
            title_th: item.title_th || item.title || '',
            title_en: item.title_en || item.title_th || item.title || '',
            iconName: item.iconName || 'apps-outline',
            gradient: item.gradient || 'linear-gradient(135deg, #003C71 0%, #005696 100%)',
            linkType: item.linkType || 'route',
            link: item.link || ''
        };
    }

    handleRefresh(event: any) {
        this.LoadData(false, event);
    }

    toggleSearch() {
        this.isSearchOpen = !this.isSearchOpen;
        if (!this.isSearchOpen) {
            this.clearSearch();
        } else {
            setTimeout(() => {
                const el = document.querySelector('.search-input') as HTMLInputElement;
                if (el) el.focus();
            }, 100);
        }
    }

    onSearchChange() {
        this.applyFilter();
    }

    clearSearch(closeBar = false) {
        this.searchTerm = '';
        this.applyFilter();
        if (closeBar) {
            this.isSearchOpen = false;
        }
    }

    applyFilter() {
        const query = (this.searchTerm || '').trim().toLowerCase();
        if (query) {
            this.searchResults = this.menus.filter(item => {
                const title = `${item.title_th || item.title || ''} ${item.title_en || ''}`.toLowerCase();
                return title.includes(query);
            });
        } else {
            this.searchResults = [];
        }
    }

    get profileImageUrl(): string {
        if (this.ipsu?.auth?.image) {
            return this.ipsu.auth.image.startsWith('data:') ? this.ipsu.auth.image : ('data:image/jpeg;base64,' + this.ipsu.auth.image);
        }
        return 'assets/imgs/no-user.png';
    }

    get displayName(): string {
        if (this.ipsu.language === 'en') {
            return this.ipsu.auth.fullname_en || this.ipsu.auth.username || this.ipsu.T('information.user');
        }
        return this.ipsu.auth.fullname_th || this.ipsu.auth.username || this.ipsu.T('information.user');
    }

    get displayId(): string {
        return this.ipsu.auth.psu_id || this.ipsu.auth.username || '';
    }

    get currentTermText(): string {
        if (this.currentTerm && this.currentTerm.academic_term && this.currentTerm.academic_year) {
            return this.ipsu.T('information.term', {
                term: this.currentTerm.academic_term,
                year: this.currentTerm.academic_year,
            });
        }
        return this.ipsu.T('information.term', { term: 1, year: 2569 });
    }

    OpenPage(item: any) {
        if (!item) return;

        if (item.linkType === 'none' || !item.link) {
            this.ipsu.ShowToast(this.ipsu.T('information.not_available'), 1800);
            return;
        }

        if (item.linkType === 'route' || (typeof item.link === 'string' && item.link.startsWith('/'))) {
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
            return;
        }

        if (typeof item.link === 'string' && item.link.startsWith('http')) {
            window.open(item.link, '_blank', 'noopener');
            return;
        }

        this.ipsu.LinkTo(item.link);
    }

    async promptLogin() {
        this.ipsu.SetStorage("ipsu-callback", "/tabs/information");
        const modal = await this.modalController.create({
            component: LoginPage
        });
        modal.onWillDismiss().then(() => {
            this.PageEnter();
        });
        return await modal.present();
    }
}
