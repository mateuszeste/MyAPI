import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".kilo/**",
      ".agent/**",
      ".agents/**",
      "eslint_errors.log"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
        React: "writable",
        NodeJS: "readonly",
      },
    },
    rules: {
      // Downgrade to warn — Google API types are often unknown
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow unused vars prefixed with _ (convention for intentionally unused)
      "@typescript-eslint/no-unused-vars": ["error", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      "prefer-const": "error",
      "no-undef": "error",
      "no-empty": ["error", { "allowEmptyCatch": true }],
    },

  }
);

