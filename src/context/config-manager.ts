import * as fs from 'fs';
import * as path from 'path';
import { minimatch } from 'minimatch';

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
}

export class ConfigManager {
  private config: AaetConfig;
  private projectRoot: string;

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
        }
      };
    }
  }

  getConfig(): AaetConfig {
    return this.config;
  }

  getFileLayers(filePath: string): string[] {
    const relativePath = path.relative(this.projectRoot, filePath);
    const layers: string[] = [];
    for (const [layerName, globPattern] of Object.entries(this.config.layers)) {
      if (minimatch(relativePath, globPattern) || minimatch(filePath, globPattern)) {
        layers.push(layerName);
      }
    }
    return layers;
  }

  checkViolation(sourceFile: string, importedFile: string): { violates: boolean; fromLayer?: string; forbiddenLayer?: string } {
    const sourceLayers = this.getFileLayers(sourceFile);
    const importedLayers = this.getFileLayers(importedFile);

    for (const fromLayer of sourceLayers) {
      const restriction = this.config.layerRestrictions.find(r => r.from === fromLayer);
      if (restriction) {
        for (const forbiddenLayer of restriction.cannotDependOn) {
          if (importedLayers.includes(forbiddenLayer)) {
            return { violates: true, fromLayer, forbiddenLayer };
          }
        }
      }
    }

    return { violates: false };
  }
}
