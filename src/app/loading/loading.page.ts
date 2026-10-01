import { Component } from '@angular/core';
import { IpsuService } from '../services/ipsu.service';

@Component({
    selector: 'app-loading',
    templateUrl: './loading.page.html',
    styleUrls: ['./loading.page.scss'],
    standalone: false
})
export class LoadingPage {

    constructor(
        public ipsu: IpsuService
    ) { }

}
