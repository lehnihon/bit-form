# Canary Rollback Plan

This plan is intentionally explicit so on-call can execute rollback in a few minutes.

## 1) Detect incident

- Canary consumers report regression in forms behavior/performance.
- Confirm package/tag in use: `npm ls @lehnihon/bit-form`.

## 2) Stop canary propagation

```bash
npm dist-tag rm @lehnihon/bit-form canary
npm dist-tag ls @lehnihon/bit-form
```

## 3) Force stable pin in pilot apps

```bash
npm i @lehnihon/bit-form@2.2.4
```

## 4) Publish fixed canary (optional)

```bash
npm version prerelease --preid canary
npm publish --tag canary
```

## 5) Post-incident

- Document root cause and fix.
- Add regression tests in `quality/e2e` or `quality/bench`.
- Re-run compatibility smoke before re-enabling canary rollout.
