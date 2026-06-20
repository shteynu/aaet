#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import {
  AAET_CONFIG_SCHEMA,
  AaetPreset,
  CHECKER_IDS,
  CheckerId,
  ConfigureOptions,
  EffectiveAaetConfig,
  RULE_CATALOG,
  buildAaetConfig,
  createDefaultConfig,
  formatConfigDiff,
  getRulesForChecker,
  mergeAaetConfig,
  serializeAaetConfig,
  validateAaetConfig
} from '@aaet/config';
import { runStaticAnalysis } from './index';

export interface PromptAdapter {
  ask(question: string): Promise<string>;
  write(message: string): void;
  close(): void;
}

export class ReadlinePromptAdapter implements PromptAdapter {
  private readonly interface: readline.Interface;

  constructor(input: NodeJS.ReadableStream = process.stdin, output: NodeJS.WritableStream = process.stdout) {
    this.interface = readline.createInterface({ input, output });
  }

  ask(question: string): Promise<string> {
    return new Promise(resolve => this.interface.question(question, answer => resolve(answer.trim())));
  }

  write(message: string): void {
    this.interface.write(message);
  }

  close(): void {
    this.interface.close();
  }
}

interface ParsedArguments extends ConfigureOptions {
  command: string;
  interactive?: boolean;
  yes: boolean;
  paths: string[];
}

export interface CliDependencies {
  cwd?: string;
  stdout?: Pick<NodeJS.WriteStream, 'write'>;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
  prompt?: PromptAdapter;
  isTty?: boolean;
}

function parseArguments(argv: string[]): ParsedArguments {
  const command = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'check';
  const args = command === argv[0] ? argv.slice(1) : argv;
  const result: ParsedArguments = { command, yes: false, paths: [], enableRules: [], disableRules: [] };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const [flag, inlineValue] = arg.split('=', 2);
    const takeValue = (): string => inlineValue ?? args[++index] ?? '';
    if (flag === '--interactive') {
      result.interactive = takeValue() !== 'false';
    } else if (flag === '--preset') {
      result.preset = takeValue() as AaetPreset;
    } else if (flag === '--checkers') {
      result.checkers = takeValue().split(',').filter(Boolean) as CheckerId[];
    } else if (flag === '--enable-rule') {
      result.enableRules!.push(takeValue());
    } else if (flag === '--disable-rule') {
      result.disableRules!.push(takeValue());
    } else if (flag === '--yes' || flag === '-y') {
      result.yes = true;
    } else if (!arg.startsWith('-')) {
      result.paths.push(arg);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return result;
}

function parseCheckerSelection(answer: string, fallback: CheckerId[]): CheckerId[] | null {
  if (!answer) return fallback;
  const values = answer.split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  const byNumber: Record<string, CheckerId> = { '1': 'static', '2': 'runtime', '3': 'ai' };
  const selected = values.map(value => byNumber[value] ?? value as CheckerId);
  return selected.every(value => CHECKER_IDS.includes(value)) ? [...new Set(selected)] : null;
}

async function askUntil<T>(prompt: PromptAdapter, question: string, parse: (answer: string) => T | null): Promise<T> {
  while (true) {
    const parsed = parse(await prompt.ask(question));
    if (parsed !== null) return parsed;
    prompt.write('Invalid value. Please try again.\n');
  }
}

function positiveInteger(answer: string, fallback: number): number | null {
  if (!answer) return fallback;
  const value = Number(answer);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function nonNegativeNumber(answer: string, fallback: number): number | null {
  if (!answer) return fallback;
  const value = Number(answer);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function samplingRate(answer: string, fallback: number): number | null {
  const value = nonNegativeNumber(answer, fallback);
  return value !== null && value <= 1 ? value : null;
}

function yes(answer: string, fallback = false): boolean | null {
  if (!answer) return fallback;
  if (/^(y|yes)$/i.test(answer)) return true;
  if (/^(n|no)$/i.test(answer)) return false;
  return null;
}

export async function configureInteractively(
  existing: unknown,
  prompt: PromptAdapter,
  initialOptions: ConfigureOptions = {},
  autoConfirm = false
): Promise<{ config: EffectiveAaetConfig; confirmed: boolean; diff: string }> {
  let config = buildAaetConfig(existing, initialOptions);
  const preset = await askUntil(prompt, `Preset [recommended/strict] (${config.preset}): `, answer => {
    if (!answer) return config.preset;
    return answer === 'recommended' || answer === 'strict' ? answer : null;
  });
  config = buildAaetConfig(config, { preset });

  const currentCheckers = CHECKER_IDS.filter(checker => config.checkers[checker].enabled);
  prompt.write('Checkers: [1] static [2] runtime (experimental) [3] AI\n');
  const checkers = await askUntil(
    prompt,
    `Enabled checkers, comma-separated (${currentCheckers.join(',')}): `,
    answer => parseCheckerSelection(answer, currentCheckers)
  );
  config = buildAaetConfig(config, { checkers });

  for (const checker of checkers) {
    const customize = await askUntil(prompt, `Customize ${checker} rules? [y/N]: `, answer => yes(answer, false));
    if (!customize) continue;
    const definitions = getRulesForChecker(checker);
    prompt.write(`${definitions.map((rule, index) => `[${index + 1}] ${rule.id} — ${rule.description}`).join('\n')}\n`);
    const enabledByDefault = definitions.filter(rule => config.checkers[checker].rules[rule.id] !== 'off').map(rule => rule.id);
    const selectedRules = await askUntil(prompt, `Enabled rule numbers (${enabledByDefault.join(',')}): `, answer => {
      if (!answer) return enabledByDefault;
      const indices = answer.split(',').map(value => Number.parseInt(value.trim(), 10) - 1);
      return indices.every(index => Number.isInteger(index) && definitions[index])
        ? indices.map(index => definitions[index].id)
        : null;
    });
    const selectedSet = new Set(selectedRules);
    config = mergeAaetConfig(config, {
      checkers: {
        [checker]: {
          rules: Object.fromEntries(definitions.map(rule => [
            rule.id,
            selectedSet.has(rule.id) ? (rule[config.preset] === 'off' ? 'warn' : rule[config.preset]) : 'off'
          ]))
        }
      }
    });
  }

  if (config.checkers.static.enabled) {
    const settings = config.checkers.static.settings;
    config = buildAaetConfig(config, { staticSettings: {
      maxAllowedDI: await askUntil(prompt, `Maximum injected dependencies (${settings.maxAllowedDI}): `, answer => positiveInteger(answer, settings.maxAllowedDI)),
      maxLines: await askUntil(prompt, `Maximum lines per file (${settings.maxLines}): `, answer => positiveInteger(answer, settings.maxLines))
    } });
  }

  if (config.checkers.runtime.enabled) {
    const settings = config.checkers.runtime.settings;
    config = buildAaetConfig(config, { runtimeSettings: {
      stackDepth: await askUntil(prompt, `RxJS stack depth (${settings.stackDepth}): `, answer => positiveInteger(answer, settings.stackDepth)),
      samplingRate: await askUntil(prompt, `RxJS sampling rate 0–1 (${settings.samplingRate}): `, answer => samplingRate(answer, settings.samplingRate)),
      slowMethodThresholdMs: await askUntil(prompt, `Slow method threshold ms (${settings.slowMethodThresholdMs}): `, answer => nonNegativeNumber(answer, settings.slowMethodThresholdMs)),
      maxCallFrequency: await askUntil(prompt, `Maximum calls per second (${settings.maxCallFrequency}): `, answer => positiveInteger(answer, settings.maxCallFrequency)),
      zoneThresholdMs: await askUntil(prompt, `Zone task threshold ms (${settings.zoneThresholdMs}): `, answer => nonNegativeNumber(answer, settings.zoneThresholdMs)),
      maxTicksPerSecond: await askUntil(prompt, `Maximum change-detection ticks/sec (${settings.maxTicksPerSecond}): `, answer => positiveInteger(answer, settings.maxTicksPerSecond))
    } });
  }

  if (config.checkers.ai.enabled) {
    const settings = config.checkers.ai.settings;
    const provider = await askUntil(prompt, `AI provider [anthropic/openai] (${settings.provider}): `, answer => {
      if (!answer) return settings.provider;
      return answer === 'anthropic' || answer === 'openai' ? answer : null;
    });
    const endpointUrl = await prompt.ask(`Proxy endpoint (${settings.endpointUrl ?? 'none'}): `) || settings.endpointUrl;
    const defaultEnv = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    const apiKeyEnv = await prompt.ask(`Server-side API-key environment variable (${settings.apiKeyEnv || defaultEnv}): `) || settings.apiKeyEnv || defaultEnv;
    const autoAnalyze = await askUntil(prompt, `Automatically request AI analysis? [y/N]: `, answer => yes(answer, settings.autoAnalyze));
    config = buildAaetConfig(config, { aiSettings: { provider, endpointUrl, apiKeyEnv, autoAnalyze } });
  }

  const diff = formatConfigDiff(existing, config);
  prompt.write(`\nConfiguration changes:\n${diff}\n`);
  const confirmed = autoConfirm || await askUntil(prompt, 'Write this configuration? [y/N]: ', answer => yes(answer, false));
  return { config, confirmed, diff };
}

function validateCliSelections(args: ParsedArguments): void {
  if (args.preset && args.preset !== 'recommended' && args.preset !== 'strict') {
    throw new Error('Preset must be recommended or strict.');
  }
  const invalidChecker = args.checkers?.find(checker => !CHECKER_IDS.includes(checker));
  if (invalidChecker) throw new Error(`Unknown checker: ${invalidChecker}`);
  for (const ruleId of [...(args.enableRules ?? []), ...(args.disableRules ?? [])]) {
    if (!RULE_CATALOG.some(rule => rule.id === ruleId)) throw new Error(`Unknown rule: ${ruleId}`);
  }
}

export async function runCli(argv: string[], dependencies: CliDependencies = {}): Promise<number> {
  const cwd = dependencies.cwd ?? process.cwd();
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  try {
    const args = parseArguments(argv);
    validateCliSelections(args);
    if (args.command === 'check') {
      const requestedFiles = args.paths.length ? args.paths.map(file => path.resolve(cwd, file)) : undefined;
      const violations = runStaticAnalysis(cwd, requestedFiles);
      for (const violation of violations) {
        stdout.write(`[${violation.severity ?? 'error'}] ${violation.ruleId} ${path.relative(cwd, violation.file)}:${violation.line}:${violation.character} ${violation.message}\n`);
      }
      return violations.some(violation => (violation.severity ?? 'error') === 'error') ? 1 : 0;
    }
    if (args.command !== 'init' && args.command !== 'configure') {
      throw new Error(`Unknown command: ${args.command}. Use init, configure, or check.`);
    }

    const configPath = path.resolve(cwd, 'aaet.config.json');
    const schemaPath = path.resolve(cwd, 'aaet.config.schema.json');
    const exists = fs.existsSync(configPath);
    const existing = exists ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : createDefaultConfig();
    let config = buildAaetConfig(existing, args);
    const interactive = args.interactive ?? dependencies.isTty ?? Boolean(process.stdin.isTTY);
    let confirmed = !exists || args.yes;

    if (interactive) {
      const prompt = dependencies.prompt ?? new ReadlinePromptAdapter();
      try {
        const result = await configureInteractively(existing, prompt, args, args.yes);
        config = result.config;
        confirmed = result.confirmed;
      } finally {
        if (!dependencies.prompt) prompt.close();
      }
    } else if (exists && !args.yes) {
      stdout.write(`${formatConfigDiff(existing, config)}\n`);
      stderr.write('Existing configuration was not changed. Re-run with --yes or use an interactive terminal.\n');
      return 2;
    }

    if (!confirmed) {
      stdout.write('Configuration unchanged.\n');
      return 0;
    }
    const issues = validateAaetConfig(config).filter(issue => issue.severity === 'error');
    if (issues.length) throw new Error(issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
    fs.writeFileSync(configPath, serializeAaetConfig(config), 'utf8');
    fs.writeFileSync(schemaPath, `${JSON.stringify(AAET_CONFIG_SCHEMA, null, 2)}\n`, 'utf8');
    stdout.write(`${exists ? 'Updated' : 'Created'} ${configPath}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

if (require.main === module) {
  void runCli(process.argv.slice(2)).then(code => {
    process.exitCode = code;
  });
}
