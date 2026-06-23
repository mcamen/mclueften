// ESLint Flat-Config für die statische Single-Page-App.
// eslint-plugin-html extrahiert das Inline-<script> aus index.html und lintet es.
import js from "@eslint/js";
import html from "eslint-plugin-html";
import globals from "globals";

export default [
    js.configs.recommended,
    {
        files: ["**/*.html"],
        plugins: { html },
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "script",
            globals: {
                ...globals.browser,
                Chart: "readonly"   // via CDN geladen
            }
        },
        rules: {
            // Mehrere Funktionen werden ausschließlich über HTML-onclick/oninput
            // referenziert; ESLint sieht diese Verknüpfung nicht → keine Fehlmeldung.
            "no-unused-vars": "off"
        }
    }
];
