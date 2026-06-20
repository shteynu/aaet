import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import { AaetWebpackPlugin, ConfigManager, aaetEslintRule, getOrCreateConfigManager, handleAiCheckRequest, runStaticAnalysis, runStaticAnalysisForSourceFile } from '@aaet/core';
import { AiVerify, ProfileMethods, activeSubscriptions, analyzeViolationWithAi, clearActiveComponents, clearActiveSubscriptions, getActiveComponentsCount, getActiveSubscriptions, resetDiGuard, setupAaetRuntime, setupAiGuard, setupChangeDetectionGuard, setupDiGuard, setupRxjsComponentTracking, setupRxjsGuard, setupSignalGuard, setupZoneGuard } from '@aaet/runtime';
import { normalizeAaetConfig } from '@aaet/config';

describe('AAET Static Analysis Engine', () => {
  const projectRoot = path.resolve(__dirname, '../../..');

  it('should detect all violations in stub-component.ts and app.routes.ts', () => {
    const stubComponentFile = path.resolve(__dirname, '../fixtures/violations/stub-component.ts');
    const appRoutesFile = path.resolve(__dirname, '../fixtures/violations/app.routes.ts');

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

    // 9. ENFORCE_ONPUSH
    expect(ruleIds).toContain('ENFORCE_ONPUSH');
    const onPush = violations.find(v => v.ruleId === 'ENFORCE_ONPUSH');
    expect(onPush?.message).toContain('does not use "changeDetection: ChangeDetectionStrategy.OnPush"');

    // 10. UNSAFE_MANUAL_SUBSCRIBE
    expect(ruleIds).toContain('UNSAFE_MANUAL_SUBSCRIBE');
    const rxSubscribe = violations.find(v => v.ruleId === 'UNSAFE_MANUAL_SUBSCRIBE');
    expect(rxSubscribe?.message).toContain('Manual ".subscribe()" call detected');

    // 11. PLATFORM_ISOLATION_VIOLATION
    expect(ruleIds).toContain('PLATFORM_ISOLATION_VIOLATION');
    const platform = violations.find(v => v.ruleId === 'PLATFORM_ISOLATION_VIOLATION');
    expect(platform?.message).toContain('Direct access to global variable "window" is forbidden');

    // 12. MODERN_QUERY
    expect(ruleIds).toContain('MODERN_QUERY');
    const query = violations.find(v => v.ruleId === 'MODERN_QUERY');
    expect(query?.message).toContain('Legacy query decorator "@ViewChild');

    // 13. SWITCH_STRATEGY_SMELL
    expect(ruleIds).toContain('SWITCH_STRATEGY_SMELL');
    const switchSmell = violations.find(v => v.ruleId === 'SWITCH_STRATEGY_SMELL');
    expect(switchSmell?.message).toContain('Large switch statement (4 cases) detected');

    // 14. TIGHT_COUPLING_OBSERVER_SMELL
    expect(ruleIds).toContain('TIGHT_COUPLING_OBSERVER_SMELL');
    const couplingSmell = violations.find(v => v.ruleId === 'TIGHT_COUPLING_OBSERVER_SMELL');
    expect(couplingSmell?.message).toContain('accesses 3 different injected dependencies');

    // 15. ENFORCE_STANDALONE
    expect(ruleIds).toContain('ENFORCE_STANDALONE');
    const standalone = violations.find(v => v.ruleId === 'ENFORCE_STANDALONE');
    expect(standalone?.message).toContain('is not standalone');

    // 16. LEGACY_TEMPLATE_CONTROL_FLOW
    expect(ruleIds).toContain('LEGACY_TEMPLATE_CONTROL_FLOW');
    const controlFlow = violations.find(v => v.ruleId === 'LEGACY_TEMPLATE_CONTROL_FLOW');
    expect(controlFlow?.message).toContain('Legacy structural directive "*ngIf" detected');

    // Check that SafeComponent does not produce any PLATFORM_ISOLATION_VIOLATION errors (which start at line 80 of stub-component.ts)
    const safeComponentViolations = violations.filter(v => v.file.includes('stub-component.ts') && v.ruleId === 'PLATFORM_ISOLATION_VIOLATION' && v.line >= 80);
    expect(safeComponentViolations.length).toBe(0);
  });

  it('should pass dogfooding self-check on the libs/ directory', () => {
    const workspaceRoot = path.resolve(__dirname, '../../..');
    const violations = runStaticAnalysis(workspaceRoot);
    const libViolations = violations.filter(v => v.file.includes('/libs/'));
    
    // The AAET code itself should be completely clean
    expect(libViolations.length).toBe(0);
  });

  it('should parse Angular version from package.json correctly', () => {
    const mockDir = path.resolve(__dirname, 'mock-dir');
    if (!fs.existsSync(mockDir)) {
      fs.mkdirSync(mockDir);
    }
    const mockPkgPath = path.resolve(mockDir, 'package.json');
    fs.writeFileSync(mockPkgPath, JSON.stringify({
      dependencies: {
        '@angular/core': '^15.2.0'
      }
    }));

    try {
      const configManager = new ConfigManager(mockDir);
      expect(configManager.getAngularVersion()).toBe(15);
    } finally {
      if (fs.existsSync(mockPkgPath)) {
        fs.unlinkSync(mockPkgPath);
      }
      if (fs.existsSync(mockDir)) {
        fs.rmdirSync(mockDir);
      }
    }
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
    const durationWarningLogged = consoleWarnSpy.mock.calls.some(call =>
      call[0].includes('exceeding the threshold')
    );
    expect(durationWarningLogged).toBe(true);

    consoleWarnSpy.mockClear();

    component.fastMethod();
    component.fastMethod();
    component.fastMethod();
    component.fastMethod(); // 4 calls (> max 2)

    const frequencyWarningLogged = consoleWarnSpy.mock.calls.some(call =>
      call[0].includes('times in the last second')
    );
    expect(frequencyWarningLogged).toBe(true);

    consoleWarnSpy.mockRestore();
  });

  it('should detect RxJS subscription leaks at runtime', () => {
    class MockObservable {
      subscribe(cb: any) {
        return { unsubscribe: () => {} };
      }
    }

    setupRxjsGuard(MockObservable);

    const obs = new MockObservable();
    const sub = obs.subscribe(() => {});

    expect(getActiveSubscriptions().length).toBe(1);

    sub.unsubscribe();
    expect(getActiveSubscriptions().length).toBe(0);

    clearActiveSubscriptions();
  });

  it('should detect writable signal mutations inside computed context at runtime', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock Angular core-like signal/computed behaviors
    let currentComputation: (() => void) | null = null;
    const mockAngularCore = {
      signal: (val: any) => {
        return {
          val,
          set(v: any) {
            this.val = v;
          },
          update(fn: any) {
            this.val = fn(this.val);
          }
        };
      },
      computed: (computation: any) => {
        currentComputation = computation;
        computation();
        currentComputation = null;
        return {};
      }
    };

    setupSignalGuard(mockAngularCore);

    const mySignal = mockAngularCore.signal(0);
    
    // Normal set outside computed - no error
    mySignal.set(10);
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    // Set inside computed - error!
    mockAngularCore.computed(() => {
      mySignal.set(20);
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain('Writable signal mutation detected inside a computed context');

    consoleErrorSpy.mockRestore();
  });

  it('should warn when task inside NgZone blocks for too long at runtime', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mockAngularCore = {
      NgZone: class {
        run(fn: any) {
          return fn();
        }
      }
    };

    setupZoneGuard(mockAngularCore, 5); // 5ms threshold

    const zone = new mockAngularCore.NgZone();
    
    // Fast task - no warning
    zone.run(() => {});
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    // Slow task - warning!
    zone.run(() => {
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Deliberately block the event loop for the runtime guard fixture.
      }
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('exceeding the 5ms frame threshold');

    consoleWarnSpy.mockRestore();
  });
});

describe('AAET AI Guard & Verification Engine', () => {
  const projectRoot = path.resolve(__dirname, '../../..');
  it('should parse and detect aiGuard configurations in ConfigManager', () => {
    const configManager = new ConfigManager(path.resolve(__dirname, '../../..'));
    expect(configManager.getWorkspaceType()).toBe('nx');
    
    const fallbackConfigManager = new ConfigManager('/non-existent-dir-for-fallback');
    const fallbackConfig = fallbackConfigManager.getConfig();
    expect(fallbackConfig.checkers.ai.enabled).toBe(false);
    expect(fallbackConfig.checkers.ai.settings.provider).toBe('anthropic');
  });

  it('should call handleAiCheckRequest for Claude and OpenAI requests', async () => {
    // Mock global fetch
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: JSON.stringify({ explanation: 'Bad DI layering', suggestion: 'Use a Facade' }) }],
          choices: [{ message: { content: JSON.stringify({ explanation: 'Bad DI layering', suggestion: 'Use a Facade' }) } }]
        })
      } as any);
    });

    const payload = {
      ruleId: 'STRICT_LAYERING',
      violationMessage: 'Component injected API service directly',
      className: 'StubComponent',
      angularVersion: 19,
      workspaceType: 'nx' as const
    };

    // Test Claude provider
    const claudeRes = await handleAiCheckRequest(payload, 'mock-anthropic-key', 'anthropic');
    expect(claudeRes.explanation).toBe('Bad DI layering');
    expect(claudeRes.suggestion).toBe('Use a Facade');

    // Test OpenAI provider
    const openaiRes = await handleAiCheckRequest(payload, 'mock-openai-key', 'openai');
    expect(openaiRes.explanation).toBe('Bad DI layering');
    expect(openaiRes.suggestion).toBe('Use a Facade');

    fetchSpy.mockRestore();
  });

  it('should reject AI source paths outside the configured workspace', async () => {
    await expect(handleAiCheckRequest(
      { filePath: '../outside.ts', ruleId: 'STRICT_LAYERING' },
      'mock-key',
      'anthropic',
      { workspaceRoot: projectRoot }
    )).rejects.toThrow('must remain inside');
  });

  it('should execute setupAiGuard and intercept DI violation to trigger analyzeViolationWithAi', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          explanation: 'DI boundary violation detected',
          suggestion: 'Refactor using Facades'
        })
      } as any);
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Active AI Guard
    setupAiGuard({
      enabled: true,
      endpointUrl: 'http://localhost:3000/api/aaet-ai-check',
      angularVersion: 19,
      workspaceType: 'nx'
    });

    class ApiService {}
    class MockInjector {
      get(token: any): any {
        if (token.name === 'StubComponent') {
          this.get(ApiService);
        }
        return {};
      }
    }

    const mockAngularCore = {
      isDevMode: () => true,
      Injector: MockInjector
    };

    resetDiGuard();
    setupDiGuard({ layers: {}, layerRestrictions: [] }, mockAngularCore);

    class StubComponent {}
    const injector = new MockInjector();
    injector.get(StubComponent);

    // Wait a brief tick for async fetch in boundary violation to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(fetchSpy).toHaveBeenCalled();
    const fetchArgs = fetchSpy.mock.calls[0];
    expect(fetchArgs[0]).toBe('http://localhost:3000/api/aaet-ai-check');
    const body = JSON.parse(fetchArgs[1]?.body as string);
    expect(body.ruleId).toBe('STRICT_LAYERING');
    expect(body.className).toBe('StubComponent');

    fetchSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should run @AiVerify decorator and trigger analyzeViolationWithAi on instance initialization', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          explanation: 'Decorator audit passed',
          suggestion: ''
        })
      } as any);
    });

    // Configure and enable AI Guard
    setupAiGuard({
      enabled: true,
      endpointUrl: 'http://localhost:3000/api/aaet-ai-check'
    });

    @AiVerify({ filePath: 'src/my-comp.ts' })
    class MyVerifiedComponent {}

    new MyVerifiedComponent();

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(fetchSpy).toHaveBeenCalled();
    const fetchArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(fetchArgs[1]?.body as string);
    expect(body.ruleId).toBe('AI_VERIFY_DECORATOR');
    expect(body.className).toBe('MyVerifiedComponent');
    expect(body.filePath).toBe('src/my-comp.ts');

    fetchSpy.mockRestore();
  });

  it('should detect excessive change detection ticks at runtime', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mockAngularCore = {
      ApplicationRef: class {
        tick() {
          // Trigger tick
        }
      }
    };

    setupChangeDetectionGuard(mockAngularCore, 3); // 3 ticks limit

    const appRef = new mockAngularCore.ApplicationRef();
    appRef.tick();
    appRef.tick();
    appRef.tick();
    appRef.tick(); // 4th tick - should trigger warning

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('Excessive Change Detection loops detected');

    consoleWarnSpy.mockRestore();
  });

  it('should track component destruction and find leaked RxJS subscriptions', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create a mock Observable that mimics subscribe with stack trace
    class MockObservable {
      subscribe(cb: any) {
        // Register subscription with stack trace mimicking TestComponent
        const err = new Error();
        err.stack = 'Error\n    at TestComponent.ngOnInit (src/test.component.ts:10:12)';
        
        // Simulating the stack trace captured by setupRxjsGuard
        const sub = { unsubscribe: () => {} };
        activeSubscriptions.set(sub, {
          stack: err.stack,
          timestamp: Date.now()
        });

        const originalUnsubscribe = sub.unsubscribe;
        sub.unsubscribe = function() {
          activeSubscriptions.delete(sub);
        };
        return sub;
      }
    }

    class TestComponent {
      static ɵcmp = {
        onDestroy: function(ctx: any) {
          // Native Angular destroy
        }
      };
    }

    class MockInjector {
      get(token: any): any {
        if (token === TestComponent) {
          return new TestComponent();
        }
        return {};
      }
    }

    const mockAngularCore = {
      Injector: MockInjector
    };

    // Initialize RXJS guard and component tracking
    const obs = new MockObservable();
    const sub = obs.subscribe(() => {}); // Subscribed inside TestComponent context

    setupRxjsComponentTracking(mockAngularCore);

    const injector = new MockInjector();
    // Resolve instance - increments count and patches onDestroy
    const instance = injector.get(TestComponent);

    expect(getActiveComponentsCount()).toBe(1);

    // Call onDestroy (simulating Angular destroy)
    TestComponent.ɵcmp.onDestroy(instance);

    expect(getActiveComponentsCount()).toBe(0);
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('Component "TestComponent" was destroyed, but 1 active subscription(s) remain open!');

    // Cleanup subscription
    sub.unsubscribe();
    consoleWarnSpy.mockRestore();
    clearActiveComponents();
    clearActiveSubscriptions();
  });

  it('should support manual opt-in AI analysis via global aaet.analyze() and log styled console messages', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    setupAiGuard({
      enabled: true,
      autoAnalyze: false,
      endpointUrl: 'http://localhost:3000/api/aaet-ai-check'
    });
    
    try {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            explanation: 'On-demand explanation',
            suggestion: 'On-demand suggestion'
          })
        } as any);
      });

      await analyzeViolationWithAi({
        ruleId: 'MY_MANUAL_VIOLATION',
        message: 'This is a test warning',
        className: 'MyComponent'
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();

      const logCall = consoleLogSpy.mock.calls.find(call => call[0].includes('aaet.analyze'));
      expect(logCall).toBeDefined();

      const globalAaet = (globalThis as any).aaet;
      expect(globalAaet).toBeDefined();
      expect(typeof globalAaet.analyze).toBe('function');

      const res = await globalAaet.analyze(1);
      expect(fetchSpy).toHaveBeenCalled();
      expect(res.explanation).toBe('On-demand explanation');

      fetchSpy.mockRestore();
    } finally {
      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    }
  });

  it('should support configurable stackDepth and samplingRate for RxJS Guard', () => {
    class MockObservable {
      subscribe(cb: any) {
        return { unsubscribe: () => {} };
      }
    }

    setupRxjsGuard(MockObservable, { samplingRate: 0 });

    const obs = new MockObservable();
    const sub = obs.subscribe(() => {});

    expect(getActiveSubscriptions().length).toBe(0);

    setupRxjsGuard(MockObservable, { samplingRate: 1, stackDepth: 3 });
    const sub2 = obs.subscribe(() => {});
    const active = getActiveSubscriptions();
    expect(active.length).toBe(1);
    
    const lines = active[0].stack.split('\n');
    expect(lines.length).toBeLessThanOrEqual(4); 

    sub2.unsubscribe();
    clearActiveSubscriptions();
  });

  it('should queue concurrent AI requests and deduplicate duplicate violation reports', async () => {
    let activeFetches = 0;
    let maxConcurrentFetches = 0;
    let totalFetchCalls = 0;

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      activeFetches++;
      maxConcurrentFetches = Math.max(maxConcurrentFetches, activeFetches);
      await new Promise(resolve => setTimeout(resolve, 30));
      activeFetches--;
      totalFetchCalls++;
      return {
        ok: true,
        json: () => Promise.resolve({ explanation: 'Resolved', suggestion: '' })
      } as any;
    });

    setupAiGuard({
      enabled: true,
      autoAnalyze: true,
      endpointUrl: 'http://localhost:3000/api/aaet-ai-check'
    });

    // Fire 3 calls concurrently (2 are duplicates, 1 is distinct)
    const p1 = analyzeViolationWithAi({
      ruleId: 'QUEUE_RULE',
      message: 'Violation 1',
      className: 'QueueComponent'
    });

    const p2 = analyzeViolationWithAi({
      ruleId: 'QUEUE_RULE', // Duplicate of p1
      message: 'Violation 2',
      className: 'QueueComponent'
    });

    const p3 = analyzeViolationWithAi({
      ruleId: 'QUEUE_RULE_DISTINCT', // Distinct violation
      message: 'Violation 3',
      className: 'DistinctComponent'
    });

    const results = await Promise.all([p1, p2, p3]);

    // Max concurrent fetches must be 1 (serialized queue!)
    expect(maxConcurrentFetches).toBe(1);
    
    // Total fetch calls should be 2 (p1 and p3. p2 was skipped as a duplicate!)
    expect(totalFetchCalls).toBe(2);

    expect(results[0]?.explanation).toBe('Resolved');
    expect(results[1]?.explanation).toContain('Duplicate skipped');
    expect(results[2]?.explanation).toBe('Resolved');

    fetchSpy.mockRestore();
  });

  it('should support ConfigManager cache invalidation and dev-server plugin hooks', () => {
    const configManager = getOrCreateConfigManager(projectRoot);
    
    // Invalidate file
    configManager.invalidateFile('non-existent.ts');

    const testFile = path.resolve(projectRoot, 'libs/core/src/index.ts');
    const layers = configManager.getFileLayers(testFile);
    expect(layers).toBeDefined();

    configManager.invalidateFile(testFile);
    
    // Webpack watch-run invalidation callback check
    const webpackPlugin = new AaetWebpackPlugin();
    let callbackTriggered = false;
    const mockCompiler = {
      hooks: {
        watchRun: {
          tap: (name: string, callback: any) => {
            const mockWatching = {
              watchFileSystem: {
                watcher: {
                  mtimes: {
                    [testFile]: Date.now()
                  }
                }
              }
            };
            callback(mockWatching);
            callbackTriggered = true;
          }
        }
      }
    };
    webpackPlugin.apply(mockCompiler);
    expect(callbackTriggered).toBe(true);
  });

  it('should run custom ESLint rule utilizing parserServices.program to report violations', () => {
    const mockReport = vi.fn();
    const testFile = path.resolve(projectRoot, 'apps/demo-app/fixtures/violations/stub-component.ts');
    
    const content = fs.readFileSync(testFile, 'utf8');
    const sourceFile = ts.createSourceFile(
      testFile,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    const mockProgram = {
      getSourceFile: (filePath: string) => {
        if (filePath === testFile) return sourceFile;
        return null;
      }
    };

    const mockContext = {
      getFilename: () => testFile,
      getCwd: () => projectRoot,
      parserServices: {
        program: mockProgram
      },
      report: mockReport
    };

    aaetEslintRule.create(mockContext);

    expect(mockReport).toHaveBeenCalled();
    const reports = mockReport.mock.calls.map(call => call[0].message);
    expect(reports.some(msg => msg.includes('ENFORCE_STANDALONE') || msg.includes('ENFORCE_ONPUSH'))).toBe(true);
  });

  describe('AAET Checker Configuration & Dynamic Disabling', () => {
    it('should respect disabled static rules and not report violations for them', () => {
      const stubComponentFile = path.resolve(__dirname, '../fixtures/violations/stub-component.ts');
      const content = fs.readFileSync(stubComponentFile, 'utf8');
      const sourceFile = ts.createSourceFile(
        stubComponentFile,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const customConfigManager = new ConfigManager(projectRoot);
      vi.spyOn(customConfigManager, 'getConfig').mockReturnValue(normalizeAaetConfig({
        layers: { ui: '**/*component.ts' },
        layerRestrictions: [],
        limits: { maxAllowedDI: 3, maxLines: 400 },
        checkers: {
          static: {
            enabled: true,
            rules: {
              ENFORCE_STANDALONE: false,
              ENFORCE_ONPUSH: false
            }
          }
        }
      }));

      const violations = runStaticAnalysisForSourceFile(sourceFile, stubComponentFile, customConfigManager);
      const ruleIds = violations.map(v => v.ruleId);
      expect(ruleIds).not.toContain('ENFORCE_STANDALONE');
      expect(ruleIds).not.toContain('ENFORCE_ONPUSH');
    });

    it('should skip static analysis entirely if static checker is disabled', () => {
      const stubComponentFile = path.resolve(__dirname, '../fixtures/violations/stub-component.ts');
      const content = fs.readFileSync(stubComponentFile, 'utf8');
      const sourceFile = ts.createSourceFile(
        stubComponentFile,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const customConfigManager = new ConfigManager(projectRoot);
      vi.spyOn(customConfigManager, 'getConfig').mockReturnValue(normalizeAaetConfig({
        layers: { ui: '**/*component.ts' },
        layerRestrictions: [],
        limits: { maxAllowedDI: 3, maxLines: 400 },
        checkers: {
          static: {
            enabled: false
          }
        }
      }));

      const violations = runStaticAnalysisForSourceFile(sourceFile, stubComponentFile, customConfigManager);
      expect(violations.length).toBe(0);
    });

    it('should respect checkers.runtime.enabled === false in setupAaetRuntime and not trigger warnings', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      resetDiGuard();

      const config = {
        layers: { ui: '**/*component.ts', api: '**/*api.service.ts' },
        layerRestrictions: [{ from: 'ui', cannotDependOn: ['api'] }],
        checkers: {
          runtime: {
            enabled: false
          }
        }
      };

      class MockInjector {
        get(token: any): any {
          if (token.name === 'StubComponent') {
            this.get({ name: 'ApiService' });
          }
          return {};
        }
      }

      const mockAngularCore = {
        isDevMode: () => true,
        Injector: MockInjector
      };

      const controller = setupAaetRuntime(config, mockAngularCore);

      class StubComponent {}
      const injector = new MockInjector();
      injector.get(StubComponent);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      controller.teardown();
      consoleErrorSpy.mockRestore();
    });

    it('should restore runtime patches during teardown', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      class ApiService {}
      class MockInjector {
        get(token: any): any {
          if (token.name === 'TrackedComponent') this.get(ApiService);
          return {};
        }
      }
      const angularCore = { isDevMode: () => true, Injector: MockInjector };
      const controller = setupAaetRuntime({
        preset: 'strict',
        layers: { ui: '**/*component.ts', api: '**/*api.service.ts' },
        layerRestrictions: [{ from: 'ui', cannotDependOn: ['api'] }],
        checkers: { runtime: { enabled: true } }
      }, angularCore);
      class TrackedComponent {}
      const injector = new MockInjector();

      injector.get(TrackedComponent);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      controller.teardown();
      injector.get(TrackedComponent);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      consoleErrorSpy.mockRestore();
    });

    it('should tear down the previous controller when runtime is reconfigured', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      class ApiService {}
      class MockInjector {
        get(token: any): any {
          if (token.name === 'ReconfiguredComponent') this.get(ApiService);
          return {};
        }
      }
      const angularCore = { isDevMode: () => true, Injector: MockInjector };
      setupAaetRuntime({ preset: 'strict', checkers: { runtime: { enabled: true } } }, angularCore);
      const disabledController = setupAaetRuntime({ checkers: { runtime: { enabled: false } } }, angularCore);
      class ReconfiguredComponent {}

      new MockInjector().get(ReconfiguredComponent);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      disabledController.teardown();
      consoleErrorSpy.mockRestore();
    });
  });
});
