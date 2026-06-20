import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

export interface AiGuardConfig {
  enabled?: boolean;
  provider?: 'openai' | 'anthropic';
  apiKey?: string;
  endpointUrl?: string;
  customRules?: string;
  workspaceType?: 'nx' | 'standalone';
  angularVersion?: number;
}

export interface AaetConfig {
  layers: { [key: string]: string };
  layerRestrictions: Array<{
    from: string;
    cannotDependOn: string[];
  }>;
  limits: {
    maxAllowedDI: number;
    maxLines: number;
  };
  aiGuard?: AiGuardConfig;
}

export class ConfigManager {
  private config: AaetConfig;
  private projectRoot: string;
  private angularVersion: number = 19; // Default to v19
  private workspaceType: 'nx' | 'standalone' = 'standalone';

  // Performance Optimization Caches
  private fileLayersCache = new Map<string, string[]>();
  private violationCache = new Map<string, { violates: boolean; fromLayer?: string; forbiddenLayer?: string }>();
  private templateCache = new Map<string, string>();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    const configPath = path.resolve(projectRoot, 'aaet.config.json');
    if (fs.existsSync(configPath)) {
      try {
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (err) {
        throw new Error(`Failed to parse aaet.config.json: ${err}`);
      }
    } else {
      this.config = {
        layers: {
          ui: '**/*.component.ts',
          api: '**/*.api.service.ts',
          facade: '**/*.facade.service.ts'
        },
        layerRestrictions: [
          {
            from: 'ui',
            cannotDependOn: ['api']
          }
        ],
        limits: {
          maxAllowedDI: 3,
          maxLines: 400
        },
        aiGuard: {
          enabled: false,
          provider: 'anthropic',
          endpointUrl: '/api/aaet-ai-check'
        }
      };
    }

    // Detect Angular Version from package.json
    const packageJsonPath = path.resolve(projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const angularCoreVer = pkg.dependencies?.['@angular/core'] || pkg.devDependencies?.['@angular/core'];
        if (angularCoreVer) {
          const match = angularCoreVer.match(/\d+/);
          if (match) {
            this.angularVersion = parseInt(match[0], 10);
          }
        }
      } catch {
        // Fallback to default v19
      }
    }

    // Detect Workspace Type
    const nxJsonPath = path.resolve(projectRoot, 'nx.json');
    if (fs.existsSync(nxJsonPath)) {
      this.workspaceType = 'nx';
    } else {
      this.workspaceType = 'standalone';
    }
  }

  getAngularVersion(): number {
    return this.angularVersion;
  }

  getWorkspaceType(): 'nx' | 'standalone' {
    return this.workspaceType;
  }

  getConfig(): AaetConfig {
    return this.config;
  }

  getFileLayers(filePath: string): string[] {
    if (this.fileLayersCache.has(filePath)) {
      return this.fileLayersCache.get(filePath)!;
    }
    const relativePath = path.relative(this.projectRoot, filePath);
    const layers: string[] = [];
    for (const [layerName, globPattern] of Object.entries(this.config.layers)) {
      if (minimatch(relativePath, globPattern) || minimatch(filePath, globPattern)) {
        layers.push(layerName);
      }
    }
    this.fileLayersCache.set(filePath, layers);
    return layers;
  }

  checkViolation(sourceFile: string, importedFile: string): { violates: boolean; fromLayer?: string; forbiddenLayer?: string } {
    const cacheKey = `${sourceFile} -> ${importedFile}`;
    if (this.violationCache.has(cacheKey)) {
      return this.violationCache.get(cacheKey)!;
    }

    const sourceLayers = this.getFileLayers(sourceFile);
    const importedLayers = this.getFileLayers(importedFile);

    let result: { violates: boolean; fromLayer?: string; forbiddenLayer?: string } = { violates: false };

    for (const fromLayer of sourceLayers) {
      const restriction = this.config.layerRestrictions.find(r => r.from === fromLayer);
      if (restriction) {
        for (const forbiddenLayer of restriction.cannotDependOn) {
          if (importedLayers.includes(forbiddenLayer)) {
            result = { violates: true, fromLayer, forbiddenLayer };
            break;
          }
        }
      }
      if (result.violates) break;
    }

    this.violationCache.set(cacheKey, result);
    return result;
  }

  readTemplateFile(templatePath: string): string {
    if (this.templateCache.has(templatePath)) {
      return this.templateCache.get(templatePath)!;
    }
    const content = fs.readFileSync(templatePath, 'utf8');
    this.templateCache.set(templatePath, content);
    return content;
  }

  invalidateFile(filePath: string): void {
    this.fileLayersCache.delete(filePath);
    this.templateCache.delete(filePath);
    
    // Invalidate violation cache entries for this file
    for (const key of this.violationCache.keys()) {
      if (key.includes(filePath)) {
        this.violationCache.delete(key);
      }
    }
  }
}
