import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PromptAdapter, configureInteractively, runCli } from './cli';

class FakePrompt implements PromptAdapter {
  readonly output: string[] = [];
  closed = false;

  constructor(private readonly answers: string[]) {}

  async ask(): Promise<string> {
    const answer = this.answers.shift();
    if (answer === undefined) throw new Error('Fake prompt ran out of answers.');
    return answer;
  }

  write(message: string): void {
    this.output.push(message);
  }

  close(): void {
    this.closed = true;
  }
}

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('AAET configuration CLI', () => {
  it('retries invalid numeric input and accepts sampling rate zero', async () => {
    const prompt = new FakePrompt([
      '', '1,2', 'n', 'n', '', '', '', 'not-a-rate', '0', '', '', '', '', 'y'
    ]);
    const result = await configureInteractively({ customPlugin: true }, prompt);

    expect(result.confirmed).toBe(true);
    expect(result.config.checkers.runtime.enabled).toBe(true);
    expect(result.config.checkers.runtime.settings.samplingRate).toBe(0);
    expect(result.config.customPlugin).toBe(true);
    expect(prompt.output.some(message => message.includes('Invalid value'))).toBe(true);
  });

  it('creates a non-interactive recommended configuration without secrets', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aaet-cli-'));
    temporaryDirectories.push(cwd);
    let output = '';
    const code = await runCli(['init', '--interactive=false'], {
      cwd,
      isTty: false,
      stdout: { write: value => { output += String(value); return true; } },
      stderr: { write: () => true }
    });

    expect(code).toBe(0);
    expect(output).toContain('Created');
    const configText = fs.readFileSync(path.join(cwd, 'aaet.config.json'), 'utf8');
    const config = JSON.parse(configText);
    expect(config.checkers.static.enabled).toBe(true);
    expect(config.checkers.runtime.enabled).toBe(false);
    expect(configText).not.toContain('"apiKey"');
  });

  it('previews but does not replace an existing file without confirmation', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aaet-cli-'));
    temporaryDirectories.push(cwd);
    const original = '{"custom":true}\n';
    fs.writeFileSync(path.join(cwd, 'aaet.config.json'), original);
    let error = '';
    const code = await runCli(['configure', '--interactive=false', '--preset', 'strict'], {
      cwd,
      isTty: false,
      stdout: { write: () => true },
      stderr: { write: value => { error += String(value); return true; } }
    });

    expect(code).toBe(2);
    expect(error).toContain('--yes');
    expect(fs.readFileSync(path.join(cwd, 'aaet.config.json'), 'utf8')).toBe(original);
  });

  it('supports cancellation without producing a configuration change', async () => {
    const prompt = new FakePrompt(['', '1', 'n', '', '', 'n']);
    const result = await configureInteractively({}, prompt);
    expect(result.confirmed).toBe(false);
  });
});
