import { useState } from "preact/hooks";

export default function Counter({ start = 0 }: { start?: number }) {
  const [n, setN] = useState(start);
  return (
    <button type="button" onClick={() => setN(n + 1)}>
      count: {n}
    </button>
  );
}
