# CLAUDE.md

Canonical agent guidance for this repo is **[AGENTS.md](./AGENTS.md)** — read it
first. It covers the layout, build/test/lint commands, the architecture
invariants you must not break, and where each feature lives.

Before claiming a change is done:

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo run -p nowaki -- dev examples/hello   # smoke-test the example app
```

Reminders: `nowaki-core` runs no JavaScript; Rust unit tests go at the **end** of
each file; relative imports use explicit extensions; it's **Preact, not React**.
