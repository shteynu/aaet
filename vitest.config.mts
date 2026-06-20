import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@aaet/config': path.resolve(root, 'libs/config/src/index.ts'),
      '@aaet/core': path.resolve(root, 'libs/core/src/index.ts'),
      '@aaet/runtime': path.resolve(root, 'libs/runtime/src/index.ts')
    }
  }
});
