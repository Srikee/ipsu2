import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InformationWebviewPage } from './information-webview.page';

describe('InformationWebviewPage', () => {
  let component: InformationWebviewPage;
  let fixture: ComponentFixture<InformationWebviewPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(InformationWebviewPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
