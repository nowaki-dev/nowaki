import Landing from "../components/Landing.tsx";
import { STRINGS, headFor } from "../lib/i18n.ts";

export const lang = "ja";
export const title = STRINGS.ja.title;
export const head = headFor("ja");

export default function Ja() {
  return <Landing locale="ja" />;
}
