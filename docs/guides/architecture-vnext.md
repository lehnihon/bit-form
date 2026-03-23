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

## Próximas fases sugeridas

1. reduzir responsabilidades de `BitStore`
2. separar `core public API` de `core runtime internals`
3. consolidar também os field bindings em um runtime compartilhado
4. introduzir testes de fronteira de imports por camada
5. formalizar subpaths extras para contratos de inspeção/devtools
