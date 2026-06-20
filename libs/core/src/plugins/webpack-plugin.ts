import { invalidateFileCache } from '../index';

export class AaetWebpackPlugin {
  apply(compiler: any): void {
    compiler.hooks.watchRun.tap('AaetWebpackPlugin', (watching: any) => {
      const changedFiles = watching.watchFileSystem?.watcher?.mtimes;
      if (changedFiles) {
        for (const filePath of Object.keys(changedFiles)) {
          if (filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')) {
            invalidateFileCache(filePath);
          }
        }
      }
    });
  }
}
