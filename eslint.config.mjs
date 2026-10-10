import js from "@eslint/js";
import globals from "globals";
export default [
  { ignores: ["node_modules/**", "frontend/**"] },
  js.configs.recommended,
  {
    files: ["tests/browser/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["src/**/*.js", "scripts/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
  },
];
