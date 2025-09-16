// assets/config.example.js
// Copy this file to assets/config.js and edit to match your translation endpoint.
//
// TRANSLATION_ENDPOINT must be a URL that accepts POST JSON like:
// { text: "...", source: "en", target: "mni", engine: "mint" }
// and returns JSON with the translated text, e.g. { text: "translated text" }
// OR { translated_text: "..." }.
//
// For security, do NOT put secret API keys into this file if deploying to GitHub Pages.
// Instead, host a serverless/proxy function that contains secret keys and forward requests from this endpoint.

const TRANSLATION_ENDPOINT = "https://your-serverless.example/translate"; // <-- REQUIRED
const DEFAULT_TARGET = "mni"; // Meitei (language code used internally by your API)
