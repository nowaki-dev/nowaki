// クライアントルーターの純粋ロジック（router-core.js）の単体テスト。
// DOM 非依存なので Node でそのまま実行できる（matchBoundary / createPageCache）。
import assert from "node:assert/strict";
import { matchBoundary, createPageCache } from "../packages/nowaki-runtime/client/router-core.js";

let passed = 0;
const ok = (label, cond) => {
  assert.ok(cond, label);
  console.log(`ok   ${label}`);
  passed++;
};

// --- matchBoundary: 最長 prefix 一致 ---
const boundaries = [
  { prefix: "", html: "root" },
  { prefix: "/blog", html: "blog" },
  { prefix: "/blog/admin", html: "admin" },
];
ok("root boundary matches an unrelated path", matchBoundary(boundaries, "/about").html === "root");
ok("/blog boundary matches /blog itself", matchBoundary(boundaries, "/blog").html === "blog");
ok("/blog boundary matches a child", matchBoundary(boundaries, "/blog/hello").html === "blog");
ok("deeper boundary wins (most specific)", matchBoundary(boundaries, "/blog/admin/x").html === "admin");
ok("/blogger does NOT match /blog prefix", matchBoundary(boundaries, "/blogger").html === "root");
ok("no boundaries → null", matchBoundary([], "/x") === null);
ok("no root boundary and no match → null", matchBoundary([{ prefix: "/p" }], "/q") === null);

// --- createPageCache: TTL + LRU（制御可能な now で時間を進める） ---
let t = 0;
const now = () => t;
const cache = createPageCache({ ttlMs: 1000, max: 2, now });

cache.set("/a", "A");
ok("get returns the stored value", cache.get("/a") === "A");
ok("has is true while fresh", cache.has("/a") === true);

t = 999;
ok("still fresh just before TTL", cache.get("/a") === "A");
t = 1001;
ok("stale after TTL → get undefined", cache.get("/a") === undefined);
ok("stale entry is evicted (size 0)", cache.size() === 0);

// LRU: 上限 2。3 件目で最古を追い出すが、get で触れた方は残る。
t = 0;
const lru = createPageCache({ ttlMs: 100000, max: 2, now });
lru.set("/1", 1);
lru.set("/2", 2);
lru.get("/1"); // /1 を最近使用に
lru.set("/3", 3); // 最古 = /2 が追い出される
ok("LRU keeps the recently-used entry", lru.get("/1") === 1);
ok("LRU evicts the least-recently-used entry", lru.get("/2") === undefined);
ok("LRU keeps the newest entry", lru.get("/3") === 3);
ok("LRU respects max size", lru.size() === 2);

console.log(`\nROUTER CACHE TEST PASSED (${passed} assertions)`);
