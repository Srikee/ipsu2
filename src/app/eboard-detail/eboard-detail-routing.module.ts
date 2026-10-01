import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { EboardDetailPage } from './eboard-detail.page';

const routes: Routes = [
    {
        path: '',
        component: EboardDetailPage
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class EboardDetailPageRoutingModule { }
