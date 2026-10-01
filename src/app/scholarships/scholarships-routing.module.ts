import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ScholarshipsPage } from './scholarships.page';

const routes: Routes = [
  {
    path: '',
    component: ScholarshipsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ScholarshipsPageRoutingModule {}
