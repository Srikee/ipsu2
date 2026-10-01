import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { EboardDetailPageRoutingModule } from './eboard-detail-routing.module';
import { EboardDetailPage } from './eboard-detail.page';
import { EboardPostCardComponent } from '../eboard/eboard-post-card/eboard-post-card.component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        EboardDetailPageRoutingModule,
        EboardPostCardComponent
    ],
    declarations: [EboardDetailPage]
})
export class EboardDetailPageModule { }
