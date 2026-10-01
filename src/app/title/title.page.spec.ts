import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TitlePage } from './title.page';

describe('TitlePage', () => {
  let component: TitlePage;
  let fixture: ComponentFixture<TitlePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TitlePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
