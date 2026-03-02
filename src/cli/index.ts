#!/usr/bin/env node
import { startDevServer } from "./server";
import { runAddCommand } from "./add";

// Pega os argumentos ignorando o caminho do node e do script (os 2 primeiros)
const args = process.argv.slice(2);
const command = args[0];

if (command === "devtools") {
  // Procura se o usuário passou a flag -p ou --port
  const portIndex =
    args.indexOf("-p") !== -1 ? args.indexOf("-p") : args.indexOf("--port");
  const port = portIndex !== -1 ? Number(args[portIndex + 1]) : 3000;

  startDevServer(port);
} else if (command === "add") {
  try {
    runAddCommand(args.slice(1));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
} else {
  // Nosso próprio menu de ajuda (Help)
  console.log(`
  🛠  Bit-Form CLI
  
  Uso:
    bit-form <comando> [opções]

  Comandos disponíveis:
    devtools    Inicia o servidor local do Remote Inspector
    add         Gera wrappers Bit-Form para UI (ex.: shadcn)
    
  Exemplo add:
    bit-form add shadcn input textarea select
    bit-form add shadcn --path ./components --ui-path @/components/ui --overwrite

  Opções do devtools:
    -p, --port  Define a porta do servidor (padrão: 3000)
  `);
}
