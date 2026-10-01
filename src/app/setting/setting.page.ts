import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { IpsuService } from '../services/ipsu.service';
import { LOCK_TIMEOUT_OPTIONS, LockService } from '../services/lock.service';
import { LockScreenComponent, LockScreenMode } from '../lock/lock-screen.component';

@Component({
    selector: 'app-setting',
    templateUrl: './setting.page.html',
    styleUrls: ['./setting.page.scss'],
    standalone: false,
})
export class SettingPage {
    readonly timeoutOptions = LOCK_TIMEOUT_OPTIONS;
    busy = false;

    constructor(
        public ipsu: IpsuService,
        public lock: LockService,
        private modalCtrl: ModalController,
    ) { }

    async ionViewWillEnter() {
        if (!this.ipsu.auth.status) return;
        await this.lock.LoadConfig();
        await this.lock.DetectBiometric();
    }

    async ToggleLock() {
        if (this.busy) return;
        this.busy = true;
        try {
            if (this.lock.config.enabled) {
                if (!(await this.OpenPinModal('verify'))?.verified) return;
                await this.lock.Disable();
                await this.ipsu.ShowToast(this.ipsu.T('setting.lock_disabled'));
            } else {
                const pin = (await this.OpenPinModal('setup'))?.pin;
                if (!pin) return;
                await this.lock.EnableWithPin(pin);
                await this.ipsu.ShowToast(this.ipsu.T('setting.lock_enabled'));
            }
        } finally {
            this.busy = false;
        }
    }

    async ToggleBiometric() {
        if (this.busy || !this.lock.biometricSupported) return;
        this.busy = true;
        try {
            if (this.lock.config.biometric) {
                await this.lock.SetBiometric(false);
                return;
            }
            if (await this.lock.AuthenticateBiometric()) {
                await this.lock.SetBiometric(true);
            } else {
                await this.ipsu.ShowToast(this.ipsu.T('setting.biometric_failed'));
            }
        } finally {
            this.busy = false;
        }
    }

    async ChooseTimeout(seconds: number) {
        if (this.lock.config.timeout === seconds) return;
        await this.lock.SetTimeout(seconds);
    }

    async ChangePin() {
        if (this.busy) return;
        this.busy = true;
        try {
            if (!(await this.OpenPinModal('verify'))?.verified) return;
            const pin = (await this.OpenPinModal('setup'))?.pin;
            if (!pin) return;
            await this.lock.ChangePin(pin);
            await this.ipsu.ShowToast(this.ipsu.T('setting.pin_changed'));
        } finally {
            this.busy = false;
        }
    }

    private async OpenPinModal(mode: LockScreenMode): Promise<any> {
        const modal = await this.modalCtrl.create({
            component: LockScreenComponent,
            componentProps: { mode },
            cssClass: 'lock-pin-modal',
            backdropDismiss: false,
        });
        await modal.present();
        const { data } = await modal.onDidDismiss();
        return data;
    }
}
