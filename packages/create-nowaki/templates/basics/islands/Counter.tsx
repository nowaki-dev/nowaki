import { useState } from "preact/hooks";

// クライアントでハイドレートする唯一のコンポーネント（島）。スタイルは routes/index.tsx の <style> に。
export default function Counter({ start = 0 }: { start?: number }) {
  const [count, setCount] = useState(start);
  return (
    <div class="counter">
      <button class="counter__btn" type="button" aria-label="decrement" onClick={() => setCount((c) => c - 1)}>
        −
      </button>
      <strong class="counter__value">{count}</strong>
      <button class="counter__btn" type="button" aria-label="increment" onClick={() => setCount((c) => c + 1)}>
        +
      </button>
    </div>
  );
}
