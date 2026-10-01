import { Component, OnInit, computed } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { LoginPage } from '../login/login.page';
import { IpsuService } from '../services/ipsu.service';

interface Scholarship {
    app_id: number;
    job_id: number;
    job_title: string;
    job_description: string;
    type_name_th: string;
    total_hours: number;
}

type ScholarshipType = 'earns' | 'other';
type WorkStatus = 'active' | 'completed';

@Component({
    selector: 'app-scholarships',
    templateUrl: './scholarships.page.html',
    styleUrls: ['./scholarships.page.scss'],
    standalone: false,
})
export class ScholarshipsPage implements OnInit {
    isLoading = false;
    loadError = false;
    hasLoadedData = false;
    scholarships: Scholarship[] = [];
    activeTab: ScholarshipType = 'earns';
    activeTerm = '1/2569';

    private readonly cachePrefix = 'ipsu-scholarship-cache';

    // Computed values for dashboard
    totalAvailable = computed(() => this.scholarships.length);
    totalHoursNum = computed(() =>
        this.scholarships.reduce((sum, s) => sum + (s.total_hours || 0), 0)
    );
    totalHours = computed(() => this.totalHoursNum().toFixed(2));
    totalEarnings = computed(() => (this.totalHoursNum() * 25).toFixed(2)); // สมมติ 25 บาท/ชม.
    pendingHours = computed(() => this.totalHours());

    // Filtered data
    activeScholarships = computed(() => {
        if (this.activeTab !== 'earns') return [];
        return this.scholarships; // ปัจจุบันมีแค่ active
    });

    completedScholarships = computed(() => []); // ยังไม่มีข้อมูลเสร็จแล้ว
    otherScholarships = computed(() => []); // Tab ทุนอื่นๆ

    tabs = [
        { id: 'earns' as ScholarshipType, label: 'PSU EARNS' },
        { id: 'other' as ScholarshipType, label: 'ทุนอื่นๆ' },
    ];

    subTabs = [
        { id: 'active' as WorkStatus, label: 'กำลังทำ', count: () => this.activeScholarships().length },
        { id: 'completed' as WorkStatus, label: 'เสร็จสิ้น', count: () => this.completedScholarships().length },
    ];

    constructor(
        public ipsu: IpsuService,
        private modalController: ModalController
    ) { }

    ngOnInit() { }

    ionViewWillEnter() {
        this.PageEnter();
    }

    private isEarans(scholarship: Scholarship): boolean {
        const title = scholarship.type_name_th.toLowerCase();
        return title.includes('earns') || title.includes('แลกเปลี่ยน');
    }

    private cacheKey(): string {
        return this.ipsu.UserStorageKey(this.cachePrefix, 'data');
    }

    async PageEnter() {
        if (!this.ipsu.auth.status) {
            this.ipsu.SetStorage('ipsu-callback', '/scholarships');
            const confirmed = await this.ipsu.ShowConfirm(this.ipsu.T('scholarship.login_required'));
            if (confirmed) {
                const modal = await this.modalController.create({ component: LoginPage });
                modal.onWillDismiss().then(() => this.PageEnter());
                await modal.present();
            } else {
                this.ipsu.Back();
            }
            return;
        }

        this.resetData();
        const cached = await this.ipsu.GetStorage(this.cacheKey());
        if (this.isSuccessfulResponse(cached)) {
            this.processResponse(cached);
        }
        this.LoadData(!this.hasLoadedData);
    }

    LoadData(showLoading = false, refresher?: any) {
        if (!this.ipsu.auth.status) {
            refresher?.target?.complete();
            return;
        }

        this.isLoading = true;
        this.loadError = false;

        const payload = { psu_id: this.ipsu.auth.psu_id };

        this.ipsu.Ajax(this.ipsu.api + 'scholarships-get.php', payload, showLoading)
            .then((res: any) => {
                if (this.isSuccessfulResponse(res)) {
                    this.processResponse(res);
                    this.ipsu.SetStorage(this.cacheKey(), res);
                } else {
                    this.loadError = !this.hasLoadedData;
                    this.ipsu.ShowToast(this.ipsu.T('scholarship.load_failed'), 2500);
                }
            })
            .catch(() => {
                this.loadError = !this.hasLoadedData;
                if (!this.loadError) {
                    this.ipsu.ShowToast(this.ipsu.T('scholarship.offline_cache'), 2500);
                }
            })
            .finally(() => {
                this.isLoading = false;
                refresher?.target?.complete();
            });
    }

    private isSuccessfulResponse(res: any): boolean {
        return res?.status === 'ok';
    }

    private processResponse(res: any) {
        this.scholarships = Array.isArray(res.data) ? res.data : [];
        this.hasLoadedData = true;
        this.loadError = false;
    }

    private resetData() {
        this.scholarships = [];
        this.hasLoadedData = false;
        this.loadError = false;
    }

    handleRefresh(event: any) {
        this.LoadData(false, event);
    }

    selectTab(tabId: ScholarshipType) {
        this.activeTab = tabId;
    }

    selectSubTab(subTabId: WorkStatus) {
        // Handle sub-tab selection if needed
    }

    trackById(index: number, item: Scholarship): number {
        return item.app_id;
    }

    formatHours(hours: number): string {
        return hours.toFixed(2).replace(/\.?0+$/, '') + ' ชม.';
    }

    formatCurrency(amount: number): string {
        return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ฿';
    }

    getScholarshipType(scholarship: Scholarship): ScholarshipType {
        if (this.isEarans(scholarship)) return 'earns';
        return 'other';
    }

    promptLogin() {
        this.PageEnter();
    }

    viewDetails(scholarship: Scholarship) {
        // TODO: เปิด Modal หรือ Navigate ไปหน้ารายละเอียด
        console.log('View details:', scholarship);
    }

    openTermPicker() {
        // TODO: เปิด Modal เลือกเทอม
        console.log('Open term picker');
    }

    formatEarnings(): string {
        const earnings = this.totalHoursNum() * 25;
        return this.formatCurrency(earnings);
    }
}
