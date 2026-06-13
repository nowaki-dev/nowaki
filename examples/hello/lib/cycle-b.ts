import { a } from "./cycle-a.ts";
export function b(): string {
  return "b";
}
// 循環エッジ: b は a を import する（実行時は遅延参照なのでOK）
export function full(): string {
  return a();
}
