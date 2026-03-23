# Architecture vNext

Este guia documenta a direção arquitetural adotada na branch `feat/architecture-vnext`.

## Objetivos

- reforçar fronteiras públicas entre `core`, `framework bindings`, `devtools` e `cli`
- reduzir drift entre adapters de React, Vue e Angular
- separar protocolo/transporte/UI de DevTools
- diminuir imports de contratos internos fora do runtime do store

## Mudanças aplicadas nesta fase

### 1. Barramento público do core

Foi criado um entry interno dedicado em `src/core/bus.ts` para concentrar:

- `bitBus`
- `createBitBus`
- `BitBus`
- `BitBusListener`
- `BitFormGlobal`

Com isso, DevTools e integrações deixam de depender de `src/core/store/contracts/bus-types` diretamente.

### 2. Binding helpers compartilhados

Foram introduzidos helpers compartilhados em `src/core/bindings`:

- `form-binding.ts`: unifica criação de `controller` + `actions` dos adapters de formulário
- `framework-cleanup.ts`: centraliza cleanup de `unregisterField()` e `unregisterPrefix()`

### 3. Protocolo de DevTools

Foi extraído um protocolo explícito em `src/devtools/protocol.ts` contendo:

- mensagens remotas
- payloads de ação
- snapshots de store
- type guards de protocolo

### 4. Snapshot formatado do DevTools

A serialização do estado do store foi movida para `src/devtools/store-snapshot.ts`, separando:

- coleta de estado
- enriquecimento com histórico
- montagem do mapa de stores

### 5. CLI desacoplada do dashboard/relay

O servidor de DevTools da CLI foi quebrado em:

- `src/cli/devtools-dashboard.ts`
- `src/cli/devtools-relay.ts`
- `src/cli/server.ts` como composição fina

### 6. Extração de observe-ops do BitStore

Parte da orquestração de subscriptions foi movida para:

- `src/core/store/orchestration/store-observe-ops.ts`

Com isso, `BitStore` passa a delegar operações de:

- selector subscriptions
- tracked subscriptions
- path subscriptions
- field-state subscriptions
- form-meta subscriptions

### 7. Guardrail de fronteira arquitetural

Foi adicionado um teste de arquitetura em:

- `src/tests/core/architecture-boundaries.test.ts`

Esse teste impede regressão de fronteira, garantindo que `src/devtools/**` e `src/cli/**`
não importem contratos internos de `core/store/contracts/*`.

### 8. Extração de state-ops do BitStore

As operações de estado/batch/commit foram extraídas para:

- `src/core/store/orchestration/store-state-ops.ts`

Com isso, `BitStore` delega:

- execução de batch (`runStoreStateBatch`)
- commit de estado/notificações (`commitStoreStateUpdate`)
- dispatch do kernel (`dispatchStoreStateOperation`)
- snapshot de histórico (`saveStoreHistorySnapshot`)
- flush de batch (`flushStoreBatchedStateUpdates`)

### 9. Consolidação parcial de field bindings

Foi introduzido um helper compartilhado para bindings de campo mascarado:

- `src/core/bindings/field-binding.ts`

Aplicado em:

- `src/vue/use-bit-field.ts`
- `src/angular/inject-bit-field.ts`
- `src/react/use-bit-field.ts`
- `src/react-native/use-bit-field.ts`

### 10. Subpath público de protocolo DevTools

Foi formalizado um subpath dedicado para contratos do protocolo remoto:

- `@lehnihon/bit-form/devtools/protocol`

Incluído no build (`tsup`) e no `exports` de `package.json`.

### 11. Guardrail ampliado de imports internos

O teste de fronteira arquitetural também passou a validar que adapters/frameworks
e tooling (`react`, `react-native`, `vue`, `angular`, `devtools`, `cli`) não importem
`core/store/*` diretamente.

### 12. Extração de feature-ops do BitStore

As operações de persistência e histórico foram extraídas para:

- `src/core/store/orchestration/store-feature-ops.ts`

Com isso, `BitStore` delega:

- `restorePersisted`, `forceSave`, `clearPersisted`
- `undo`, `redo`, `getHistoryMetadata`

### 13. Separação de `core public API` e `runtime internals`

Foi introduzida uma fachada de contratos públicos em:

- `src/core/public-types.ts`
- `src/core/bus-types.ts`

Com isso, módulos fora de `src/core/store/**` (incluindo bindings, controladores,
tipos globais e testes) passam a importar tipos via `core` e não mais via
`core/store/contracts/*` diretamente.

Também foi ampliado o guardrail em:

- `src/tests/core/architecture-boundaries.test.ts`

para impedir regressão de imports diretos de `store/contracts` fora da camada de runtime.

### 14. Consolidação de field bindings em runtime compartilhado

Os adapters de campo de todos os frameworks passaram a convergir para o mesmo runtime
compartilhado de field binding (`createFrameworkMaskedFieldBinding`), incluindo:

- `src/react/use-bit-field.ts`
- `src/react-native/use-bit-field.ts`
- `src/vue/use-bit-field.ts`
- `src/angular/inject-bit-field.ts`

Com isso, parsing/format de máscara e operações de update/blur ficam centralizados
em um único controlador de campo reutilizável.

## Próximas fases sugeridas

- sem pendências arquiteturais críticas mapeadas neste ciclo
