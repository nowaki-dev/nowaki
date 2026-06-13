import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";

// Preact アイランドで Nowaki と同条件（同じ UI ライブラリ）に揃える。
export default defineConfig({
  integrations: [preact()],
});
