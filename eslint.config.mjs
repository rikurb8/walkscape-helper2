import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "site/**",
      "docs/.vitepress/cache/**",
      "docs/.vitepress/dist/**",
      "data/raw/**",
      "reports/**"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-console": "off",
      "no-control-regex": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
);
