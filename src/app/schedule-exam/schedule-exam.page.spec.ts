import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { IpsuService } from '../services/ipsu.service';
import { ScheduleExamPage } from './schedule-exam.page';

describe('ScheduleExamPage', () => {
  let component: ScheduleExamPage;
  let fixture: ComponentFixture<ScheduleExamPage>;

  beforeEach(async () => {
    const ipsuMock = {
      auth: { status: false, psu_id: '' },
      language: 'th',
      isDarkTheme: false,
      T: (key: string) => key,
      Back: jasmine.createSpy('Back'),
      SetStorage: jasmine.createSpy('SetStorage'),
      GetStorage: jasmine.createSpy('GetStorage'),
      Ajax: jasmine.createSpy('Ajax'),
      ShowConfirm: jasmine.createSpy('ShowConfirm'),
      ShowToast: jasmine.createSpy('ShowToast'),
      UserStorageKey: (prefix: string, suffix: string) => `${prefix}-${suffix}`
    };

    await TestBed.configureTestingModule({
      declarations: [ScheduleExamPage],
      imports: [IonicModule.forRoot()],
      providers: [{ provide: IpsuService, useValue: ipsuMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleExamPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
