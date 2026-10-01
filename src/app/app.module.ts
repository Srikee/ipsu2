import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { IonicStorageModule } from '@ionic/storage-angular';
// import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
// import { register } from 'swiper/element/bundle';
import { InAppBrowser } from '@awesome-cordova-plugins/in-app-browser/ngx';
import { LockModule } from './lock/lock.module';

// register();

@NgModule({
    declarations: [AppComponent],
    imports: [
        BrowserModule,
        IonicModule.forRoot({
            mode: 'md',
            scrollAssist: true,
            scrollPadding: true
        }),
        AppRoutingModule,
        HttpClientModule,
        IonicStorageModule.forRoot(),
        LockModule
    ],
    providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        InAppBrowser
    ],
    bootstrap: [AppComponent],
    // schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }
