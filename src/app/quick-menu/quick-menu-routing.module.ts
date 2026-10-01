import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { QuickMenuPage } from './quick-menu.page';

const routes: Routes = [
    {
        path: '',
        component: QuickMenuPage
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class QuickMenuPageRoutingModule { }
