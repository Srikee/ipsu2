import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ScholarshipsPageRoutingModule } from './scholarships-routing.module';

import { ScholarshipsPage } from './scholarships.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ScholarshipsPageRoutingModule
  ],
  declarations: [ScholarshipsPage]
})
export class ScholarshipsPageModule {}
