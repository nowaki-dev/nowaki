import { builtBy, marker } from "virtual:build-info";

// 仮想モジュール（プラグインが生成、ディスクに無い）から import する島。
// クライアントチャンクには生成されたソースが連結される。
export default function VirtualBadge() {
  return (
    <span data-testid="virtual">
      {marker} · {builtBy}
    </span>
  );
}
