import { Component } from '@angular/core';
import { Platform } from '@ionic/angular';

declare const IpsuDeeplink: any;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private platform: Platform) {
    this.platform.ready().then(() => this.initDeepLink());
  }

  async initDeepLink() {
    IpsuDeeplink.onOpenUrl((url: string) => this.handleDeepLink(url));

    const initialUrl = await IpsuDeeplink.getInitialUrlPromise();
    if (initialUrl) {
      this.handleDeepLink(initialUrl);
      IpsuDeeplink.clearInitialUrl();
    }
  }

  handleDeepLink(url: string) {
    console.log('[DEEPLINK]', url);
  }
}
