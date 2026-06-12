import { useState } from "preact/hooks";

export default function Counter({ start = 0 }: { start?: number }) {
  const [count, setCount] = useState(start);
  return (
    <div style="border:1px solid #ccc;padding:1rem;border-radius:8px;display:inline-flex;align-items:center;gap:1rem">
      <button onClick={() => setCount((c) => c - 1)}>-</button>
      <strong>{count}</strong>
      <button onClick={() => setCount((c) => c + 1)}>+</button>
    </div>
  );
}
