import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src/index.ts'),
        'ramps/tailwind': path.resolve(__dirname, 'src/ramps/tailwind.ts'),
        'ramps/tailwind-v3': path.resolve(__dirname, 'src/ramps/tailwind-v3.ts'),
        'ramps/radix': path.resolve(__dirname, 'src/ramps/radix.ts'),
        'ramps/flexoki': path.resolve(__dirname, 'src/ramps/flexoki.ts'),
        'ramps/shoelace': path.resolve(__dirname, 'src/ramps/shoelace.ts'),
        'ramps/wa-default': path.resolve(__dirname, 'src/ramps/wa-default.ts'),
        'ramps/wa-bright': path.resolve(__dirname, 'src/ramps/wa-bright.ts'),
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
