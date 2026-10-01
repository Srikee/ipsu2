import { Component, OnInit } from '@angular/core';
import { ModalController, NavController } from '@ionic/angular';
import { IpsuService } from '../services/ipsu.service';
import { LoginPage } from '../login/login.page';

@Component({
    selector: 'app-tabs',
    templateUrl: 'tabs.page.html',
    styleUrls: ['tabs.page.scss'],
    standalone: false,
})
export class TabsPage implements OnInit {

    constructor(
        public ipsu: IpsuService,
        private navCtrl: NavController,
        private modalController: ModalController,
    ) { }

    ngOnInit() {
        this.CheckAndLoadProfileImage();
        void this.ipsu.RefreshUnreadMessageCount(false);
    }

    ionViewWillEnter() {
        this.CheckAndLoadProfileImage();
        void this.ipsu.RefreshUnreadMessageCount(false);
    }

    async OpenEboard() {
        if (this.ipsu.auth.status) {
            this.navCtrl.navigateForward('/eboard');
            return;
        }

        this.ipsu.SetStorage('ipsu-callback', '/eboard');
        const rs = await this.ipsu.ShowConfirm(this.ipsu.T('eboard.login_required'));
        if (!rs) return;

        const modal = await this.modalController.create({ component: LoginPage });
        modal.onWillDismiss().then(() => {
            if (this.ipsu.auth.status) this.navCtrl.navigateForward('/eboard');
        });
        await modal.present();
    }

    async CheckAndLoadProfileImage() {
        if (this.ipsu.auth.status && !this.ipsu.auth.image) {
            try {
                const res: any = await this.ipsu.Ajax(this.ipsu.api + "user-profile.php", {
                    psu_id: this.ipsu.auth.psu_id,
                    username: this.ipsu.auth.username,
                    group: this.ipsu.auth.group,
                }, false);

                if (res && res.status === 'ok' && res.profile?.image) {
                    this.ipsu.auth.image = res.profile.image;
                    this.ipsu.SetStorage("ipsu-auth", this.ipsu.auth);
                }
            } catch (e) {
                // background load error ignored
            }
        }
    }
}
