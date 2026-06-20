import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';
import {
  EffectiveAaetConfig,
  normalizeAaetConfig,
  validateAaetConfig
} from '@aaet/config';

export type AaetConfig = EffectiveAaetConfig;
export type AiGuardConfig = Partial<EffectiveAaetConfig['checkers']['ai']['settings']> & {
  enabled?: boolean;
  apiKey?: string;
};

export function loadAaetConfig(projectRoot: string = process.cwd()): EffectiveAaetConfig {
  const configPath = path.resolve(projectRoot, 'aaet.config.json');
  const rawConfig = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};
  const errors = validateAaetConfig(rawConfig).filter(issue => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(`Invalid aaet.config.json:\n${errors.map(issue => `- ${issue.path}: ${issue.message}`).join('\n')}`);
  }
  return normalizeAaetConfig(rawConfig);
}

export class ConfigManager {
  private config: EffectiveAaetConfig;
  private projectRoot: string;
  private angularVersion = 19;
  private workspaceType: 'nx' | 'standalone' = 'standalone';

  private fileLayersCache = new Map<string, string[]>();
  private violationCache = new Map<string, { violates: boolean; fromLayer?: string; forbiddenLayer?: string }>();
  private templateCache = new Map<string, string>();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    try {
      this.config = loadAaetConfig(projectRoot);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Failed to parse aaet.config.json: ${error.message}`);
      }
      throw error;
    }

    const packageJsonPath = path.resolve(projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const angularCoreVersion = pkg.dependencies?.['@angular/core'] || pkg.devDependencies?.['@angular/core'];
        const match = typeof angularCoreVersion === 'string' ? angularCoreVersion.match(/\d+/) : null;
        if (match) this.angularVersion = Number.parseInt(match[0], 10);
      } catch {
        // A malformed package file must not prevent configuration fallback.
      }
    }

    this.workspaceType = fs.existsSync(path.resolve(projectRoot, 'nx.json')) ? 'nx' : 'standalone';
    this.config.checkers.ai.settings.angularVersion ??= this.angularVersion;
    this.config.checkers.ai.settings.workspaceType ??= this.workspaceType;
  }

  getAngularVersion(): number {
    return this.angularVersion;
  }

  getWorkspaceType(): 'nx' | 'standalone' {
    return this.workspaceType;
  }

  getConfig(): EffectiveAaetConfig {
    return this.config;
  }

  getFileLayers(filePath: string): string[] {
    const normalizedPath = path.resolve(filePath);
    const cached = this.fileLayersCache.get(normalizedPath);
    if (cached) return cached;

    const relativePath = path.relative(this.projectRoot, normalizedPath);
    const layers = Object.entries(this.config.layers)
      .filter(([, globPattern]) => minimatch(relativePath, globPattern) || minimatch(normalizedPath, globPattern))
      .map(([layerName]) => layerName);
    this.fileLayersCache.set(normalizedPath, layers);
    return layers;
  }

  checkViolation(sourceFile: string, importedFile: string): { violates: boolean; fromLayer?: string; forbiddenLayer?: string } {
    const normalizedSource = path.resolve(sourceFile);
    const normalizedImport = path.resolve(importedFile);
    const cacheKey = `${normalizedSource} -> ${normalizedImport}`;
    const cached = this.violationCache.get(cacheKey);
    if (cached) return cached;

    const sourceLayers = this.getFileLayers(normalizedSource);
    const importedLayers = this.getFileLayers(normalizedImport);
    let result: { violates: boolean; fromLayer?: string; forbiddenLayer?: string } = { violates: false };

    for (const fromLayer of sourceLayers) {
      const restriction = this.config.layerRestrictions.find(item => item.from === fromLayer);
      const forbiddenLayer = restriction?.cannotDependOn.find(layer => importedLayers.includes(layer));
      if (forbiddenLayer) {
        result = { violates: true, fromLayer, forbiddenLayer };
        break;
      }
    }

    this.violationCache.set(cacheKey, result);
    return result;
  }

  readTemplateFile(templatePath: string): string {
    const normalizedPath = path.resolve(templatePath);
    const cached = this.templateCache.get(normalizedPath);
    if (cached !== undefined) return cached;
    const content = fs.readFileSync(normalizedPath, 'utf8');
    this.templateCache.set(normalizedPath, content);
    return content;
  }

  invalidateFile(filePath: string): void {
    const normalizedPath = path.resolve(filePath);
    this.fileLayersCache.delete(normalizedPath);
    this.templateCache.delete(normalizedPath);
    for (const key of this.violationCache.keys()) {
      if (key.includes(normalizedPath)) this.violationCache.delete(key);
    }
  }
}
