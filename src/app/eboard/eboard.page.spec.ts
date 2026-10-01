import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EboardPage } from './eboard.page';

describe('EboardPage', () => {
    let component: EboardPage;
    let fixture: ComponentFixture<EboardPage>;

    beforeEach(() => {
        fixture = TestBed.createComponent(EboardPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
