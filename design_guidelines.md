# Design Guidelines & Impeccable Notes

## Typography Anti-Patterns
* **Do NOT use overused fonts**: Fonts like `Inter`, `Roboto`, `Open Sans`, `Lato`, `Montserrat`, and `Arial` are overused and considered an anti-pattern by `impeccable`.
* **Instead**: Choose distinctive fonts that give the interface personality, such as `Outfit`, `Space Grotesk`, `Plus Jakarta Sans`, etc.

## Other Anti-Patterns to Avoid
* Do not use pure black/gray (always tint with the primary color).
* Do not use gray text on colored backgrounds.
* Avoid nesting cards inside cards.
* Avoid bounce/elastic easing in animations.

## Development Rules
* **Crucial Build Step**: Every time code is edited, you MUST run `npm run build`. This is because the project uses `vite-plugin-singlefile`, meaning all assets are bundled into a single `dist/index.html` file (used for Google Apps Script deployment). If you do not build, changes will not reflect in the final output.

## Global AI Persona Rules
* **แก้ความมั่ว (Hallucination)**: Provide answers based strictly on the facts. If unsure, state clearly that you don't know.
* **แก้ความซ้ำซาก (Repetition)**: Ensure varied sentence structures and avoid repeating the same vocabulary or concepts.
* **แก้ความชุ่ย (Low Quality)**: Adopt a meticulous approach; double-check the logic and flow before finalizing the response.
