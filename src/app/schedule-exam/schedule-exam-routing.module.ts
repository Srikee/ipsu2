import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ScheduleExamPage } from './schedule-exam.page';

const routes: Routes = [
  {
    path: '',
    component: ScheduleExamPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ScheduleExamPageRoutingModule {}
