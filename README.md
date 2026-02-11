# 📦 BitForm

**BitForm** é uma biblioteca de gerenciamento de formulários ultra-leve (zero dependências no core), tipada e agnóstica, projetada para unificar a lógica de formulários em ecossistemas que utilizam **React**, **Vue** ou **Angular**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/seu-usuario/bit-form/actions/workflows/ci.yml/badge.svg)](https://github.com/seu-usuario/bit-form/actions)

## ✨ Diferenciais

* 🎯 **Single Source of Truth:** Defina sua lógica de negócio, transformações e validações uma única vez e compartilhe entre projetos ou frameworks.
* 🔗 **Agnóstica:** O estado vive em uma `BitStore` pura; os componentes apenas reagem a ela.
* 🛡️ **Validadores Flexíveis:** Suporte nativo para **Zod**, **Yup** e **Joi**.
* ⚡ **Performance:** Atualizações granulares. No React, usa `useSyncExternalStore`; no Angular, integra-se com `Signals`.
* 🏗️ **Deep Nesting:** Suporte nativo a objetos aninhados e arrays usando Dot Notation (`user.address.street`).

---

## ⚡ BitForm vs. Outras Bibliotecas

Diferente de bibliotecas presas ao ciclo de vida de um framework específico, a **BitForm** separa o **Estado** da **UI**.

| Recurso | BitForm | React Hook Form | Formik |
| :--- | :--- | :--- | :--- |
| **Tamanho (Bundle)** | ~2.5kb (Gzip) | ~9kb (Gzip) | ~15kb (Gzip) |
| **Agnóstica** | ✅ Sim | ❌ Não | ❌ Não |
| **Validação Assíncrona**| ✅ Nativa | ✅ Nativa | ⚠️ Complexa |
| **Reatividade** | Signals / SyncStore | Refs / Uncontrolled | State / Controlled |

---

## 🚀 Instalação

```bash
npm install bit-form
# Escolha seu validador favorito
npm install zod # ou yup, joi

## 🛠️ Como Funciona?

A **BitForm** separa a lógica de estado da representação visual. Você define a inteligência do formulário uma única vez e a consome em qualquer framework.

### 1. Defina sua Store (Core Agnóstico)

Crie um arquivo compartilhado (ex: `form.store.ts`). Este código não depende de nenhum framework.

```typescript
import { BitStore } from 'bit-form';
import { zodResolver } from 'bit-form/resolvers/zod';
import { z } from 'zod';

// 1. Defina seu Schema de validação
const schema = z.object({
  name: z.string().min(3, 'Nome muito curto'),
  salary: z.number().min(1000, 'Salário deve ser maior que 1000')
});

// 2. Instancie a Store com transformações e validações
export const profileStore = new BitStore({
  initialValues: { name: '', salary: 0 },
  resolver: zodResolver(schema),
  transform: {
    // Transforma máscara de moeda "R$ 1.000,00" em 1000 (number) para a Store
    'salary': (v: string) => Number(v.replace(/\D/g, '')) / 100
  }
});

---

## 📖 API Reference

### `BitStore`
A classe principal que gerencia o estado do formulário.

| Propriedade / Método | Tipo | Descrição |
| :--- | :--- | :--- |
| `values` | `Object` | Estado atual de todos os campos. |
| `errors` | `Object` | Dicionário plano de erros `{ path: message }`. |
| `touched` | `Object` | Mapeamento de campos que foram interagidos. |
| `setField(path, value)` | `Function` | Atualiza um campo específico (suporta dot.notation). |
| `patchValues(data)` | `Function` | Atualiza múltiplos campos simultaneamente. |
| `validate()` | `Function` | Executa o resolver manualmente e retorna os erros. |
| `reset()` | `Function` | Retorna a store ao estado inicial. |

### Hooks & Adaptadores
Todos os adaptadores (`/react`, `/vue`, `/angular`) expõem a mesma interface básica:

#### `useBitForm(store)`
Retorna o estado global do formulário.
- `isSubmitting`: `boolean` indicando se a submissão está em curso.
- `isValid`: `boolean` que reflete o estado da validação.
- `submit(callback)`: Wrapper para lidar com a submissão e evitar *double-tap*.

#### `useBitField(store, path)`
Retorna o estado granular de um campo específico.
- `value`: Valor atual (reativo).
- `error`: Mensagem de erro atual.
- `touched`: Se o campo foi focado/alterado.
- `setValue(v)`: Função para atualizar o valor.
- `setBlur()`: Função para marcar o campo como "tocado".

---

## 🛡️ Suporte a Validadores (Resolvers)

Para manter o core leve, os resolvers são exportados em sub-caminhos:

```typescript
import { zodResolver } from 'bit-form/resolvers/zod';
import { yupResolver } from 'bit-form/resolvers/yup';
import { joiResolver } from 'bit-form/resolvers/joi';