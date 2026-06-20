import { CHECKER_IDS } from './types';
import { getRulesForChecker } from './catalog';

const severitySchema = {
  oneOf: [
    { enum: ['off', 'warn', 'error'] },
    { type: 'boolean' }
  ]
};

export function createAaetConfigSchema(): Record<string, unknown> {
  const checkerRules = Object.fromEntries(CHECKER_IDS.map(checker => [checker, {
    type: 'object',
    properties: Object.fromEntries(getRulesForChecker(checker).map(rule => [rule.id, severitySchema])),
    additionalProperties: false
  }]));

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://aaet.dev/schemas/aaet.config.schema.json',
    title: 'AAET Configuration',
    type: 'object',
    required: ['version', 'preset', 'layers', 'layerRestrictions', 'checkers'],
    properties: {
      $schema: { type: 'string' },
      version: { const: 2 },
      preset: { enum: ['recommended', 'strict'] },
      layers: { type: 'object', additionalProperties: { type: 'string' } },
      layerRestrictions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['from', 'cannotDependOn'],
          properties: {
            from: { type: 'string' },
            cannotDependOn: { type: 'array', items: { type: 'string' } }
          },
          additionalProperties: false
        }
      },
      checkers: {
        type: 'object',
        required: [...CHECKER_IDS],
        properties: {
          static: {
            type: 'object',
            required: ['enabled', 'rules', 'settings'],
            properties: {
              enabled: { type: 'boolean' },
              rules: checkerRules.static,
              settings: {
                type: 'object',
                required: ['maxAllowedDI', 'maxLines'],
                properties: {
                  maxAllowedDI: { type: 'integer', minimum: 1 },
                  maxLines: { type: 'integer', minimum: 1 }
                },
                additionalProperties: false
              }
            }
          },
          runtime: {
            type: 'object',
            required: ['enabled', 'rules', 'settings'],
            properties: {
              enabled: { type: 'boolean' },
              rules: checkerRules.runtime,
              settings: {
                type: 'object',
                required: ['stackDepth', 'samplingRate', 'slowMethodThresholdMs', 'maxCallFrequency', 'zoneThresholdMs', 'maxTicksPerSecond'],
                properties: {
                  stackDepth: { type: 'integer', minimum: 1 },
                  samplingRate: { type: 'number', minimum: 0, maximum: 1 },
                  slowMethodThresholdMs: { type: 'number', minimum: 0 },
                  maxCallFrequency: { type: 'integer', minimum: 1 },
                  zoneThresholdMs: { type: 'number', minimum: 0 },
                  maxTicksPerSecond: { type: 'integer', minimum: 1 }
                },
                additionalProperties: false
              }
            }
          },
          ai: {
            type: 'object',
            required: ['enabled', 'rules', 'settings'],
            properties: {
              enabled: { type: 'boolean' },
              rules: checkerRules.ai,
              settings: {
                type: 'object',
                required: ['provider', 'apiKeyEnv', 'autoAnalyze'],
                properties: {
                  provider: { enum: ['openai', 'anthropic'] },
                  endpointUrl: { type: 'string' },
                  apiKeyEnv: { type: 'string' },
                  customRules: { type: 'string' },
                  autoAnalyze: { type: 'boolean' }
                },
                additionalProperties: true
              }
            }
          }
        },
        additionalProperties: false
      }
    },
    additionalProperties: true
  };
}

export const AAET_CONFIG_SCHEMA = createAaetConfigSchema();
