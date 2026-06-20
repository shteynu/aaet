// Mock Angular elements so the file remains valid TypeScript without external package errors
export function Component(meta: any) { return (target: any) => {}; }
export function Input() { return (target: any, key: string) => {}; }
export function inject(token: any): any { return {} as any; }
export class Subject<T> {}
export class ServiceA {}
export class ServiceB {}

import { ApiService } from './api.service';
import { FacadeService } from './facade.service';
import { StubOtherComponent } from './stub-other.component'; // Statically importing while using @defer

@Component({
  selector: 'app-stub',
  template: `
    <div>{{ getUsername() }}</div>
    <div>
      @defer {
        <app-stub-other></app-stub-other>
      }
    </div>
  `
})
export class StubComponent {
  @Input() userId!: string; // Modern Paradigm: Legacy decorator

  state$ = new Subject<string>(); // Modern Paradigm: RxJS Subject in UI Component

  constructor(
    private apiService: ApiService, // Strict Layering: UI directly depends on API
    private facadeService: FacadeService
  ) {}

  serviceA = inject(ServiceA); // SOLID: 4 dependencies (exceeding limit of 3)
  serviceB = inject(ServiceB);

  // AI-Readiness: Explicit Token Economy violation (missing return type)
  getUsername() {
    return 'User';
  }
}
