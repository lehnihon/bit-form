# 📦 BitForm

**BitForm** é uma biblioteca de gerenciamento de formulários ultra-leve (zero dependências no core), tipada e agnóstica, projetada para unificar a lógica de formulários em ecossistemas que utilizam **React**, **Vue** ou **Angular**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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