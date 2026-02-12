import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'react/index': 'src/react/index.ts',
    'vue/index': 'src/vue/index.ts',
    'angular/index': 'src/angular/index.ts',
    'resolvers/zod': 'src/resolvers/zod.ts',
    'resolvers/yup': 'src/resolvers/yup.ts',
    'resolvers/joi': 'src/resolvers/joi.ts',
  },
  tsconfig: './tsconfig.build.json', 
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  minify: true,
  external: ['react', 'vue', '@angular/core', 'zod', 'yup', 'joi', 'rxjs'],
});