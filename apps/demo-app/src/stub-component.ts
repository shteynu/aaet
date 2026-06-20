// Mock Angular elements so the file remains valid TypeScript without external package errors
export function Component(meta: any) { return (target: any) => {}; }
export function Input() { return (target: any, key: string) => {}; }
export function ViewChild(selector: any) { return (target: any, key: string) => {}; }
export function inject(token: any): any { return {} as any; }
export function afterRender(cb: () => void) {}
export function afterNextRender(cb: () => void) {}
export function isPlatformBrowser(platformId: any): boolean { return true; }
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
    <div *ngIf="true">Hello</div>
    <div *ngFor="let item of items">Item</div>
    <div>
      @defer {
        <app-stub-other></app-stub-other>
      }
    </div>
  `
})
export class StubComponent {
  @Input() userId!: string; // Modern Paradigm: Legacy decorator
  @ViewChild('myDiv') myDiv!: any; // Modern Query: Legacy query decorator

  state$ = new Subject<string>(); // Modern Paradigm: RxJS Subject in UI Component
  items: string[] = [];

  constructor(
    private apiService: ApiService, // Strict Layering: UI directly depends on API
    private facadeService: FacadeService
  ) {}

  serviceA = inject(ServiceA); // SOLID: 4 dependencies (exceeding limit of 3)
  serviceB = inject(ServiceB);

  // AI-Readiness: Explicit Token Economy violation (missing return type)
  getUsername() {
    // SSR/Hydration: Direct platform global usage (not inside afterRender)
    const token = window.localStorage.getItem('token');

    // RxJS: Unsafe manual subscription
    const dummyObservable = { subscribe: (cb: any) => ({ unsubscribe: () => {} }) };
    dummyObservable.subscribe(() => {});

    return 'User';
  }

  processPayment(type: string): void {
    switch (type) {
      case 'credit':
        break;
      case 'debit':
        break;
      case 'paypal':
        break;
      case 'crypto':
        break;
    }
  }

  notifyAll(): void {
    const api = this.apiService;
    const facade = this.facadeService;
    const sa = this.serviceA;
  }
}

@Component({
  selector: 'app-safe',
  standalone: true,
  template: `<div>Safe Component</div>`
})
export class SafeComponent {
  constructor() {
    // Access global variables inside SSR-safe afterRender
    afterRender(() => {
      console.log(window.location.href);
    });
    afterNextRender(() => {
      console.log(localStorage.getItem('theme'));
    });
  }

  checkEnv(): void {
    // Access global variables inside SSR-safe isPlatformBrowser checks
    if (isPlatformBrowser('browser-id')) {
      const doc = document.title;
      localStorage.setItem('val', 'xyz');
    }
    
    const isSafe = isPlatformBrowser('browser-id') ? window.location.hash : '';
  }
}
