import { Component, OnInit, ViewChild } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular';
import { IpsuService } from '../services/ipsu.service';
import { PushService } from '../services/push.service';
import { InAppBrowser, InAppBrowserObject } from '@awesome-cordova-plugins/in-app-browser/ngx';

@Component({
    selector: 'app-login',
    templateUrl: './login.page.html',
    styleUrls: ['./login.page.scss'],
    standalone: false,
})
export class LoginPage implements OnInit {
    @ViewChild(IonContent) private content?: IonContent;

    auth: any = {
        username: '',
        password: ''
    };
    showPassword = false;
    private focusedField: HTMLElement | null = null;
    private focusScrollTimer?: ReturnType<typeof setTimeout>;
    private readonly keyboardWillShowHandler = (event: Event) => {
        void this.setKeyboardScrollSpace(this.getKeyboardHeight(event));
    };
    private readonly keyboardDidShowHandler = (event: Event) => {
        void this.setKeyboardScrollSpace(this.getKeyboardHeight(event));
        this.scheduleFocusedFieldScroll(50);
    };
    private readonly keyboardDidHideHandler = () => {
        void this.setKeyboardScrollSpace(0);
    };

    constructor(
        private iab: InAppBrowser,
        private modalController: ModalController,
        private pushService: PushService,
        public ipsu: IpsuService,
    ) { }

    ngOnInit() {
    }

    ionViewDidEnter() {
        window.addEventListener('keyboardWillShow', this.keyboardWillShowHandler);
        window.addEventListener('keyboardDidShow', this.keyboardDidShowHandler);
        window.addEventListener('keyboardDidHide', this.keyboardDidHideHandler);
    }

    ionViewWillLeave() {
        window.removeEventListener('keyboardWillShow', this.keyboardWillShowHandler);
        window.removeEventListener('keyboardDidShow', this.keyboardDidShowHandler);
        window.removeEventListener('keyboardDidHide', this.keyboardDidHideHandler);
        if (this.focusScrollTimer) {
            clearTimeout(this.focusScrollTimer);
        }
        void this.setKeyboardScrollSpace(0);
    }

    onInputFocus(event: CustomEvent) {
        this.focusedField = event.target as HTMLElement;
        // iOS applies the keyboard resize after its opening animation finishes.
        this.scheduleFocusedFieldScroll(450);
    }

    private scheduleFocusedFieldScroll(delay: number) {
        if (this.focusScrollTimer) {
            clearTimeout(this.focusScrollTimer);
        }

        this.focusScrollTimer = setTimeout(() => {
            void this.scrollFocusedFieldIntoView();
        }, delay);
    }

    private getKeyboardHeight(event: Event): number {
        const keyboardEvent = event as Event & { keyboardHeight?: number };
        const height = Number(keyboardEvent.keyboardHeight ?? 0);
        return Number.isFinite(height) && height > 0 ? height : 0;
    }

    private async setKeyboardScrollSpace(keyboardHeight: number) {
        if (!this.content) {
            return;
        }

        const scrollElement = await this.content.getScrollElement();
        if (keyboardHeight > 0) {
            // ResizeIonic changes ion-app's height but an Ionic modal can retain its
            // previous scroll viewport. Native keyboard space forces real overflow,
            // so username and password behave identically and remain touch-scrollable.
            scrollElement.style.paddingBottom = `calc(${Math.ceil(keyboardHeight)}px + env(safe-area-inset-bottom, 0px))`;
            scrollElement.style.overflowY = 'scroll';
            return;
        }

        scrollElement.style.removeProperty('padding-bottom');
        scrollElement.style.removeProperty('overflow-y');
    }

    private async scrollFocusedFieldIntoView() {
        if (!this.content || !this.focusedField) {
            return;
        }

        const scrollElement = await this.content.getScrollElement();
        const fieldBox = this.focusedField.closest('.input-group') as HTMLElement | null;
        const field = fieldBox ?? this.focusedField;
        const fieldRect = field.getBoundingClientRect();
        const scrollRect = scrollElement.getBoundingClientRect();
        const safeGap = 18;

        if (fieldRect.top < scrollRect.top + safeGap) {
            await this.content.scrollByPoint(0, fieldRect.top - scrollRect.top - safeGap, 220);
            return;
        }

        if (fieldRect.bottom > scrollRect.bottom - safeGap) {
            await this.content.scrollByPoint(0, fieldRect.bottom - scrollRect.bottom + safeGap, 220);
        }
    }

    Close(loggedIn = false) {
        this.modalController.dismiss({ loggedIn });
    }

    Login() {
        this.ipsu.Ajax(this.ipsu.api + "auth-login.php", {
            username: this.auth.username,
            password: this.auth.password,
        }, true).then(async (res: any) => {
            if (res.status === "ok") {
                this.ipsu.auth = {
                    status: true,
                    psu_id: res.profile.psu_id,
                    username: res.profile.username,
                    group: res.profile.group,     // staff, student
                    fullname_th: res.profile.fullname_th,
                    fullname_en: res.profile.fullname_en,
                    image: res.profile.image || '',
                };
                await this.ipsu.SetStorage("ipsu-auth", this.ipsu.auth);
                await this.ipsu.LoadUserPreferences(true);
                this.pushService.Login(this.ipsu.auth.username);
                void this.ipsu.RefreshUnreadMessageCount(true);
                this.Close(true);
            } else {
                this.ipsu.RemoveStorage("ipsu-auth");
                this.ipsu.auth.status = false;
                this.ipsu.ShowAlert(res.message);
            }
        }).catch(async error => {
            this.ipsu.ShowAlert(error);
        });
    }
    Reset() {
        this.auth.username = '';
        this.auth.password = '';
    }
    LoginSSO() {
        var platform = this.ipsu.GetPlatform();
        const clientId = 'JNPi0xv0YiE2LTfVghAIpOT3aBgrNbrioetos6wB';
        const redirectUri = (platform == 'ios' || platform == 'android') ? 'ipsu://callback' : 'http://localhost:8100/callback';
        const scope = 'openid profile email psu_profile';
        // alert(redirectUri)
        const state = this.ipsu.RandomString();
        this.ipsu.SetStorage("ipsu-state", state);
        const authUrl =
            `https://psusso.psu.ac.th/application/o/authorize/?` +
            `response_type=code&` +
            `client_id=${encodeURIComponent(clientId)}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `scope=${encodeURIComponent(scope)}&` +
            `state=${encodeURIComponent(state)}`;

        console.log('PSU SSO URL:', authUrl);

        // เปิด SSO โดยไม่ reload หน้าแอปหลัก
        var browserRef: InAppBrowserObject = this.iab.create(authUrl, '_system');
        this.Close();
    }
}
