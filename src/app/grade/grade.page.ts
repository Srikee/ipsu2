import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { LoginPage } from '../login/login.page';
import { IpsuService } from '../services/ipsu.service';

@Component({
    selector: 'app-grade',
    templateUrl: './grade.page.html',
    styleUrls: ['./grade.page.scss'],
    standalone: false,
})
export class GradePage implements OnInit {
    isLoading = false;
    loadError = false;
    isTermModalOpen = false;
    hasLoadedData = false;
    eduTerm = '';
    eduYear = '';
    currentTerm = '';
    currentYear = '';
    grades: any[] = [];
    summary: any = null;
    availableTerms: any[] = [];

    private readonly cachePrefix = 'ipsu-grade-cache';

    constructor(
        public ipsu: IpsuService,
        private modalController: ModalController
    ) { }

    ngOnInit() { }

    ionViewWillEnter() {
        this.eduTerm = '';
        this.eduYear = '';
        this.PageEnter();
    }

    private cacheKey(suffix: string): string {
        return this.ipsu.UserStorageKey(this.cachePrefix, suffix);
    }

    async PageEnter() {
        if (!this.ipsu.auth.status) {
            this.ipsu.SetStorage('ipsu-callback', '/grade');
            const confirmed = await this.ipsu.ShowConfirm(this.ipsu.T('grade.login_required'));
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
        const cached = await this.ipsu.GetStorage(this.cacheKey('current'));
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
        const payload: any = {
            psu_id: this.ipsu.auth.psu_id,
            offset: 0,
            limit: 100,
        };
        const isCurrentRequest = !this.eduTerm && !this.eduYear;
        if (this.eduTerm) payload.edu_term = this.eduTerm;
        if (this.eduYear) payload.edu_year = this.eduYear;

        this.ipsu.Ajax(this.ipsu.api + 'academic-grade.php', payload, showLoading)
            .then((res: any) => {
                if (this.isSuccessfulResponse(res)) {
                    this.processResponse(res);
                    this.ipsu.SetStorage(this.cacheKey(`${res.edu_term}-${res.edu_year}`), res);
                    const isCurrent = String(res.edu_term || '') === String(res.current_term || '')
                        && String(res.edu_year || '') === String(res.current_year || '');
                    if (isCurrentRequest || isCurrent) {
                        this.ipsu.SetStorage(this.cacheKey('current'), res);
                    }
                    if (res.status === 'partial') {
                        this.ipsu.ShowToast(this.ipsu.T('grade.partial_data'), 2600);
                    }
                } else {
                    this.loadError = !this.hasLoadedData;
                    this.ipsu.ShowToast(this.ipsu.T('grade.load_failed'), 2500);
                }
            })
            .catch(() => {
                this.loadError = !this.hasLoadedData;
                if (!this.loadError) {
                    this.ipsu.ShowToast(this.ipsu.T('grade.offline_cache'), 2500);
                }
            })
            .finally(() => {
                this.isLoading = false;
                refresher?.target?.complete();
            });
    }

    private isSuccessfulResponse(res: any): boolean {
        return res?.status === 'ok' || res?.status === 'partial';
    }

    private processResponse(res: any) {
        this.eduTerm = String(res.edu_term || this.eduTerm || '');
        this.eduYear = String(res.edu_year || this.eduYear || '');
        this.currentTerm = String(res.current_term || this.currentTerm || '');
        this.currentYear = String(res.current_year || this.currentYear || '');
        this.grades = Array.isArray(res.grades) ? res.grades : [];
        this.summary = res.summary || (Array.isArray(res.gpa) ? res.gpa[0] : null) || null;
        this.availableTerms = Array.isArray(res.available_terms) ? res.available_terms : [];
        this.hasLoadedData = true;
        this.loadError = false;
    }

    private resetData() {
        this.grades = [];
        this.summary = null;
        this.availableTerms = [];
        this.hasLoadedData = false;
        this.loadError = false;
    }

    handleRefresh(event: any) {
        this.LoadData(false, event);
    }

    openTermPicker() {
        this.isTermModalOpen = true;
    }

    closeTermModal() {
        this.isTermModalOpen = false;
    }

    isSelectedTerm(item: any): boolean {
        return String(item?.term) === this.eduTerm && String(item?.year) === this.eduYear;
    }

    selectTerm(item: any) {
        if (!item) return;
        this.closeTermModal();
        const term = String(item.term);
        const year = String(item.year);
        if (term === this.eduTerm && year === this.eduYear) return;

        this.eduTerm = term;
        this.eduYear = year;
        this.grades = [];
        this.summary = null;
        this.hasLoadedData = false;
        this.ipsu.GetStorage(this.cacheKey(`${term}-${year}`))
            .then((cached: any) => {
                if (this.isSuccessfulResponse(cached)) {
                    this.processResponse(cached);
                    this.LoadData(false);
                } else {
                    this.LoadData(true);
                }
            })
            .catch(() => this.LoadData(true));
    }

    termTitle(item?: any): string {
        if (item) {
            return this.ipsu.language === 'en'
                ? (item.title_en || item.title_th)
                : (item.title_th || item.title_en);
        }
        return this.ipsu.T('grade.semester', { term: this.eduTerm || '-', year: this.eduYear || '-' });
    }

    subjectName(item: any): string {
        return this.ipsu.language === 'en'
            ? String(item?.subjectNameEng || item?.shortNameEng || item?.subjectNameThai || '').trim()
            : String(item?.subjectNameThai || item?.subjectNameEng || item?.shortNameEng || '').trim();
    }

    formatNumber(value: any, digits = 2): string {
        const number = Number(value);
        return Number.isFinite(number) ? number.toFixed(digits) : '-';
    }

    displayCredits(value: any): string {
        const number = Number(value);
        return Number.isFinite(number) ? String(number) : '-';
    }

    get semesterGpa(): string {
        return this.formatNumber(this.summary?.semGpa);
    }

    get cumulativeGpa(): string {
        return this.formatNumber(this.summary?.cumGpa);
    }

    get semesterCredits(): string {
        if (this.summary?.semCredit !== undefined && this.summary?.semCredit !== null) {
            return this.displayCredits(this.summary.semCredit);
        }
        const total = this.grades.reduce((sum, item) => sum + (Number(item?.credit) || 0), 0);
        return this.grades.length ? this.displayCredits(total) : '-';
    }

    gradeClass(value: any): string {
        const grade = String(value || '').trim().toUpperCase();
        if (grade === 'A') return 'grade-a';
        if (grade.startsWith('B')) return 'grade-b';
        if (grade.startsWith('C')) return 'grade-c';
        if (grade === 'D+' || grade === 'D') return 'grade-d';
        if (grade === 'E' || grade === 'F') return 'grade-f';
        return 'grade-other';
    }

    trackByGrade(index: number, item: any): string {
        return String(item?.sectionOfferId || `${item?.subjectCode}-${item?.section}-${index}`);
    }

    async promptLogin() {
        this.ipsu.SetStorage('ipsu-callback', '/grade');
        const modal = await this.modalController.create({ component: LoginPage });
        modal.onWillDismiss().then(() => this.PageEnter());
        await modal.present();
    }
}
