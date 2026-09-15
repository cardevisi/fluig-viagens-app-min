#!/usr/bin/env node
// Serve o codelab gerado (claat) por HTTP e abre o Chrome na navegacao correta.
//
// Por que existe: abrir o index.html via file:// nao renderiza o codelab,
// porque ele usa Web Components (google-codelab / codelab-elements.js) que
// exigem um servidor HTTP. Este script sobe um servidor estatico simples.
//
// Uso:
//   node docs/serve-codelab.mjs                # serve a pasta do codelab padrao
//   node docs/serve-codelab.mjs <pasta>        # serve outra pasta de codelab
//   PORT=9000 node docs/serve-codelab.mjs      # porta customizada
//   NO_OPEN=1 node docs/serve-codelab.mjs      # nao abre o navegador

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Pasta do codelab gerado (contem index.html). Pode ser sobrescrita por argumento.
const codelabArg = process.argv[2] ?? "reconstruindo-fluig-viagens-app";
const rootDir = resolve(__dirname, codelabArg);

const START_PORT = Number(process.env.PORT ?? 8000);
const HOST = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

function safeJoin(base, target) {
  const p = normalize(join(base, target));
  if (p !== base && !p.startsWith(base + sep)) return null; // impede path traversal
  return p;
}

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(
      new URL(req.url, `http://${HOST}`).pathname,
    );
    if (urlPath === "/") urlPath = "/index.html";

    let filePath = safeJoin(rootDir, urlPath);
    if (!filePath) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    let info;
    try {
      info = await stat(filePath);
    } catch {
      res.writeHead(404).end("Not found");
      return;
    }

    if (info.isDirectory()) {
      filePath = join(filePath, "index.html");
    }

    const data = await readFile(filePath);
    const type =
      MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch (err) {
    res.writeHead(500).end("Server error");
    console.error(err);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && currentPort < START_PORT + 20) {
    currentPort += 1;
    server.listen(currentPort, HOST);
    return;
  }

  console.error(err);
  process.exitCode = 1;
});

let currentPort = START_PORT;

server.listen(currentPort, HOST, async () => {
  const url = `http://${HOST}:${currentPort}/`;
  console.log(`Codelab servido em: ${url}`);
  console.log(`Pasta: ${rootDir}`);
  console.log("Pressione Ctrl+C para parar.");

  try {
    await stat(join(rootDir, "index.html"));
  } catch {
    console.warn(`\nAVISO: nao encontrei index.html em ${rootDir}.`);
    console.warn("Gere o codelab antes com `npm run codelab:build`.");
  }

  if (process.env.NO_OPEN === "1") return;

  const chromeCandidates = [
    "google-chrome-stable",
    "google-chrome",
    "chromium",
    "chromium-browser",
  ];

  for (const bin of chromeCandidates) {
    try {
      const child = spawn(bin, [url], { stdio: "ignore", detached: true });
      child.on("error", () => {});
      child.unref();
      return;
    } catch {
      // tenta o proximo
    }
  }
  console.log(
    "Nao consegui abrir o Chrome automaticamente. Abra a URL acima manualmente.",
  );
});
