import Landing from "../components/Landing.tsx";
import { STRINGS, headFor } from "../lib/i18n.ts";

export const lang = "en";
export const title = STRINGS.en.title;
export const head = headFor("en");

export default function En() {
  return <Landing locale="en" />;
}
