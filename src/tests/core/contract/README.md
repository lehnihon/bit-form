# Testes de Contrato Público (`core/contract/`)

Esta pasta contém testes que verificam apenas a **API pública** do `BitStore`,
importando exclusivamente via `../../core` (o entrypoint público).

## Regra de ouro

**NUNCA importe de caminhos internos** como `../../core/store/managers/...`,
`../../core/store/engines/...` etc. Use apenas:

```ts
import { createBitStore } from "../../core"; // ✅ correto
import { BitSubscriptionEngine } from "../../core/store/engines/..."; // ❌ proibido
```

## Por que isso importa?

- Testes de contrato devem sobreviver a refactors internos sem modificação
- Eles documentam o comportamento esperado pelo consumidor da lib
- Diferenciam-se dos testes unitários em `../` que podem (e devem) conhecer
  os internals para testar cada subsistema isolado

## Arquivos nesta pasta

| Arquivo                                 | O que cobre                                                   |
| --------------------------------------- | ------------------------------------------------------------- |
| `store-initialization.contract.test.ts` | Criação do store, valores iniciais, computed, conditional     |
| `store-subscriptions.contract.test.ts`  | subscribe, subscribePath, subscribeSelector, subscribeTracked |
| `store-facades.contract.test.ts`        | Métodos de cada facade (read/write/register/feature/observe)  |
