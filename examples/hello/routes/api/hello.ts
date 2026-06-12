export default function handler({ url }: { url: URL }) {
  return {
    body: { hello: "nowaki", from: url.pathname },
  };
}
