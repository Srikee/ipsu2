import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { EboardPageRoutingModule } from './eboard-routing.module';
import { EboardPage } from './eboard.page';
import { EboardPostCardComponent } from './eboard-post-card/eboard-post-card.component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        EboardPageRoutingModule,
        EboardPostCardComponent
    ],
    declarations: [EboardPage]
})
export class EboardPageModule { }
