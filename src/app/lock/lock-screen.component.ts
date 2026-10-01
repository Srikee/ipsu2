import { Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { IpsuService } from '../services/ipsu.service';
import { LOCK_PIN_LENGTH, LockService } from '../services/lock.service';

export type LockScreenMode = 'unlock' | 'setup' | 'verify';

@Component({
    selector: 'app-lock-screen',
    templateUrl: './lock-screen.component.html',
    styleUrls: ['./lock-screen.component.scss'],
    standalone: false,
})
export class LockScreenComponent implements OnInit, OnDestroy {
    // unlock = หน้าล็อกตอนเข้าแอป, setup = ตั้ง PIN ใหม่, verify = ยืนยัน PIN เดิมก่อนแก้ค่า
    @Input() mode: LockScreenMode = 'unlock';

    readonly dots = Array.from({ length: LOCK_PIN_LENGTH });
    readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    pin = '';
    step: 'enter' | 'confirm' = 'enter';
    errorText = '';
    shake = false;
    busy = false;
    waitSeconds = 0;
    confirmForgot = false;

    private firstPin = '';
    private waitTimer?: ReturnType<typeof setInterval>;

    constructor(
        public ipsu: IpsuService,
        public lock: LockService,
        private modalCtrl: ModalController,
    ) { }

    async ngOnInit() {
        if (this.mode !== 'setup') {
            this.StartCountdown(await this.lock.CurrentWaitSeconds());
        }
        if (this.showBiometric && this.waitSeconds === 0) {
            setTimeout(() => this.UseBiometric(), 400);
        }
    }

    ngOnDestroy() {
        this.StopCountdown();
    }

    get showBiometric(): boolean {
        return this.mode !== 'setup' && this.lock.canUseBiometric;
    }

    get title(): string {
        if (this.mode === 'setup') {
            return this.ipsu.T(this.step === 'enter' ? 'lock.setup_title' : 'lock.confirm_title');
        }
        if (this.mode === 'verify') return this.ipsu.T('lock.verify_title');
        return (this.ipsu.language === 'en' ? this.ipsu.auth.fullname_en : this.ipsu.auth.fullname_th)
            || this.ipsu.auth.username;
    }

    get subtitle(): string {
        if (this.waitSeconds > 0) return this.ipsu.T('lock.wait', { seconds: this.waitSeconds });
        if (this.mode === 'setup') {
            return this.ipsu.T(this.step === 'enter' ? 'lock.setup_hint' : 'lock.confirm_hint');
        }
        return this.ipsu.T('lock.enter_pin');
    }

    @HostListener('document:keydown', ['$event'])
    OnKeydown(event: KeyboardEvent) {
        if (this.confirmForgot) return;
        if (/^\d$/.test(event.key)) {
            this.Press(event.key);
        } else if (event.key === 'Backspace') {
            this.Backspace();
        }
    }

    Press(digit: string) {
        if (this.busy || this.waitSeconds > 0 || this.pin.length >= LOCK_PIN_LENGTH) return;
        this.errorText = '';
        this.pin += digit;
        if (this.pin.length === LOCK_PIN_LENGTH) {
            this.busy = true;
            // ให้จุดสุดท้ายแสดงก่อนตรวจรหัส
            setTimeout(() => this.Submit(), 150);
        }
    }

    Backspace() {
        if (this.busy || this.waitSeconds > 0) return;
        this.pin = this.pin.slice(0, -1);
    }

    private async Submit() {
        try {
            if (this.mode === 'setup') {
                this.SubmitSetup();
                return;
            }

            const rs = this.mode === 'unlock'
                ? await this.lock.UnlockWithPin(this.pin)
                : await this.lock.VerifyPin(this.pin);

            if (rs.result === 'ok') {
                if (this.mode === 'verify') await this.modalCtrl.dismiss({ verified: true });
                return;
            }
            if (rs.result === 'logout') {
                if (this.mode === 'verify') await this.modalCtrl.dismiss({ logout: true });
                await this.ipsu.ShowAlert(this.ipsu.T('lock.too_many'));
                return;
            }
            if (rs.result === 'wrong') {
                this.ShowError(rs.remaining <= 5
                    ? this.ipsu.T('lock.pin_wrong_remaining', { count: rs.remaining })
                    : this.ipsu.T('lock.pin_wrong'));
            } else {
                this.pin = '';
            }
            this.StartCountdown(rs.waitSeconds);
        } finally {
            this.busy = false;
        }
    }

    private SubmitSetup() {
        if (this.step === 'enter') {
            this.firstPin = this.pin;
            this.pin = '';
            this.step = 'confirm';
            return;
        }
        if (this.pin === this.firstPin) {
            this.modalCtrl.dismiss({ pin: this.pin });
            return;
        }
        this.firstPin = '';
        this.step = 'enter';
        this.ShowError(this.ipsu.T('lock.pin_mismatch'));
    }

    private ShowError(text: string) {
        this.errorText = text;
        this.pin = '';
        this.shake = true;
        setTimeout(() => this.shake = false, 450);
        if (navigator.vibrate) navigator.vibrate(120);
    }

    async UseBiometric() {
        if (!this.showBiometric || this.busy || this.waitSeconds > 0) return;
        if (this.mode === 'unlock') {
            await this.lock.UnlockWithBiometric();
            return;
        }
        if (await this.lock.AuthenticateBiometric()) {
            await this.modalCtrl.dismiss({ verified: true });
        }
    }

    // ใช้กล่องยืนยันในหน้าเอง เพราะ ion-alert จะอยู่ใต้หน้าล็อกที่เป็น overlay
    ForgotPin() {
        this.confirmForgot = true;
    }

    CancelForgot() {
        this.confirmForgot = false;
    }

    async ConfirmForgot() {
        this.confirmForgot = false;
        if (this.mode === 'verify') await this.modalCtrl.dismiss({ logout: true });
        await this.lock.ForceLogout();
    }

    Cancel() {
        this.modalCtrl.dismiss(null);
    }

    private StartCountdown(seconds: number) {
        this.StopCountdown();
        this.waitSeconds = seconds;
        if (seconds <= 0) return;
        this.waitTimer = setInterval(() => {
            this.waitSeconds = Math.max(0, this.waitSeconds - 1);
            if (this.waitSeconds === 0) this.StopCountdown();
        }, 1000);
    }

    private StopCountdown() {
        if (this.waitTimer) clearInterval(this.waitTimer);
        this.waitTimer = undefined;
    }
}
