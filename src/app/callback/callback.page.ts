import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IpsuService } from '../services/ipsu.service';
import { PushService } from '../services/push.service';
import { AlertController } from '@ionic/angular';

@Component({
    selector: 'app-callback',
    templateUrl: './callback.page.html',
    styleUrls: ['./callback.page.scss'],
    standalone: false,
})
export class CallbackPage implements OnInit {
    code = "";
    state = "";
    constructor(
        private route: ActivatedRoute,
        public ipsu: IpsuService,
        private alertCtrl: AlertController,
        private pushService: PushService,
    ) { }
    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.code = params["code"] || "";
            this.state = params["state"] || "";
            this.Auth();
        });
    }
    Redirect(url: string) {
        if (url == "") {
            this.ipsu.LinkTo('/tabs/home', false);
        } else {
            this.alertCtrl.dismiss();
            this.ipsu.LinkTo(url, false);
        }
    }
    async Auth() {
        let url = await this.ipsu.GetStorage("ipsu-callback") || "";
        this.state = await this.ipsu.GetStorage("ipsu-state") || this.state;
        var platform = this.ipsu.GetPlatform();
        const redirect_uri = (platform == 'ios' || platform == 'android') ? 'ipsu://callback' : 'http://localhost:8100/callback';
        this.ipsu.Ajax(this.ipsu.api + "auth-profile.php", {
            code: this.code,
            state: this.state,
            redirect_uri: redirect_uri
        }, true).then(async (res: any) => {
            if (res.status == "ok") {
                this.ipsu.auth = {
                    status: true,
                    psu_id: res.profile.psu_id,
                    username: res.profile.username,
                    group: res.profile.group,           // staff, student
                    fullname_th: res.profile.fullname_th,
                    fullname_en: res.profile.fullname_en,
                    image: res.profile.image || '',
                };
                await this.ipsu.SetStorage("ipsu-auth", this.ipsu.auth);
                await this.ipsu.LoadUserPreferences(true);
                this.pushService.Login(this.ipsu.auth.username);
                void this.ipsu.RefreshUnreadMessageCount(true);
                this.Redirect(url);
            } else {
                this.Redirect(url);
            }
        }).catch(err => {
            this.Redirect(url);
        });
        await this.ipsu.RemoveStorage("ipsu-callback");
        await this.ipsu.RemoveStorage("ipsu-state");
    }
}
