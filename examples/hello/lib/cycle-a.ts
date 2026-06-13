import { b } from "./cycle-b.ts";
export function a(): string {
  return "a→" + b();
}
