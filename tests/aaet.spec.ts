import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import { runStaticAnalysis } from '../src/index';
import { setupDiGuard } from '../src/runtime/di-guard';
import { ProfileMethods } from '../src/runtime/performance-guard';

describe('AAET Static Analysis Engine', () => {
  const projectRoot = path.resolve(__dirname, '..');

  it('should detect all violations in stub-component.ts and app.routes.ts', () => {
    const stubComponentFile = path.resolve(__dirname, 'stub-component.ts');
    const appRoutesFile = path.resolve(__dirname, 'app.routes.ts');

    const violations = runStaticAnalysis(projectRoot, [stubComponentFile, appRoutesFile]);

    expect(violations.length).toBeGreaterThan(0);

    const ruleIds = violations.map(v => v.ruleId);

    // 1. STRICT_LAYERING
    expect(ruleIds).toContain('STRICT_LAYERING');
    const layering = violations.find(v => v.ruleId === 'STRICT_LAYERING');
    expect(layering?.message).toContain('Layer boundary violation');

    // 2. MAX_DI_LIMIT
    expect(ruleIds).toContain('MAX_DI_LIMIT');
    const maxDi = violations.find(v => v.ruleId === 'MAX_DI_LIMIT');
    expect(maxDi?.message).toContain('exceeding the maximum allowed of 3');

    // 3. EXPLICIT_TOKEN_ECONOMY
    expect(ruleIds).toContain('EXPLICIT_TOKEN_ECONOMY');
    const tokenEconomy = violations.find(v => v.ruleId === 'EXPLICIT_TOKEN_ECONOMY');
    expect(tokenEconomy?.message).toContain('lacks an explicit return type');

    // 4. LEGACY_DECORATOR
    expect(ruleIds).toContain('LEGACY_DECORATOR');
    const decorator = violations.find(v => v.ruleId === 'LEGACY_DECORATOR');
    expect(decorator?.message).toContain('Legacy decorator "@Input()" is forbidden');

    // 5. FORBID_RAW_RXJS_UI
    expect(ruleIds).toContain('FORBID_RAW_RXJS_UI');
    const rxjs = violations.find(v => v.ruleId === 'FORBID_RAW_RXJS_UI');
    expect(rxjs?.message).toContain('Raw RxJS property "state$" of type/initializer "new Subject<string>()" is forbidden');

    // 6. TEMPLATE_METHOD_CALL
    expect(ruleIds).toContain('TEMPLATE_METHOD_CALL');
    const templateCall = violations.find(v => v.ruleId === 'TEMPLATE_METHOD_CALL');
    expect(templateCall?.message).toContain('Method call "getUsername()" detected');

    // 7. ROUTING_LAZY_LOAD_VIOLATION
    expect(ruleIds).toContain('ROUTING_LAZY_LOAD_VIOLATION');
    const routeViolation = violations.find(v => v.ruleId === 'ROUTING_LAZY_LOAD_VIOLATION');
    expect(routeViolation?.message).toContain('Static import of component "./stub-component" detected in routing file');

    // 8. DEFER_LAZY_LOAD_VIOLATION
    expect(ruleIds).toContain('DEFER_LAZY_LOAD_VIOLATION');
    const deferViolation = violations.find(v => v.ruleId === 'DEFER_LAZY_LOAD_VIOLATION');
    expect(deferViolation?.message).toContain('Static import of component "./stub-other.component" detected in a file utilizing "@defer"');
  });

  it('should pass dogfooding self-check on the src/ directory', () => {
    const violations = runStaticAnalysis(projectRoot);
    const srcViolations = violations.filter(v => v.file.includes('/src/'));
    
    // The AAET code itself should be completely clean
    expect(srcViolations.length).toBe(0);
  });
});

describe('AAET Runtime Validator', () => {
  it('should intercept dynamic boundary violations in setupDiGuard', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    class ApiService {}

    class MockInjector {
      get(token: any): any {
        if (token.name === 'StubComponent') {
          // Simulate constructor trigger which performs dependency resolution
          this.get(ApiService);
        }
        return {};
      }
    }

    const mockAngularCore = {
      isDevMode: () => true,
      Injector: MockInjector
    };

    setupDiGuard({ layers: {}, layerRestrictions: [] }, mockAngularCore);

    class StubComponent {}

    const injector = new MockInjector();
    
    // This will trigger nested dependency injection: StubComponent -> ApiService
    injector.get(StubComponent);

    expect(consoleErrorSpy).toHaveBeenCalled();
    const lastErrorMsg = consoleErrorSpy.mock.calls[0][0];
    expect(lastErrorMsg).toContain('Dynamic DI boundary violation detected');

    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should profile methods using ProfileMethods decorator', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    @ProfileMethods({ thresholdMs: 1, maxCallFrequency: 2 })
    class TestComponent {
      fastMethod(): string {
        return 'fast';
      }

      slowMethod(): string {
        const start = Date.now();
        while (Date.now() - start < 10) {
          // Block thread
        }
        return 'slow';
      }
    }

    const component = new TestComponent();

    component.slowMethod();
    expect(consoleWarnSpy).toHaveBeenCalled();
    let durationWarningLogged = consoleWarnSpy.mock.calls.some(call => 
      call[0].includes('exceeding the threshold')
    );
    expect(durationWarningLogged).toBe(true);

    consoleWarnSpy.mockClear();

    component.fastMethod();
    component.fastMethod();
    component.fastMethod();
    component.fastMethod(); // 4 calls (> max 2)

    let frequencyWarningLogged = consoleWarnSpy.mock.calls.some(call => 
      call[0].includes('times in the last second')
    );
    expect(frequencyWarningLogged).toBe(true);

    consoleWarnSpy.mockRestore();
  });
});
