// サーバーリアクティブ島（Jetstream）のクライアントランタイム。
// <nowaki-live> を見つけて WebSocket を張り、data-live のイベントをサーバーへ送り、
// 返ってくる HTML パッチを DOM morph で当てる。コンポーネント JS はクライアントに無い。
// WS が張れない/落ちても初期 SSR のまま表示は壊れない（劣化のみ）。

function lives() {
  return [...document.querySelectorAll("nowaki-live")];
}

function connect() {
  const els = lives();
  if (!els.length) return;

  const proto = location.protocol === "https:" ? "wss" : "ws";
  let ws;
  let retry = 0;

  const open = () => {
    ws = new WebSocket(`${proto}://${location.host}/__nowaki/live`);
    ws.onopen = () => {
      retry = 0;
      ws.send(
        JSON.stringify({
          type: "join",
          islands: lives().map((el) => ({
            nid: el.getAttribute("nid"),
            name: el.getAttribute("name"),
            state: parse(el.getAttribute("state")),
          })),
        }),
      );
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === "patch") {
        const el = document.querySelector(`nowaki-live[nid="${cssEscape(msg.nid)}"]`);
        if (el) morph(el, msg.html);
      }
    };
    // 再接続（指数バックオフ、上限あり）。再 join で状態を取り戻す。
    ws.onclose = () => {
      const delay = Math.min(1000 * 2 ** retry++, 10000);
      setTimeout(open, delay);
    };
    ws.onerror = () => ws.close();
  };
  open();

  // data-live のイベントをサーバーへ送る（最寄りの <nowaki-live> に紐づく）。
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-live]");
    if (!t) return;
    const host = t.closest("nowaki-live");
    if (!host || !ws || ws.readyState !== 1) return;
    ev.preventDefault();
    ws.send(
      JSON.stringify({
        type: "event",
        nid: host.getAttribute("nid"),
        handler: t.getAttribute("data-live"),
        payload: t.value !== undefined ? t.value : undefined,
      }),
    );
  });
}

function parse(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

function cssEscape(s) {
  return String(s).replace(/"/g, '\\"');
}

// --- 最小 DOM morph（keyless）。from の子を toHtml に合わせて in-place 更新する。 ---
function morph(from, toHtml) {
  const tmp = document.createElement("template");
  tmp.innerHTML = toHtml;
  morphChildren(from, tmp.content);
}

function morphChildren(from, to) {
  const fromNodes = from.childNodes;
  const toNodes = to.childNodes;
  let i = 0;
  for (; i < toNodes.length; i++) {
    const tn = toNodes[i];
    const fn = fromNodes[i];
    if (!fn) {
      from.appendChild(tn.cloneNode(true));
      continue;
    }
    if (fn.nodeType !== tn.nodeType || (fn.nodeType === 1 && fn.tagName !== tn.tagName)) {
      from.replaceChild(tn.cloneNode(true), fn);
      continue;
    }
    if (fn.nodeType === 3) {
      if (fn.nodeValue !== tn.nodeValue) fn.nodeValue = tn.nodeValue;
    } else if (fn.nodeType === 1) {
      morphAttrs(fn, tn);
      morphChildren(fn, tn);
    }
  }
  // 余った from の子を削除
  while (fromNodes.length > toNodes.length) {
    from.removeChild(from.lastChild);
  }
}

function morphAttrs(from, to) {
  const fa = from.attributes;
  for (let i = fa.length - 1; i >= 0; i--) {
    if (!to.hasAttribute(fa[i].name)) from.removeAttribute(fa[i].name);
  }
  for (const a of to.attributes) {
    if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
  }
  // フォーム要素の value はプロパティも合わせる（フォーカス/入力を壊さないよう値のみ）
  if ("value" in from && to.hasAttribute("value")) {
    const v = to.getAttribute("value");
    if (from.value !== v) from.value = v;
  }
}

connect();
