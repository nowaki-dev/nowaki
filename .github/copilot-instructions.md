# Copilot instructions

Canonical agent guidance for this repo is **[AGENTS.md](../AGENTS.md)** — read it
first. It covers the layout, build/test/lint commands, the architecture
invariants you must not break, and where each feature lives.

Before claiming a change is done, run:

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Reminders: `nowaki-core` runs no JavaScript (JS interop goes through the
`PluginBridge` trait); Rust unit tests go at the **end** of each file; relative
imports use explicit extensions; it's **Preact, not React** (`react*` is aliased
to `preact/compat`).
