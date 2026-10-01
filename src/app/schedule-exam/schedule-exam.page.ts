import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { LoginPage } from '../login/login.page';
import { IpsuService } from '../services/ipsu.service';

interface ExamGroup {
    dateKey: string;
    items: any[];
}

@Component({
    selector: 'app-schedule-exam',
    templateUrl: './schedule-exam.page.html',
    styleUrls: ['./schedule-exam.page.scss'],
    standalone: false,
})
export class ScheduleExamPage implements OnInit {
    isLoading = false;
    loadError = false;
    isTermModalOpen = false;
    eduTerm = '';
    eduYear = '';
    exams: any[] = [];
    availableTerms: any[] = [];
    hasLoadedData = false;

    private readonly cachePrefix = 'ipsu-exam-schedule-cache';

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
            this.ipsu.SetStorage('ipsu-callback', '/schedule-exam');
            const confirmed = await this.ipsu.ShowConfirm(this.ipsu.T('schedule_exam.login_required'));
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
        if (cached?.status === 'ok') {
            this.processResponse(cached);
        }
        this.LoadData(!this.hasLoadedData);
    }

    LoadData(showLoading = false, refresher?: any, forceRefresh = false) {
        if (!this.ipsu.auth.status) {
            refresher?.target?.complete();
            return;
        }

        this.isLoading = true;
        this.loadError = false;
        const payload: any = { psu_id: this.ipsu.auth.psu_id };
        if (forceRefresh) payload.force_refresh = true;
        const isCurrentRequest = !this.eduTerm && !this.eduYear;
        if (this.eduTerm) payload.edu_term = this.eduTerm;
        if (this.eduYear) payload.edu_year = this.eduYear;

        this.ipsu.Ajax(this.ipsu.api + 'academic-schedule-exam.php', payload, showLoading)
            .then((res: any) => {
                if (res?.status === 'ok') {
                    this.processResponse(res);
                    this.ipsu.SetStorage(this.cacheKey(`${res.edu_term}-${res.edu_year}`), res);
                    const isCurrentTerm = String(res.edu_term || '') === String(res.current_term || '')
                        && String(res.edu_year || '') === String(res.current_year || '');
                    if (isCurrentRequest || isCurrentTerm) {
                        this.ipsu.SetStorage(this.cacheKey('current'), res);
                    }
                } else {
                    this.loadError = !this.hasLoadedData;
                    this.ipsu.ShowToast(this.ipsu.T('schedule_exam.load_failed'), 2500);
                }
            })
            .catch(() => {
                this.loadError = !this.hasLoadedData;
                if (!this.loadError) {
                    this.ipsu.ShowToast(this.ipsu.T('schedule_exam.offline_cache'), 2500);
                }
            })
            .finally(() => {
                this.isLoading = false;
                refresher?.target?.complete();
            });
    }

    private processResponse(res: any) {
        this.eduTerm = String(res.edu_term || this.eduTerm || '');
        this.eduYear = String(res.edu_year || this.eduYear || '');
        this.exams = Array.isArray(res.exams) ? res.exams : [];
        this.availableTerms = Array.isArray(res.available_terms) ? res.available_terms : [];
        this.hasLoadedData = true;
        this.loadError = false;
    }

    private resetData() {
        this.exams = [];
        this.availableTerms = [];
        this.hasLoadedData = false;
        this.loadError = false;
    }

    get groupedExams(): ExamGroup[] {
        const groups = new Map<string, any[]>();
        for (const exam of this.exams) {
            const key = this.dateKey(exam.examDate);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)?.push(exam);
        }
        return Array.from(groups.entries()).map(([dateKey, items]) => ({ dateKey, items }));
    }

    get upcomingCount(): number {
        return this.exams.filter(exam => !this.isPast(exam)).length;
    }

    get nextExam(): any | null {
        return this.exams.find(exam => !this.isPast(exam)) || null;
    }

    handleRefresh(event: any) {
        this.LoadData(false, event, true);
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
        this.exams = [];
        this.hasLoadedData = false;
        this.ipsu.GetStorage(this.cacheKey(`${term}-${year}`))
            .then((cached: any) => {
                if (cached?.status === 'ok') {
                    this.processResponse(cached);
                    this.LoadData(false);
                } else {
                    this.LoadData(true);
                }
            })
            .catch(() => this.LoadData(true));
    }

    termTitle(item: any): string {
        if (item) {
            return this.ipsu.language === 'en'
                ? (item.title_en || item.title_th)
                : (item.title_th || item.title_en);
        }
        return this.ipsu.T('schedule_exam.semester', { term: this.eduTerm, year: this.eduYear });
    }

    subjectName(exam: any): string {
        return this.ipsu.language === 'en'
            ? (exam.subjectNameEng || exam.subjectNameThai || exam.shortNameEng || '')
            : (exam.subjectNameThai || exam.subjectNameEng || exam.shortNameEng || '');
    }

    formatTime(start: any, stop: any): string {
        const normalizedStart = this.normalizeTime(start);
        const normalizedStop = this.normalizeTime(stop);
        if (!normalizedStart && !normalizedStop) return '-';
        return [normalizedStart, normalizedStop].filter(Boolean).join(' – ');
    }

    formatExamDate(value: any): string {
        const key = this.dateKey(value);
        const date = this.parseDate(key);
        if (!date) return key || '-';
        return new Intl.DateTimeFormat(this.ipsu.language === 'en' ? 'en-GB' : 'th-TH', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);
    }

    formatShortDate(value: any): string {
        const date = this.parseDate(this.dateKey(value));
        if (!date) return '-';
        return new Intl.DateTimeFormat(this.ipsu.language === 'en' ? 'en-GB' : 'th-TH', {
            day: 'numeric',
            month: 'short'
        }).format(date);
    }

    isToday(exam: any): boolean {
        return this.dateKey(exam?.examDate) === this.localDateKey(new Date());
    }

    isPast(exam: any): boolean {
        const dateKey = this.dateKey(exam?.examDate);
        if (!dateKey) return false;
        const time = this.normalizeTime(exam?.examStopTime || exam?.examStartTime) || '23:59';
        const examDate = new Date(`${dateKey}T${time}:00`);
        return !Number.isNaN(examDate.getTime()) && examDate.getTime() < Date.now();
    }

    trackByExam(index: number, exam: any): string {
        return String(exam.sectionOfferId || `${exam.subjectCode}-${exam.examDate}-${exam.examStartTime}-${index}`);
    }

    async promptLogin() {
        this.ipsu.SetStorage('ipsu-callback', '/schedule-exam');
        const modal = await this.modalController.create({ component: LoginPage });
        modal.onWillDismiss().then(() => this.PageEnter());
        await modal.present();
    }

    private normalizeTime(value: any): string {
        const time = String(value || '').trim();
        if (/^[0-9]{4}$/.test(time)) return `${time.slice(0, 2)}:${time.slice(2)}`;
        if (/^[0-9]{1,2}:[0-9]{2}/.test(time)) return time.slice(0, 5).padStart(5, '0');
        return time;
    }

    private dateKey(value: any): string {
        const raw = String(value || '').trim();
        const match = raw.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})/);
        return match ? match[1] : raw;
    }

    private parseDate(key: string): Date | null {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
        const date = new Date(`${key}T00:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    private localDateKey(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
