import { describe, expect, it } from 'vitest';
import { CHECKER_IDS, RULE_CATALOG, buildAaetConfig, createDefaultConfig, isRuleEnabled, mergeAaetConfig, normalizeAaetConfig, serializeAaetConfig, validateAaetConfig } from './index';

describe('AAET configuration V2', () => {
  it('migrates V1 settings and keeps runtime and AI opt-in', () => {
    const migrated = normalizeAaetConfig({
      customField: { keep: true },
      limits: { maxAllowedDI: 7, maxLines: 900 },
      aiGuard: { enabled: true, provider: 'openai', apiKey: 'do-not-keep' }
    });

    expect(migrated.version).toBe(2);
    expect(migrated.checkers.static.settings).toEqual({ maxAllowedDI: 7, maxLines: 900 });
    expect(migrated.checkers.runtime.enabled).toBe(false);
    expect(migrated.checkers.ai.enabled).toBe(true);
    expect(migrated.customField).toEqual({ keep: true });
    expect(serializeAaetConfig(migrated)).not.toContain('do-not-keep');
  });

  it('preserves sampling rate zero and unknown custom fields when merging', () => {
    const merged = mergeAaetConfig(
      { ...createDefaultConfig(), plugin: { custom: 1 } },
      { checkers: { runtime: { enabled: true, settings: { samplingRate: 0 } } } }
    );

    expect(merged.checkers.runtime.settings.samplingRate).toBe(0);
    expect(merged.plugin).toEqual({ custom: 1 });
  });

  it('applies presets and explicit rule overrides', () => {
    const configured = buildAaetConfig({}, {
      preset: 'strict',
      checkers: ['static'],
      disableRules: ['ENFORCE_ONPUSH']
    });

    expect(configured.checkers.static.enabled).toBe(true);
    expect(configured.checkers.runtime.enabled).toBe(false);
    expect(configured.checkers.static.rules.ENFORCE_ONPUSH).toBe('off');
    expect(configured.checkers.static.rules.ENFORCE_STANDALONE).toBe('error');
  });

  it('reports unknown rules and plaintext secrets', () => {
    const issues = validateAaetConfig({
      version: 2,
      preset: 'recommended',
      checkers: { ai: { apiKey: 'secret', rules: { NOT_A_RULE: true } } }
    });

    expect(issues.some(issue => issue.message.includes('Unknown ai rule'))).toBe(true);
    expect(issues.some(issue => issue.message.includes('Inline API keys'))).toBe(true);
  });

  it('rejects invalid numeric settings without losing sampling rate zero', () => {
    const issues = validateAaetConfig({
      version: 2,
      preset: 'recommended',
      checkers: {
        static: { settings: { maxAllowedDI: 0 } },
        runtime: { settings: { samplingRate: 2, zoneThresholdMs: -1 } }
      }
    });
    expect(issues.map(issue => issue.path)).toContain('checkers.static.settings.maxAllowedDI');
    expect(issues.map(issue => issue.path)).toContain('checkers.runtime.settings.samplingRate');
    expect(issues.map(issue => issue.path)).toContain('checkers.runtime.settings.zoneThresholdMs');
    expect(validateAaetConfig({ checkers: { runtime: { settings: { samplingRate: 0 } } } })).toEqual([]);
  });

  it('honors explicit on/off values for every catalogued checker rule', () => {
    for (const checker of CHECKER_IDS) {
      for (const rule of RULE_CATALOG.filter(item => item.checker === checker)) {
        const enabled = mergeAaetConfig(createDefaultConfig(), {
          checkers: { [checker]: { enabled: true, rules: { [rule.id]: 'error' } } }
        });
        const disabled = mergeAaetConfig(enabled, {
          checkers: { [checker]: { rules: { [rule.id]: 'off' } } }
        });
        expect(isRuleEnabled(enabled, checker, rule.id)).toBe(true);
        expect(isRuleEnabled(disabled, checker, rule.id)).toBe(false);
      }
    }
  });
});
