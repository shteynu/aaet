import { ApiService } from './api.service';

export class FacadeService {
  constructor(private api: ApiService) {}

  getData(): string {
    return this.api.fetchData();
  }
}
