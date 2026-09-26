
# Comando para encontrar commits no projetos
git show --stat e1efa09


# Comando sendo utilizado no pipeline para retornar mudanças nos datasets
git show --stat $(git rev-list --max-parents=0 HEAD | tail -n 1)


# Checagem quando o repositório ainda não tem mudanças

BASE="${{ github.event.before }}"
# Em branch recém-criada o `before` vem vazio ou só com zeros.
# Nesse caso, usamos o primeiro commit do repositório como base.
if [[ -z "$BASE" || "$BASE" == "0000000000000000000000000000000000000000" ]]; then
    BASE="$(git rev-list --max-parents=0 HEAD | tail -n 1)"
fi

<!-- GITHUB_SHA é uma variável de ambiente padrão do GitHub Actions que armazena o SHA (o código hash de identificação) do commit que acionou a execução do fluxo de trabalho (workflow). -->

GITHUB_SHA=740908d80c1edd0528167d00af9e60740416fecb
BASE=$(git rev-list --max-parents=0 HEAD | tail -n 1)
DATASETS="$(git diff --name-only "$BASE" "$GITHUB_SHA" | grep '^datasets/.*\.js$' || true)"

# Mostra no log quais datasets foram selecionados.
echo "Selecionados:"
printf '%s\n' "$DATASETS"
