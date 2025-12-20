// @ts-check

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  eslintConfigPrettier,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    rules: {
      "import-x/order": ["warn", { alphabetize: { order: "asc", orderImportKind: "asc" } }],
    },
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
        }),
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,cjs,mjs}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.strict,
      tseslint.configs.stylistic,
    ],
    rules: {
      // アンダースコアつきの引数は使わなくても無視する対象。
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parserOptions: {
        projectService: {
          // TypeScriptルールでJavaScriptをlintする時はデフォルトのprojectを使用。
          allowDefaultProject: ["*.js", "*.jsx", "*.cjs", "*.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  nodePlugin.configs["flat/recommended-module"],
  {
    rules: {
      // 将来的には分離するのでNode.jsのモジュールを分かり易くする。
      "n/prefer-node-protocol": "error",
      // 利用方法を統一したい。
      "n/prefer-global/buffer": "error",
      "n/prefer-global/console": "error",
      "n/prefer-global/process": "error",
      "n/prefer-global/text-decoder": "error",
      "n/prefer-global/text-encoder": "error",
      "n/prefer-global/url": "error",
      "n/prefer-global/url-search-params": "error",
      "n/prefer-promises/dns": "error",
      "n/prefer-promises/fs": "error",
      // 誤爆するし、他のlinterでカバーしているので多分必要ない。
      "n/no-missing-import": "off",
    },
  },
]);
