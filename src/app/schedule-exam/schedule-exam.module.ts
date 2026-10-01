import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ScheduleExamPageRoutingModule } from './schedule-exam-routing.module';

import { ScheduleExamPage } from './schedule-exam.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ScheduleExamPageRoutingModule
  ],
  declarations: [ScheduleExamPage]
})
export class ScheduleExamPageModule {}
