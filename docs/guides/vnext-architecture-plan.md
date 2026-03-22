# VNext Architecture Plan (Dev Cycle)

Este documento registra a execução das fases de arquitetura com foco em preservar performance.

## Objetivos

- Reduzir acoplamento do core para facilitar evolução.
- Preparar migração com breaking changes em ambiente de desenvolvimento.
- Manter proteção contra regressões de latência, memória e tamanho de bundle.

## Fases executadas neste ciclo

### Fase 1 — Contratos API vNext

- Adicionados contratos segmentados em `store-api-vnext-types.ts`:
  - `query`
  - `write`
  - `observe`
  - `features`
- Exportados via `public-types.ts`.

### Fase 2 — Runtime Context

- Introduzida factory de contexto de runtime em `orchestration/runtime-context.ts`.
- `BitStore` passou a montar runtime via `createStoreRuntimeContext(...)` + `createStoreRuntime(...)`.

### Fase 3 — Modularização incremental da validação

- Extraída util compartilhada de erro (`hasAnyError`) para `shared/error-map.ts`.
- Reuso aplicado em:
  - `engines/state-update-engine.ts`
  - `managers/features/validation-manager.ts`

### Fase 4 — Adapters mais finos

- Criado helper comum de observação de meta em `bindings/form-meta.ts`:
  - `observeFormMetaSnapshot(...)`
- Vue e Angular passaram a reutilizar helper comum, removendo duplicação de subscribe+snapshot.

### Fase 5 — Guardrails de qualidade/performance

- Mantido gate estrito de bundle por entrypoint (`bundle-size.test.ts`).
- `bundle-size-gate.test.ts` simplificado para smoke-check de artefatos (sem budget duplicado).
- Adicionado script consolidado:
  - `npm run test:quality:critical`

### Fase 6 — Compatibilidade de migração

- Criado subpath `@lehnihon/bit-form/compat`.
- Incluídos aliases legados:
  - `createLegacyBitStore`
  - `BitStoreLegacyApi`
  - `BitStoreLegacyHooksApi`
  - `BitFormLegacyBindingApi`

## Próximos passos recomendados

- Migrar framework bindings para consumir explicitamente `query/write/observe/features`.
- Reduzir casts de array bindings (`as unknown as`) com novos tipos utilitários.
- Fatiar `validation-manager` em módulos por estágio (`sync-track`, `async-queue`, `commit`).
