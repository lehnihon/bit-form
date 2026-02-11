import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/core/index.ts',
    react: 'src/react/index.ts',
    vue: 'src/vue/index.ts',
    angular: 'src/angular/index.ts',
    'resolvers/zod': 'src/resolvers/zod.ts',
    'resolvers/yup': 'src/resolvers/yup.ts',
    'resolvers/joi': 'src/resolvers/joi.ts',
  },
  tsconfig: './tsconfig.json', 
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  minify: true,
  external: ['react', 'vue', '@angular/core', 'zod', 'yup', 'joi', 'rxjs'],
});