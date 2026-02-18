#!/usr/bin/env node
import { startDevServer } from "./server";

// Pega os argumentos ignorando o caminho do node e do script (os 2 primeiros)
const args = process.argv.slice(2);
const command = args[0];

if (command === "devtools") {
  // Procura se o usuário passou a flag -p ou --port
  const portIndex =
    args.indexOf("-p") !== -1 ? args.indexOf("-p") : args.indexOf("--port");
  const port = portIndex !== -1 ? Number(args[portIndex + 1]) : 3000;

  startDevServer(port);
} else {
  // Nosso próprio menu de ajuda (Help)
  console.log(`
  🛠  Bit-Form CLI
  
  Uso:
    bit-form <comando> [opções]

  Comandos disponíveis:
    devtools    Inicia o servidor local do Remote Inspector
    
  Opções do devtools:
    -p, --port  Define a porta do servidor (padrão: 3000)
  `);
}
