import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
    {
        path: '',
        component: TabsPage,
        children: [
            {
                path: 'home',
                loadChildren: () => import('../home/home.module').then(m => m.HomePageModule)
            },
            {
                path: 'message',
                loadChildren: () => import('../message/message.module').then(m => m.MessagePageModule)
            },
            {
                path: 'eboard',
                redirectTo: '/eboard',
                pathMatch: 'full'
            },
            {
                path: 'board',
                redirectTo: '/eboard',
                pathMatch: 'full'
            },
            {
                path: 'information',
                loadChildren: () => import('../information/information.module').then(m => m.InformationPageModule)
            },
            {
                path: 'profile',
                loadChildren: () => import('../profile/profile.module').then(m => m.ProfilePageModule)
            },
            {
                path: '',
                redirectTo: '/tabs/home',
                pathMatch: 'full'
            }
        ]
    },
    {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule { }
