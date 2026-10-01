import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { QuickMenuPageRoutingModule } from './quick-menu-routing.module';
import { QuickMenuPage } from './quick-menu.page';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        QuickMenuPageRoutingModule
    ],
    declarations: [QuickMenuPage]
})
export class QuickMenuPageModule { }
