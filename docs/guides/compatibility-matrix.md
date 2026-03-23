# Compatibility Matrix

This matrix defines the baseline compatibility targets for the current architecture plan.

## Framework and runtime targets

| Surface                      | Target                        | Notes                    |
| ---------------------------- | ----------------------------- | ------------------------ |
| React                        | >= 16.8                       | Hooks baseline           |
| Vue                          | >= 3.0                        | Composition API          |
| Angular                      | >= 16.0                       | Signal-friendly adapters |
| React Native                 | same runtime as React binding | Masked field parity      |
| Node.js (CLI/devtools relay) | Active LTS                    | WebSocket relay runtime  |

## Optional resolver ecosystem

| Resolver | Package | Status        |
| -------- | ------- | ------------- |
| Zod      | `zod`   | Optional peer |
| Yup      | `yup`   | Optional peer |
| Joi      | `joi`   | Optional peer |

## Contract stability

| Contract                               | Stability          | Versioning policy               |
| -------------------------------------- | ------------------ | ------------------------------- |
| `@lehnihon/bit-form` root API          | Stable             | Breaking only on major          |
| `@lehnihon/bit-form/core` types        | Stable             | Breaking only on major          |
| `@lehnihon/bit-form/devtools/protocol` | Stable + versioned | Protocol version guard required |
| Internal `core/store/**` contracts     | Internal-only      | No compatibility guarantee      |

## Validation expectations

For any release candidate, run:

- `npm run test:unit`
- `npm run test:frameworks`
- `npm run test:integration`
- `npm run test:bundle-size`
- `npm run test:release-gates`
- `npm run test:compat`
