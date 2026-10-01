import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QuickMenuPage } from './quick-menu.page';

describe('QuickMenuPage', () => {
    let component: QuickMenuPage;
    let fixture: ComponentFixture<QuickMenuPage>;

    beforeEach(() => {
        fixture = TestBed.createComponent(QuickMenuPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
