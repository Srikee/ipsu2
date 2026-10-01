import { TestBed } from '@angular/core/testing';

import { IpsuService } from './ipsu.service';

describe('IpsuService', () => {
  let service: IpsuService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IpsuService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
