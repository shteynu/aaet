import { invalidateFileCache, runStaticAnalysis } from '../index';

export function aaetVitePlugin(projectRoot: string = process.cwd()) {
  return {
    name: 'vite-plugin-aaet',
    configureServer(server: any): void {
      server.watcher.on('change', (filePath: string) => {
        if (filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')) {
          invalidateFileCache(filePath);
          const violations = runStaticAnalysis(projectRoot, [filePath]);
          if (violations.length > 0) {
            console.warn(`⚠️ [AAET Static Violation] Found in ${filePath}:`);
            violations.forEach(v => {
              console.warn(`   👉 [${v.ruleId}] Line ${v.line}: ${v.message}`);
            });
          }
        }
      });
    }
  };
}
