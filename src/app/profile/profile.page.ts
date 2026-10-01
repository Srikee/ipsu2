import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { LoginPage } from '../login/login.page';
import { IpsuService } from '../services/ipsu.service';
import { PushService } from '../services/push.service';
import * as QRCode from 'qrcode';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.page.html',
    styleUrls: ['./profile.page.scss'],
    standalone: false,
})
export class ProfilePage implements OnInit {
    isLoading = true;

    private get keyStorage(): string {
        return this.ipsu.UserStorageKey('ipsu-profile');
    }

    profile: any = {};
    hideCitizenId: boolean = true;
    hideAge: boolean = true;
    isPhotoModalOpen: boolean = false;
    qrCodeDataUrl: string = '';
    isQrModalOpen: boolean = false;

    constructor(
        public ipsu: IpsuService,
        private modalController: ModalController,
        private pushService: PushService,
    ) { }

    openPhotoModal() {
        this.isPhotoModalOpen = true;
    }

    closePhotoModal() {
        this.isPhotoModalOpen = false;
    }

    openQrModal() {
        this.isQrModalOpen = true;
    }

    closeQrModal() {
        this.isQrModalOpen = false;
    }

    async generateQrCode() {
        const id = this.profile.studentId || this.profile.staffId || this.ipsu.auth.username;
        if (!id) return;
        try {
            this.qrCodeDataUrl = await QRCode.toDataURL(id, {
                width: 300,
                margin: 1,
                color: {
                    dark: '#002B49',
                    light: '#ffffff'
                }
            });
        } catch (err) {
            console.error('[QR] Generate error:', err);
        }
    }

    ngOnInit() { }

    ionViewWillEnter() {
        this.PageEnter();
    }

    async PageEnter() {
        if (this.ipsu.auth.status) {
            this.profile = {};
            this.generateQrCode();
            const data = await this.ipsu.GetStorage(this.keyStorage);
            if (data != null) {
                this.profile = data;
                this.generateQrCode();
            }
            this.LoadData(this.isLoading && data == null);
            this.isLoading = false;
        } else {
            this.ipsu.SetStorage("ipsu-callback", "/tabs/profile");
            let rs = await this.ipsu.ShowConfirm(this.ipsu.T('profile.login_required'));
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

    LoadData(loading = false) {
        return this.ipsu.Ajax(this.ipsu.api + "user-profile.php", {
            psu_id: this.ipsu.auth.psu_id,
            username: this.ipsu.auth.username,
            group: this.ipsu.auth.group,
        }, loading).then((res: any) => {
            if (res.status == 'ok') {
                this.profile = res.profile;
                this.ipsu.SetStorage(this.keyStorage, this.profile);
                if (res.profile?.image) {
                    this.ipsu.auth.image = res.profile.image;
                    this.ipsu.SetStorage("ipsu-auth", this.ipsu.auth);
                }
                this.generateQrCode();
            }
        }).catch(err => { });
    }

    async handleRefresh(event: any) {
        await this.LoadData(false);
        if (event && event.target) {
            event.target.complete();
        }
    }

    toggleCitizenId() {
        this.hideCitizenId = !this.hideCitizenId;
    }

    getMaskedCitizenId(val: string): string {
        if (!val) return '-';
        const clean = (val + '').replace(/[\s-]+/g, '');
        if (!this.hideCitizenId) {
            return /^\d{13}$/.test(clean)
                ? clean.replace(/^(\d)(\d{4})(\d{5})(\d{2})(\d)$/, '$1-$2-$3-$4-$5')
                : val;
        }
        if (clean.length === 13) {
            return `${clean.substring(0, 1)}-xxxx-xxxxx-${clean.substring(11, 12)}-${clean.substring(12)}`;
        }
        if (clean.length > 4) {
            return clean.substring(0, 2) + '••••••••' + clean.slice(-2);
        }
        return '••••••••';
    }

    async copyToClipboard(text: string, label: string = 'รหัส') {
        if (!text) return;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            this.ipsu.ShowToast(this.ipsu.T('profile.copied', { label }), 1800);
        } catch (e) {
            this.ipsu.ShowToast(`${label}: ${text}`, 1800);
        }
    }

    Trim(val: string) {
        if (val == null) val = "";
        val = val + "";
        val = val.trim();
        val = val.replace("-", "");
        return val;
    }

    RenderMajor() {
        if (!this.profile.studentId) return '';
        const major = this.ipsu.language === 'en'
            ? this.Trim(this.profile.majorNameEng || this.profile.majorNameThai)
            : this.Trim(this.profile.majorNameThai);
        const subMajor = this.ipsu.language === 'en'
            ? this.Trim(this.profile.subMajorNameEng || this.profile.subMajorNameThai)
            : this.Trim(this.profile.subMajorNameThai);
        return subMajor || major;
    }

    RenderMinor() {
        if (!this.profile.studentId) return '';
        let minorNameThai = this.Trim(this.profile.minorNameThai);
        return minorNameThai;
    }

    Pick(th: any, en?: any): string {
        const clean = (v: any) => {
            const s = v == null ? '' : String(v).trim();
            return s === '-' ? '' : s;
        };
        const thai = clean(th);
        const eng = clean(en);
        return this.ipsu.language === 'en' ? (eng || thai) : (thai || eng);
    }

    private ParseDate(val: any): Date | null {
        const s = val == null ? '' : String(val).trim();
        const candidates: number[][] = [];
        let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (match) candidates.push([+match[1], +match[2], +match[3]]);
        match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) candidates.push([+match[3], +match[2], +match[1]]);
        // API บุคลากรส่งเป็น ddmmyyyy (พ.ศ.) เช่น 15012562
        match = s.match(/^(\d{2})(\d{2})(\d{4})$/);
        if (match) candidates.push([+match[3], +match[2], +match[1]]);
        match = s.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (match) candidates.push([+match[1], +match[2], +match[3]]);

        for (let [y, m, d] of candidates) {
            if (y > 2400) y -= 543;
            if (y < 1900) continue;
            const date = new Date(y, m - 1, d);
            if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) return date;
        }
        return null;
    }

    FormatDate(val: any, hideYear: boolean = false): string {
        const date = this.ParseDate(val);
        if (!date) return hideYear ? '••••' : this.Pick(val);
        return new Intl.DateTimeFormat(this.ipsu.language === 'en' ? 'en-GB' : 'th-TH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).formatToParts(date)
            .map(part => hideYear && part.type === 'year' ? '••••' : part.value)
            .join('');
    }

    AdmissionText(): string {
        const term = this.Pick(this.profile.admitTerm);
        const year = this.Pick(this.profile.admitYear);
        if (!year) return '';
        return term
            ? this.ipsu.T('profile.admission_value', { term, year })
            : year;
    }

    ClassYear(): string {
        const admitYear = parseInt(this.profile.admitYear, 10);
        if (!admitYear || this.profile.stillStudent !== 'Y') return '';
        const now = new Date();
        const academicYear = now.getFullYear() + 543 - (now.getMonth() < 5 ? 1 : 0);
        const year = academicYear - admitYear + 1;
        if (year < 1 || year > 8) return '';
        return this.ipsu.T('profile.class_year_value', { year });
    }

    CourseDuration(): string {
        const years = parseInt(this.profile.regularYear, 10);
        return years > 0 ? this.ipsu.T('profile.years_value', { years }) : '';
    }

    ServiceYears(): string {
        const start = this.ParseDate(this.profile.staffAcceptDate);
        if (!start) return '';
        const years = Math.floor((Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        return years >= 1 ? this.ipsu.T('profile.service_years_value', { years }) : '';
    }

    AgeText(): string {
        const birth = this.ParseDate(this.profile.birthDate || this.profile.staffBirthDate);
        if (!birth) return '';
        const now = new Date();
        let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
        if (now.getDate() < birth.getDate()) months--;
        if (months < 0) return '';
        if (this.hideAge) return this.ipsu.T('profile.age_value', { years: '••', months: '••' });
        return this.ipsu.T('profile.age_value', { years: Math.floor(months / 12), months: months % 12 });
    }

    PhoneNumber(): string {
        const raw = this.Pick(this.profile.phone || this.profile.workTelephone);
        const digits = raw.replace(/[\s-]+/g, '');
        if (/^0[689]\d{8}$/.test(digits)) return digits.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
        if (/^02\d{7}$/.test(digits)) return digits.replace(/^(\d{2})(\d{3})(\d{4})$/, '$1-$2-$3');
        if (/^0\d{8}$/.test(digits)) return digits.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1-$2-$3');
        return raw;
    }

    TelLink(phone: string): string {
        return 'tel:' + phone.replace(/[^\d+]/g, '');
    }

    async Logout() {
        // ฟังก์ชันนี้เหมือนใน app.component.ts
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
            await this.ipsu.LinkTo('/title', false);
        }
    }
}
