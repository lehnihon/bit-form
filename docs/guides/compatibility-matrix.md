# Compatibility Matrix

Use this matrix as a release-time reference. Confirm exact version policy from package release notes.

## Runtime and Framework Targets

| Bit-Form Version | React | Vue  | Angular | React Native | Node.js | Browsers         |
| ---------------- | ----- | ---- | ------- | ------------ | ------- | ---------------- |
| v4.x             | 18+   | 3+   | 16+     | 0.73+        | 18+     | Modern evergreen |
| v5.x (planned)   | 18+   | 3.3+ | 17+     | 0.74+        | 20+     | Modern evergreen |

## Notes

- Modern evergreen means latest stable Chrome, Edge, Firefox, and Safari.
- For legacy targets, test your specific transpilation/runtime constraints.
- Always run compatibility checks in your own CI matrix before production rollout.

## Related

- [Migration Guide](./migration.md)
- [Release Gates](./release-gates.md)
