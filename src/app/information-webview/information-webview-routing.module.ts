import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { InformationWebviewPage } from './information-webview.page';

const routes: Routes = [
  {
    path: '',
    component: InformationWebviewPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class InformationWebviewPageRoutingModule {}
