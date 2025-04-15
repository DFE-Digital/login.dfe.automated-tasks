const globals = require("globals");
const pluginJest = require("eslint-plugin-jest");
const pluginJs = require("@eslint/js");
const pluginTs = require("typescript-eslint");

/** @type {import('@typescript-eslint/utils').TSESLint.FlatConfig.ConfigFile} */
module.exports = [
  {
    plugins: {
      jest: pluginJest,
    },
  },

  pluginJs.configs.recommended,
  ...pluginTs.configs.recommended,

  {
    ignores: [
      "coverage/**",
      "build/**",
      "dist/**",
      "eslint.config.js",
      "jest.config.js",
    ],
  },

  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          impliedStrict: true,
        },
      },
    },
    rules: {
      strict: ["error", "never"],
    },
  },

  {
    files: ["src/**/*.test.ts"],
    languageOptions: {
      globals: {
        ...pluginJest.environments.globals.globals,
      },
    },
    rules: {
      // The following linting is disabled for unit tests to simplify mocking.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
