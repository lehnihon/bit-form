import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react/index.ts',
    vue: 'src/vue/index.ts',
    angular: 'src/angular/index.ts',
    'resolvers/zod': 'src/resolvers/zod.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  minify: true,
  external: ['react', 'vue', '@angular/core', 'rxjs'],
  tsconfig: './tsconfig.json', 
});