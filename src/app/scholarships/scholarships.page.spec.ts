import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScholarshipsPage } from './scholarships.page';

describe('ScholarshipsPage', () => {
  let component: ScholarshipsPage;
  let fixture: ComponentFixture<ScholarshipsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ScholarshipsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
