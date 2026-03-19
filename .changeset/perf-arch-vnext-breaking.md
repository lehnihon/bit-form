---
"@lehnihon/bit-form": major
---

Perf/architecture vNext batch with intentional breaking changes:

- core: cache-aware computed execution and ordered graph reuse
- core: bounded path caches in subscription engine to avoid unbounded growth
- devtools: remote bridge now batches state updates to reduce network churn
- docs: quality gates guidance update for breaking rollouts
