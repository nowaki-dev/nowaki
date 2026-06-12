# Security Policy

## Supported versions

Nowaki is in alpha; only the latest release (and `main`) receives security
fixes.

## Reporting a vulnerability

Please report security issues privately to **dev@voredge.com** — do not open
a public GitHub issue. Include reproduction steps and the affected version or
commit. We aim to acknowledge reports within 72 hours.

Note: the dev server (`nowaki dev`) is a development tool. It serves files
from the local filesystem (e.g. `/@fs/`) by design and must never be exposed
to untrusted networks. Reports about the dev server are still welcome, but
production-facing issues (`nowaki build` output, SSR runtime) take priority.
