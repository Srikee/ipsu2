import { Component, OnInit } from '@angular/core';
import { IpsuService } from '../services/ipsu.service';
import { register } from 'swiper/element/bundle';
register();

@Component({
    selector: 'app-title',
    templateUrl: './title.page.html',
    styleUrls: ['./title.page.scss'],
    standalone: false
})
export class TitlePage implements OnInit {

    constructor(
        public ipsu: IpsuService
    ) { }

    ngOnInit() {
    }

    async setLanguage(language: 'th' | 'en') {
        await this.ipsu.SetLanguage(language);
    }

    async GoToStart() {
        await this.ipsu.SetStorage("ipsu-title", true);
        this.ipsu.LinkTo("tabs/home", false);
    }
}
