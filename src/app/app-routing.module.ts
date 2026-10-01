import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
    {
        path: '',
        loadChildren: () => import('./loading/loading.module').then(m => m.LoadingPageModule)
    },
    {
        path: 'title',
        loadChildren: () => import('./title/title.module').then(m => m.TitlePageModule)
    },
    {
        path: 'login',
        loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule)
    },
    {
        path: 'tabs',
        loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule)
    },
    {
        path: 'setting',
        loadChildren: () => import('./setting/setting.module').then(m => m.SettingPageModule)
    },
    {
        path: 'about',
        loadChildren: () => import('./about/about.module').then(m => m.AboutPageModule)
    },
    {
        path: 'information-webview',
        loadChildren: () => import('./information-webview/information-webview.module').then(m => m.InformationWebviewPageModule)
    },
    {
        path: 'callback',
        loadChildren: () => import('./callback/callback.module').then(m => m.CallbackPageModule)
    },
    {
        path: 'schedule',
        loadChildren: () => import('./schedule/schedule.module').then(m => m.SchedulePageModule)
    },
    {
        path: 'scholarships',
        loadChildren: () => import('./scholarships/scholarships.module').then( m => m.ScholarshipsPageModule)
    },
    {
        path: 'quick-menu',
        loadChildren: () => import('./quick-menu/quick-menu.module').then(m => m.QuickMenuPageModule)
    },
    {
        path: 'schedule-exam',
        loadChildren: () => import('./schedule-exam/schedule-exam.module').then(m => m.ScheduleExamPageModule)
    },
    {
        path: 'grade',
        loadChildren: () => import('./grade/grade.module').then(m => m.GradePageModule)
    },
    {
        path: 'eboard',
        loadChildren: () => import('./eboard/eboard.module').then(m => m.EboardPageModule)
    },
    {
        path: 'eboard/:id',
        loadChildren: () => import('./eboard-detail/eboard-detail.module').then(m => m.EboardDetailPageModule)
    },


];
@NgModule({
    imports: [
        RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
    ],
    exports: [RouterModule]
})
export class AppRoutingModule { }
