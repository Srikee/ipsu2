import { Component, OnInit } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { IpsuService } from '../services/ipsu.service';
import { LoginPage } from '../login/login.page';

@Component({
    selector: 'app-schedule',
    templateUrl: './schedule.page.html',
    styleUrls: ['./schedule.page.scss'],
    standalone: false,
})
export class SchedulePage implements OnInit {
    isLoading = false;
    private readonly cachePrefix = 'ipsu-schedule-cache';

    private cacheKey(suffix: string): string {
        return this.ipsu.UserStorageKey(this.cachePrefix, suffix);
    }

    isTermModalOpen = false;
    eduTerm: string = '';
    eduYear: string = '';
    totalSubjects: number = 0;
    totalCredits: number = 0;
    availableTerms: any[] = [];
    allClasses: any[] = [];

    // Map each day '1'..'7' to array of classes
    byDayMap: { [day: string]: any[] } = {
        '1': [],
        '2': [],
        '3': [],
        '4': [],
        '5': [],
        '6': [],
        '7': []
    };

    // Selected day tab ('1' to '7')
    selectedDay: string = '1';

    // 7 days of the week (จันทร์ - อาทิตย์) matching the bottom tabs
    weekDays = [
        { id: '1', name: 'จันทร์', en: 'Mon' },
        { id: '2', name: 'อังคาร', en: 'Tue' },
        { id: '3', name: 'พุธ', en: 'Wed' },
        { id: '4', name: 'พฤหัส', en: 'Thu' },
        { id: '5', name: 'ศุกร์', en: 'Fri' },
        { id: '6', name: 'เสาร์', en: 'Sat' },
        { id: '7', name: 'อาทิตย์', en: 'Sun' }
    ];

    constructor(
        public ipsu: IpsuService,
        private alertCtrl: AlertController,
        private modalController: ModalController
    ) { }

    ngOnInit() { }

    ionViewWillEnter() {
        // ทุกครั้งที่เปิดหน้าตารางเรียนใหม่ ให้รีเซ็ตกลับเป็นปีเทอมปัจจุบัน และวันปัจจุบันเสมอ
        this.eduTerm = '';
        this.eduYear = '';
        const jsDay = new Date().getDay();
        this.selectedDay = jsDay === 0 ? '7' : String(jsDay);

        this.PageEnter();
    }

    async PageEnter() {
        if (this.ipsu.auth.status) {
            // วันปัจจุบัน (0=อาทิตย์ -> '7', 1=จันทร์ -> '1', ..., 6=เสาร์ -> '6')
            const jsDay = new Date().getDay();
            this.selectedDay = jsDay === 0 ? '7' : String(jsDay);
            this.resetScheduleData();

            // ดึงข้อมูลแคชของเทอมปัจจุบันมาแสดงทันที
            const cached = await this.ipsu.GetStorage(this.cacheKey('current'));
            if (cached && cached.status === 'ok') {
                this.processScheduleResponse(cached);
            }

            this.LoadData(this.allClasses.length === 0);
        } else {
            this.ipsu.SetStorage("ipsu-callback", "/schedule");
            const rs = await this.ipsu.ShowConfirm(this.ipsu.T('schedule.login_required'));
            if (rs) {
                const modal = await this.modalController.create({
                    component: LoginPage
                });
                modal.onWillDismiss().then(() => {
                    this.PageEnter();
                });
                return await modal.present();
            } else {
                this.ipsu.Back();
            }
        }
    }

    LoadData(loading = false, refresher?: any) {
        if (!this.ipsu.auth.status) {
            if (refresher) refresher.target.complete();
            return;
        }

        this.isLoading = loading;
        const payload: any = {
            psu_id: this.ipsu.auth.psu_id,
            username: this.ipsu.auth.username,
        };
        const isCurrentTermReq = !this.eduTerm && !this.eduYear;
        if (this.eduTerm) payload.edu_term = this.eduTerm;
        if (this.eduYear) payload.edu_year = this.eduYear;

        this.ipsu.Ajax(this.ipsu.api + "academic-schedule.php", payload, loading).then((res: any) => {
            this.isLoading = false;
            if (refresher) refresher.target.complete();

            if (res && res.status === 'ok') {
                this.processScheduleResponse(res);
                const cacheKey = this.cacheKey(`${res.edu_term}-${res.edu_year}`);
                this.ipsu.SetStorage(cacheKey, res);
                if (isCurrentTermReq) {
                    this.ipsu.SetStorage(this.cacheKey('current'), res);
                }
            } else if (res && res.message) {
                this.ipsu.ShowToast(res.message, 2500);
            }
        }).catch(() => {
            this.isLoading = false;
            if (refresher) refresher.target.complete();
        });
    }

    processScheduleResponse(res: any) {
        this.eduTerm = res.edu_term || this.eduTerm;
        this.eduYear = res.edu_year || this.eduYear;
        this.totalSubjects = res.total_subjects || 0;
        this.totalCredits = res.total_credits || 0;
        this.availableTerms = res.available_terms || [];
        this.allClasses = res.classes || [];

        // Reset map
        this.byDayMap = { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [] };

        if (Array.isArray(this.allClasses)) {
            for (const c of this.allClasses) {
                const dayKey = String(c.classDate || '1');
                if (!this.byDayMap[dayKey]) {
                    this.byDayMap[dayKey] = [];
                }
                this.byDayMap[dayKey].push(c);
            }
        }

        // If currently selected day has no classes, but today is not a class day,
        // we can check if another day has classes (optional, keep selectedDay or leave it)
    }

    private resetScheduleData() {
        this.totalSubjects = 0;
        this.totalCredits = 0;
        this.availableTerms = [];
        this.allClasses = [];
        this.byDayMap = { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [] };
    }

    get currentDayClasses(): any[] {
        return this.byDayMap[this.selectedDay] || [];
    }

    selectDay(dayId: string) {
        this.selectedDay = dayId;
    }

    handleRefresh(event: any) {
        this.LoadData(false, event);
    }

    formatTime(start: string, stop: string): string {
        if (!start && !stop) return '-';
        const s = (start || '').replace(':', '.');
        const e = (stop || '').replace(':', '.');
        return `${s} - ${e}`;
    }

    getDayName(dayId: string): string {
        const found = this.weekDays.find(d => d.id === dayId);
        return found ? (this.ipsu.language === 'en' ? found.en : found.name) : '';
    }

    openTermPicker() {
        this.isTermModalOpen = true;
    }

    closeTermModal() {
        this.isTermModalOpen = false;
    }

    isSelectedTerm(item: any): boolean {
        if (!item) return false;
        return String(item.term) === String(this.eduTerm) && String(item.year) === String(this.eduYear);
    }

    selectTerm(item: any) {
        if (!item) return;
        this.isTermModalOpen = false;

        if (String(item.term) !== String(this.eduTerm) || String(item.year) !== String(this.eduYear)) {
            this.eduTerm = String(item.term);
            this.eduYear = String(item.year);

            // Instant cache switch
            const cacheKey = this.cacheKey(`${this.eduTerm}-${this.eduYear}`);
            this.ipsu.GetStorage(cacheKey).then((cached: any) => {
                if (cached && cached.status === 'ok') {
                    this.processScheduleResponse(cached);
                    this.LoadData(false);
                } else {
                    this.LoadData(true);
                }
            }).catch(() => {
                this.LoadData(true);
            });
        }
    }

    async promptLogin() {
        this.ipsu.SetStorage("ipsu-callback", "/schedule");
        const modal = await this.modalController.create({
            component: LoginPage
        });
        modal.onWillDismiss().then(() => {
            this.PageEnter();
        });
        return await modal.present();
    }
}
