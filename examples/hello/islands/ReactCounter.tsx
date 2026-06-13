// Next.js から持ち込んだ「そのまま」の React コード。
// Nowaki が react/react-dom を preact/compat へ読み替えるので無改変で動く。
import { useState } from "react";

export default function ReactCounter({ start = 0 }: { start?: number }) {
  const [count, setCount] = useState(start);
  return (
    <div style="border:1px solid #ccc;padding:1rem;border-radius:8px;display:inline-flex;align-items:center;gap:1rem">
      <button onClick={() => setCount((c) => c - 1)}>-</button>
      <strong>react: {count}</strong>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
    </div>
  );
}
