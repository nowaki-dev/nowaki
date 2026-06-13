// TSRX 島のデモ。`.tsrx` で書いた島を通常の route から使う。
import TsrxCounter from "../islands/TsrxCounter.tsrx";

export default function TsrxDemo() {
  return (
    <main style="max-width:40rem;margin:3rem auto;padding:0 1.25rem;font-family:system-ui">
      <h1>TSRX island</h1>
      <p>
        This counter is authored in <code>.tsrx</code> (statement-container syntax) and compiled to
        a Preact component by @tsrx/preact, then run through Nowaki's oxc pipeline.
      </p>
      <TsrxCounter start={5} />
    </main>
  );
}
