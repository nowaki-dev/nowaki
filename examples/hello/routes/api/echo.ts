// API のメソッド別 export（GET / POST）。default の代わりにメソッド名で分岐できる。
type Ctx = {
  url: URL;
  json: (data: unknown) => unknown;
  bodyJson: () => Promise<unknown>;
};

export function GET(ctx: Ctx) {
  return ctx.json({ method: "GET", q: ctx.url.searchParams.get("q") });
}

export async function POST(ctx: Ctx) {
  const received = await ctx.bodyJson();
  return ctx.json({ method: "POST", received });
}
