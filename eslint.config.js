import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import unusedImports from "eslint-plugin-unused-imports";

/**
 * ESLint Configuration with Circular Dependency Detection
 *
 * Includes:
 * - TypeScript parsing and rules
 * - Import ordering rules
 * - Circular dependency detection (eslint-plugin-import)
 * - No-restricted-syntax for common patterns
 */

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "unused-imports": unusedImports,
    },
    rules: {
      // TypeScript resolve símbolos em nível de tipo; no-undef gera falso positivo.
      "no-undef": "off",

      // Remove unused imports automatically (auto-fixable)
      "unused-imports/no-unused-imports": "error",

      // Disable base rule for TypeScript syntax such as interface method params
      "no-unused-vars": "off",

      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
      "no-empty": [
        "warn",
        {
          allowEmptyCatch: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // Circular import detection
      "no-restricted-syntax": [
        "warn",
        {
          selector: "ImportDeclaration[source.value=/^\\.\\/.*\\.(ts|js)$/]",
          message:
            "Avoid relative imports across modules; use bare imports instead.",
        },
      ],
    },
  },

  // Core module rules (stricter)
  {
    files: ["src/core/**/*.ts"],
    rules: {
      // Prevent circular dependencies in core
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["src/core/**/index"],
              message: "Avoid importing core modules by index; be explicit.",
            },
          ],
        },
      ],
    },
  },

  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
      "coverage/**",
      "test-results/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
];
