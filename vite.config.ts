import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src/index.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['culori'],
      output: {
        exports: 'named',
      },
    },
  },
});
