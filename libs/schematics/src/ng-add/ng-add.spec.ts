import { HostTree, SchematicContext } from '@angular-devkit/schematics';
import { describe, expect, it, vi } from 'vitest';
import { ngAdd } from './index';

function createContext(): SchematicContext {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      createChild: vi.fn()
    },
    addTask: vi.fn()
  } as unknown as SchematicContext;
}

describe('AAET ng-add schematic', () => {
  it('creates a V2 recommended static configuration', async () => {
    const tree = new HostTree();
    tree.create('/package.json', JSON.stringify({ scripts: {} }));
    const result = await ngAdd({ preset: 'recommended', checkers: ['static'], skipInstall: true })(tree, createContext()) as HostTree;
    const config = JSON.parse(result.read('/aaet.config.json')!.toString('utf8'));

    expect(config.version).toBe(2);
    expect(config.checkers.static.enabled).toBe(true);
    expect(config.checkers.runtime.enabled).toBe(false);
    expect(config.checkers.ai.enabled).toBe(false);
    expect(result.exists('/aaet.config.schema.json')).toBe(true);
    expect(JSON.parse(result.read('/package.json')!.toString('utf8')).scripts['aaet:check']).toBe('aaet check');
  });

  it('preserves custom fields and requires confirmation for existing files', async () => {
    const tree = new HostTree();
    tree.create('/aaet.config.json', JSON.stringify({
      customPlugin: { enabled: true },
      layers: {},
      layerRestrictions: [],
      limits: { maxAllowedDI: 4, maxLines: 500 }
    }));
    tree.create('/package.json', JSON.stringify({}));
    const skipped = await ngAdd({ preset: 'strict', skipInstall: true })(tree, createContext()) as HostTree;
    expect(JSON.parse(skipped.read('/aaet.config.json')!.toString('utf8')).version).toBeUndefined();

    const updated = await ngAdd({ preset: 'strict', yes: true, skipInstall: true })(tree, createContext()) as HostTree;
    const config = JSON.parse(updated.read('/aaet.config.json')!.toString('utf8'));
    expect(config.version).toBe(2);
    expect(config.customPlugin).toEqual({ enabled: true });
  });
});
