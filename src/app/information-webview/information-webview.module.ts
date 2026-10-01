import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { InformationWebviewPageRoutingModule } from './information-webview-routing.module';

import { InformationWebviewPage } from './information-webview.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    InformationWebviewPageRoutingModule
  ],
  declarations: [InformationWebviewPage]
})
export class InformationWebviewPageModule {}
