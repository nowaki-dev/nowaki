// TSRX (.tsrx) で書いた島。`@{ ... }` の statement-container 本体に JSX を置く。
// @tsrx/preact が標準 Preact コンポーネントへコンパイルし、Nowaki の oxc パイプラインに合流する。
import { useState } from "preact/hooks";

export default function TsrxCounter({ start = 0 }) @{
  const [count, setCount] = useState(start);
  <div style="border:1px solid #ccc;padding:1rem;border-radius:8px;display:inline-flex;align-items:center;gap:1rem">
    <button onClick={() => setCount((c) => c - 1)}>-</button>
    <strong>tsrx: {count}</strong>
    <button onClick={() => setCount((c) => c + 1)}>+</button>
  </div>
}
