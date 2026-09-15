#!/usr/bin/env node

import { constants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const defaultMarkdown = join(__dirname, "codelab-fluig-viagens-app.md");
const markdownPath = resolve(process.cwd(), process.argv[2] ?? defaultMarkdown);

const markdown = await readFile(markdownPath, "utf8");
const codelabId = markdown.match(/^id:\s*(.+)$/m)?.[1]?.trim();

if (!codelabId) {
  throw new Error(`Nao encontrei o campo "id:" em ${markdownPath}.`);
}

const docsDir = dirname(markdownPath);
const outputDir = join(docsDir, codelabId);
const indexPath = join(outputDir, "index.html");

// O build acontece em duas etapas:
// 1. gerar o HTML com o claat
// 2. aplicar ajustes visuais e comportamentais no arquivo final.
await runClaatExport(markdownPath, docsDir);

const html = await readFile(indexPath, "utf8");
const enhancedHtml = enhanceGeneratedHtml(html);

if (enhancedHtml !== html) {
  await writeFile(indexPath, enhancedHtml, "utf8");
}

console.log(`Codelab atualizado em: ${indexPath}`);

// Procura o binário do claat em caminhos conhecidos para que o script
// funcione tanto localmente quanto em ambientes de automação.
async function runClaatExport(sourcePath, cwd) {
  const candidates = [
    process.env.CLAAT_BIN,
    process.env.HOME ? join(process.env.HOME, "go", "bin", "claat") : null,
    "claat",
  ].filter(Boolean);

  let lastError = null;

  for (const candidate of candidates) {
    if (candidate !== "claat") {
      try {
        await access(candidate, constants.X_OK);
      } catch {
        continue;
      }
    }

    try {
      await runCommand(candidate, ["export", sourcePath], cwd);
      return;
    } catch (error) {
      if (error.code === "ENOENT") {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "Nao encontrei o claat. Instale-o ou defina CLAAT_BIN apontando para o binario.",
    { cause: lastError },
  );
}

// Wrapper simples para executar comandos externos e transformar códigos
// de saída diferentes de zero em erros explícitos de build.
function runCommand(command, args, cwd) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
    });

    child.on("error", rejectPromise);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        Object.assign(
          new Error(`Comando falhou: ${command} ${args.join(" ")}`),
          {
            code,
          },
        ),
      );
    });
  });
}

// Ajusta o HTML gerado pelo claat para o modo offline/local do projeto:
// troca assets remotos, injeta estilos extras e adiciona melhorias de UX.
function enhanceGeneratedHtml(html) {
  let updated = html;

  updated = updated.replace(
    'href="//fonts.googleapis.com/css?family=Source+Code+Pro:400|Roboto:400,300,400italic,500,700|Roboto+Mono"',
    'href="assets/fonts/roboto.css"',
  );
  updated = updated.replace(
    'href="//fonts.googleapis.com/icon?family=Material+Icons"',
    'href="assets/fonts/material-icons.css"',
  );
  updated = updated.replace(
    'href="https://fonts.googleapis.com/css?family=Source+Code+Pro:400|Roboto:400,300,400italic,500,700|Roboto+Mono"',
    'href="assets/fonts/roboto.css"',
  );
  updated = updated.replace(
    'href="https://fonts.googleapis.com/icon?family=Material+Icons"',
    'href="assets/fonts/material-icons.css"',
  );
  updated = updated.replace(
    'href="https://storage.googleapis.com/claat-public/codelab-elements.css"',
    'href="assets/codelab-elements.css"',
  );
  updated = updated.replace(
    'src="https://storage.googleapis.com/claat-public/native-shim.js"',
    'src="assets/native-shim.js"',
  );
  updated = updated.replace(
    'src="https://storage.googleapis.com/claat-public/custom-elements.min.js"',
    'src="assets/custom-elements.min.js"',
  );
  updated = updated.replace(
    'src="https://storage.googleapis.com/claat-public/prettify.js"',
    'src="assets/prettify.js"',
  );
  updated = updated.replace(
    'src="https://storage.googleapis.com/claat-public/codelab-elements.js"',
    'src="assets/codelab-elements.js"',
  );
  updated = updated.replace(
    '  <script src="//support.google.com/inapp/api.js"></script>\n',
    "",
  );
  updated = updated.replace(
    '  <script src="https://support.google.com/inapp/api.js"></script>\n',
    "",
  );

  if (!updated.includes('rel="icon"')) {
    updated = updated.replace(
      '  <link rel="stylesheet" href="assets/codelab-elements.css">\n',
      '  <link rel="stylesheet" href="assets/codelab-elements.css">\n' +
        "  <link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='8' fill='%234F7DC9'/%3E%3C/svg%3E\">\n",
    );
  }

  if (!updated.includes(".copyable-code {")) {
    updated = updated.replace(
      "  </style>",
      [
        "    .code-block-wrapper {",
        "      position: relative;",
        "    }",
        "    .copyable-code {",
        "      padding-right: 56px;",
        "    }",
        "    .copy-code-button {",
        "      position: absolute;",
        "      top: 12px;",
        "      right: 12px;",
        "      display: inline-flex;",
        "      align-items: center;",
        "      justify-content: center;",
        "      width: 36px;",
        "      height: 36px;",
        "      border: 0;",
        "      border-radius: 999px;",
        "      background: rgba(255, 255, 255, 0.12);",
        "      color: #fff;",
        "      cursor: pointer;",
        "    }",
        "    .copy-code-button svg {",
        "      width: 18px;",
        "      height: 18px;",
        "      fill: currentColor;",
        "    }",
        "    .copy-code-button:hover {",
        "      background: rgba(255, 255, 255, 0.22);",
        "    }",
        "    .copy-code-button::after {",
        "      content: attr(aria-label);",
        "      position: absolute;",
        "      top: calc(100% + 6px);",
        "      right: 0;",
        "      padding: 4px 8px;",
        "      border-radius: 6px;",
        "      background: rgba(32, 33, 36, 0.92);",
        "      color: #fff;",
        "      font: 500 12px/1.2 Roboto, sans-serif;",
        "      white-space: nowrap;",
        "      opacity: 0;",
        "      pointer-events: none;",
        "      transform: translateY(-2px);",
        "      transition: opacity 0.15s ease, transform 0.15s ease;",
        "    }",
        "    .copy-code-button:hover::after,",
        "    .copy-code-button:focus-visible::after {",
        "      opacity: 1;",
        "      transform: translateY(0);",
        "    }",
        "    .image-link {",
        "      display: inline-block;",
        "    }",
        "  </style>",
      ].join("\n"),
    );
  }

  if (!updated.includes("function getCopyButtonIcon(iconName)")) {
    updated = updated.replace(
      "\n</body>\n</html>\n",
      [
        "  <script>",
        "    (function () {",
        "      function getCopyButtonIcon(iconName) {",
        '        if (iconName === "done") {',
        '          return \'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"></path></svg>\';',
        "        }",
        "",
        '        if (iconName === "error") {',
        '          return \'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path></svg>\';',
        "        }",
        "",
        '        return \'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"></path></svg>\';',
        "      }",
        "",
        "      function enhanceCodeBlocks() {",
        '        document.querySelectorAll("google-codelab-step pre").forEach(function (pre) {',
        '          if (pre.dataset.copyEnhanced === "true") {',
        "            return;",
        "          }",
        "",
        '          var code = pre.querySelector("code");',
        "          if (!code) {",
        "            return;",
        "          }",
        "",
        '          pre.dataset.copyEnhanced = "true";',
        '          pre.classList.add("copyable-code");',
        "",
        "          var wrapper = pre.parentElement;",
        '          if (!wrapper || !wrapper.classList.contains("code-block-wrapper")) {',
        '            wrapper = document.createElement("div");',
        '            wrapper.className = "code-block-wrapper";',
        "            pre.parentNode.insertBefore(wrapper, pre);",
        "            wrapper.appendChild(pre);",
        "          }",
        "",
        '          var button = document.createElement("button");',
        '          button.type = "button";',
        '          button.className = "copy-code-button";',
        '          button.setAttribute("aria-label", "Copiar amostra de código");',
        '          button.innerHTML = getCopyButtonIcon("copy");',
        "",
        '          button.addEventListener("click", async function () {',
        "            try {",
        '              await navigator.clipboard.writeText(code.textContent || "");',
        '              button.setAttribute("aria-label", "Código copiado");',
        '              button.innerHTML = getCopyButtonIcon("done");',
        "            } catch (error) {",
        '              button.setAttribute("aria-label", "Falha ao copiar");',
        '              button.innerHTML = getCopyButtonIcon("error");',
        "            }",
        "",
        "            window.setTimeout(function () {",
        '              button.setAttribute("aria-label", "Copiar amostra de código");',
        '              button.innerHTML = getCopyButtonIcon("copy");',
        "            }, 1500);",
        "          });",
        "",
        "          wrapper.appendChild(button);",
        "        });",
        "      }",
        "",
        "      function enhanceImages() {",
        '        document.querySelectorAll("p.image-container img").forEach(function (img) {',
        '          if (!img.getAttribute("src")) {',
        "            return;",
        "          }",
        "",
        "          var parent = img.parentElement;",
        '          if (parent && parent.tagName === "A") {',
        "            return;",
        "          }",
        "",
        '          var link = document.createElement("a");',
        '          link.href = img.getAttribute("src");',
        '          link.target = "_blank";',
        '          link.rel = "noopener noreferrer";',
        '          link.className = "image-link";',
        "          img.replaceWith(link);",
        "          link.appendChild(img);",
        "        });",
        "      }",
        "",
        '      document.addEventListener("DOMContentLoaded", function () {',
        "        enhanceCodeBlocks();",
        "        enhanceImages();",
        "",
        "        var observer = new MutationObserver(function () {",
        "          enhanceCodeBlocks();",
        "          enhanceImages();",
        "        });",
        "",
        "        observer.observe(document.body, {",
        "          childList: true,",
        "          subtree: true",
        "        });",
        "      });",
        "    })();",
        "  </script>",
        "",
        "</body>",
        "</html>",
        "",
      ].join("\n"),
    );
  }

  return updated;
}
