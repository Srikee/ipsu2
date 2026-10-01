import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { EboardPage } from './eboard.page';

const routes: Routes = [
    {
        path: '',
        component: EboardPage
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class EboardPageRoutingModule { }
