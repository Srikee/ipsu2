import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { GradePageRoutingModule } from './grade-routing.module';
import { GradePage } from './grade.page';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        GradePageRoutingModule
    ],
    declarations: [GradePage]
})
export class GradePageModule { }
