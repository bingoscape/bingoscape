/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],

  printWidth: 80,
  tabWidth: 2,
  useTabs: false,

  semi: false,
  singleQuote: false,
  quoteProps: "as-needed",

  jsxSingleQuote: false,

  trailingComma: "es5",

  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: "always",

  endOfLine: "lf",

  proseWrap: "preserve",

  htmlWhitespaceSensitivity: "css",

  embeddedLanguageFormatting: "auto",
}

export default config
