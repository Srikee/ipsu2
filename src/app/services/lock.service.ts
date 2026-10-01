import { Injectable, NgZone } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { IpsuService } from './ipsu.service';
import { PushService } from './push.service';

// มีเฉพาะบนเครื่องจริงที่ติดตั้ง cordova-plugin-fingerprint-aio
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Fingerprint: any;

export type BiometricType = 'face' | 'finger' | 'biometric' | '';

export interface LockConfig {
    enabled: boolean;
    pinHash: string;
    salt: string;
    biometric: boolean;
    timeout: number;        // วินาทีที่อยู่เบื้องหลังได้ก่อนล็อก (0 = ทันที)
}

interface LockAttempts {
    count: number;
    lockedUntil: number;
}

export const LOCK_PIN_LENGTH = 6;
export const LOCK_TIMEOUT_OPTIONS = [0, 60, 300, 900];
const LOCK_DELAY_AFTER = 5;
const LOCK_LOGOUT_AFTER = 10;
const HASH_ROUNDS = 2000;

@Injectable({
    providedIn: 'root'
})
export class LockService {
    isLocked = false;
    config: LockConfig = this.DefaultConfig();
    biometricType: BiometricType = '';

    private pausedAt = 0;
    private biometricBusy = false;
    private ignoreResumeUntil = 0;
    private listenersReady = false;
    private backButtonSub?: Subscription;

    constructor(
        private ipsu: IpsuService,
        private pushService: PushService,
        private platform: Platform,
        private zone: NgZone,
    ) { }

    // -------------------------------------------------------------------------
    // [1] เริ่มต้นตอนเปิดแอป
    // -------------------------------------------------------------------------

    async Init(): Promise<void> {
        await this.LoadConfig();
        await this.DetectBiometric();
        this.BindAppStateListeners();

        if (this.ipsu.auth.status && this.config.enabled && this.config.pinHash) {
            this.Lock();
        }
    }

    private DefaultConfig(): LockConfig {
        return { enabled: false, pinHash: '', salt: '', biometric: false, timeout: 60 };
    }

    private get configKey(): string {
        return this.ipsu.UserStorageKey('ipsu-lock', 'config');
    }

    private get attemptsKey(): string {
        return this.ipsu.UserStorageKey('ipsu-lock', 'attempts');
    }

    async LoadConfig(): Promise<LockConfig> {
        const saved = this.ipsu.auth.status ? await this.ipsu.GetStorage(this.configKey) : null;
        this.config = { ...this.DefaultConfig(), ...(saved || {}) };
        return this.config;
    }

    private async SaveConfig(): Promise<void> {
        await this.ipsu.SetStorage(this.configKey, this.config);
    }

    // -------------------------------------------------------------------------
    // [2] ล็อก / ปลดล็อก
    // -------------------------------------------------------------------------

    Lock(): void {
        if (this.isLocked) return;
        this.isLocked = true;
        // กันปุ่ม Back ของ Android ไม่ให้ย้อนหน้าที่อยู่ใต้หน้าล็อก
        this.backButtonSub = this.platform.backButton.subscribeWithPriority(99999, () => { });
    }

    private Unlock(): void {
        this.isLocked = false;
        this.backButtonSub?.unsubscribe();
        this.backButtonSub = undefined;
    }

    private BindAppStateListeners(): void {
        if (this.listenersReady) return;
        this.listenersReady = true;

        this.platform.pause.subscribe(() => this.OnPause());
        this.platform.resume.subscribe(() => this.zone.run(() => this.OnResume()));

        if (!this.platform.is('cordova') && typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                this.zone.run(() => document.hidden ? this.OnPause() : this.OnResume());
            });
        }
    }

    private OnPause(): void {
        if (this.biometricBusy) return;
        this.pausedAt = Date.now();
    }

    private OnResume(): void {
        const pausedAt = this.pausedAt;
        this.pausedAt = 0;
        if (!pausedAt || this.biometricBusy || Date.now() < this.ignoreResumeUntil) return;
        if (!this.ipsu.auth.status || !this.config.enabled || !this.config.pinHash) return;

        if ((Date.now() - pausedAt) / 1000 >= this.config.timeout) {
            this.Lock();
        }
    }

    // -------------------------------------------------------------------------
    // [3] รหัส PIN
    // -------------------------------------------------------------------------

    async EnableWithPin(pin: string): Promise<void> {
        this.config.salt = this.ipsu.RandomString(16);
        this.config.pinHash = this.HashPin(pin, this.config.salt);
        this.config.enabled = true;
        await this.SaveConfig();
        await this.ResetAttempts();
    }

    async ChangePin(pin: string): Promise<void> {
        await this.EnableWithPin(pin);
    }

    async Disable(): Promise<void> {
        this.config = this.DefaultConfig();
        await this.ipsu.RemoveStorage(this.configKey);
        await this.ResetAttempts();
        this.Unlock();
    }

    async SetTimeout(seconds: number): Promise<void> {
        this.config.timeout = seconds;
        await this.SaveConfig();
    }

    async SetBiometric(enabled: boolean): Promise<void> {
        this.config.biometric = enabled;
        await this.SaveConfig();
    }

    /**
     * ตรวจ PIN และนับจำนวนครั้งที่ผิด
     * result: ok | wrong | delayed | logout
     */
    async VerifyPin(pin: string): Promise<{ result: 'ok' | 'wrong' | 'delayed' | 'logout'; remaining: number; waitSeconds: number }> {
        const attempts = await this.GetAttempts();
        const wait = this.WaitSeconds(attempts);
        if (wait > 0) {
            return { result: 'delayed', remaining: LOCK_LOGOUT_AFTER - attempts.count, waitSeconds: wait };
        }

        if (this.HashPin(pin, this.config.salt) === this.config.pinHash) {
            await this.ResetAttempts();
            return { result: 'ok', remaining: LOCK_LOGOUT_AFTER, waitSeconds: 0 };
        }

        attempts.count++;
        if (attempts.count >= LOCK_LOGOUT_AFTER) {
            await this.ForceLogout();
            return { result: 'logout', remaining: 0, waitSeconds: 0 };
        }
        if (attempts.count >= LOCK_DELAY_AFTER) {
            attempts.lockedUntil = Date.now() + this.DelayFor(attempts.count) * 1000;
        }
        await this.ipsu.SetStorage(this.attemptsKey, attempts);
        return {
            result: 'wrong',
            remaining: LOCK_LOGOUT_AFTER - attempts.count,
            waitSeconds: this.WaitSeconds(attempts),
        };
    }

    async UnlockWithPin(pin: string) {
        const rs = await this.VerifyPin(pin);
        if (rs.result === 'ok') this.Unlock();
        return rs;
    }

    async CurrentWaitSeconds(): Promise<number> {
        return this.WaitSeconds(await this.GetAttempts());
    }

    private DelayFor(count: number): number {
        // ผิดครั้งที่ 5 = 30 วินาที แล้วเพิ่มเป็นเท่าตัว สูงสุด 5 นาที
        return Math.min(30 * Math.pow(2, count - LOCK_DELAY_AFTER), 300);
    }

    private WaitSeconds(attempts: LockAttempts): number {
        return Math.max(0, Math.ceil((attempts.lockedUntil - Date.now()) / 1000));
    }

    private async GetAttempts(): Promise<LockAttempts> {
        const saved = await this.ipsu.GetStorage(this.attemptsKey);
        return { count: 0, lockedUntil: 0, ...(saved || {}) };
    }

    private async ResetAttempts(): Promise<void> {
        await this.ipsu.RemoveStorage(this.attemptsKey);
    }

    // -------------------------------------------------------------------------
    // [4] Face ID / ลายนิ้วมือ
    // -------------------------------------------------------------------------

    get biometricSupported(): boolean {
        return !!this.biometricType;
    }

    get canUseBiometric(): boolean {
        return this.biometricSupported && this.config.biometric;
    }

    BiometricLabel(): string {
        if (this.biometricType === 'face') return this.platform.is('ios') ? 'Face ID' : this.ipsu.T('lock.bio_face');
        if (this.biometricType === 'finger') return this.platform.is('ios') ? 'Touch ID' : this.ipsu.T('lock.bio_finger');
        return this.ipsu.T('lock.bio_common');
    }

    async DetectBiometric(): Promise<BiometricType> {
        if (typeof Fingerprint === 'undefined') {
            this.biometricType = '';
            return '';
        }
        this.biometricType = await new Promise<BiometricType>(resolve => {
            Fingerprint.isAvailable(
                (type: BiometricType) => resolve(type || 'biometric'),
                () => resolve(''),
            );
        });
        return this.biometricType;
    }

    /** เรียกสแกน คืนค่า true เมื่อยืนยันตัวตนสำเร็จ */
    async AuthenticateBiometric(): Promise<boolean> {
        if (!this.biometricSupported || this.biometricBusy) return false;
        this.biometricBusy = true;
        try {
            return await new Promise<boolean>(resolve => {
                Fingerprint.show({
                    title: 'iPSU',
                    description: this.ipsu.T('lock.bio_prompt'),
                    cancelButtonTitle: this.ipsu.T('lock.use_pin'),
                    disableBackup: true,
                }, () => resolve(true), () => resolve(false));
            });
        } finally {
            this.biometricBusy = false;
            // Android เปิดหน้าสแกนเป็น Activity แยก ทำให้เกิด pause/resume ตามมา
            this.ignoreResumeUntil = Date.now() + 1500;
        }
    }

    async UnlockWithBiometric(): Promise<boolean> {
        if (!this.canUseBiometric) return false;
        const ok = await this.zone.run(() => this.AuthenticateBiometric());
        if (ok) {
            await this.ResetAttempts();
            this.zone.run(() => this.Unlock());
        }
        return ok;
    }

    // -------------------------------------------------------------------------
    // [5] ออกจากระบบจากหน้าล็อก
    // -------------------------------------------------------------------------

    async ForceLogout(): Promise<void> {
        this.pushService.Logout();
        this.ipsu.unreadMessageCount = 0;
        this.ipsu.auth = {
            status: false,
            psu_id: '',
            username: '',
            type: '',
            group: '',
            fullname_th: '',
            fullname_en: '',
            image: '',
        };
        await this.ipsu.ClearStorage();
        this.config = this.DefaultConfig();
        this.Unlock();
        await this.ipsu.LinkTo('/title', false);
    }

    // -------------------------------------------------------------------------
    // [6] SHA-256 (ทำงานได้ทั้งบน browser และ WebView ที่ไม่มี crypto.subtle)
    // -------------------------------------------------------------------------

    private HashPin(pin: string, salt: string): string {
        let hash = this.Sha256(`${salt}:${pin}`);
        for (let i = 1; i < HASH_ROUNDS; i++) {
            hash = this.Sha256(`${salt}:${hash}`);
        }
        return hash;
    }

    private Sha256(message: string): string {
        const K = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
        ];
        const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

        const bytes = Array.from(new TextEncoder().encode(message));
        const bitLength = bytes.length * 8;
        bytes.push(0x80);
        while (bytes.length % 64 !== 56) bytes.push(0);
        for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLength >>> (i * 8)) & 0xff);

        const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
        const W = new Array<number>(64);

        for (let offset = 0; offset < bytes.length; offset += 64) {
            for (let t = 0; t < 16; t++) {
                const i = offset + t * 4;
                W[t] = (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
            }
            for (let t = 16; t < 64; t++) {
                const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
                const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
                W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
            }

            let [a, b, c, d, e, f, g, h] = H;
            for (let t = 0; t < 64; t++) {
                const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
                const ch = (e & f) ^ (~e & g);
                const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
                const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (S0 + maj) | 0;
                h = g; g = f; f = e; e = (d + temp1) | 0;
                d = c; c = b; b = a; a = (temp1 + temp2) | 0;
            }
            H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
        }

        return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
    }
}
