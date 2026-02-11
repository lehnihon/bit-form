# ⚛️ BitForm

Uma biblioteca de formulários **atômica**, agnóstica e ultraleve para ecossistemas modernos de JavaScript. Gere formulários performáticos com suporte nativo a máscaras complexas e submissão de dados limpos.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Diferenciais

- **Atômico:** Atualiza apenas o campo necessário, sem re-renderizar o formulário inteiro.
- **Agnóstico:** Core em TypeScript puro, com adaptadores oficiais para **React, Vue e Angular**.
- **Universal:** Funciona em Browser, Node.js e React Native (sem dependências de `Intl`).
- **Auto-Unmask:** Exiba dados formatados para o usuário, mas receba dados limpos (Numbers/Strings puras) no `submit`.
- **Multi-Moeda:** Suporte nativo para BRL, USD, EUR e customizações, inclusive valores negativos.

---

## 🚀 Instalação

```bash
npm install bit-form