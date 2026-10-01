# Como criar e validar um usuário SSH no GitHub

Este guia explica como gerar uma chave SSH, associá-la a uma conta do GitHub e validar que a autenticação está funcionando corretamente. É útil principalmente quando a máquina precisa acessar repositórios com **mais de uma conta GitHub** (ex: conta pessoal e conta corporativa).

## 1. Verificar chaves SSH existentes

Antes de criar uma nova chave, confira o que já existe para não sobrescrever nada:

```bash
ls -la ~/.ssh/
```

Se já existir uma chave (`id_rsa`, `id_ed25519`, etc.) sendo usada por outra conta ou serviço, **não a reutilize** para a nova conta. Crie uma chave dedicada.

## 2. Gerar uma nova chave SSH

```bash
ssh-keygen -t ed25519 -C "nome-do-usuario-github" -f ~/.ssh/id_ed25519_NOME_DA_CONTA -N ""
```

- `-t ed25519`: algoritmo recomendado atualmente (mais seguro e rápido que RSA).
- `-C`: comentário para identificar a chave (use o nome do usuário GitHub).
- `-f`: caminho/nome do arquivo da chave. Use um nome que identifique a conta, ex: `id_ed25519_totvs`.
- `-N ""`: cria a chave sem senha (passphrase). Para mais segurança, omita esse parâmetro e defina uma senha quando solicitado.

Isso gera dois arquivos:
- `id_ed25519_NOME_DA_CONTA` — chave **privada** (nunca compartilhe ou commite esse arquivo).
- `id_ed25519_NOME_DA_CONTA.pub` — chave **pública** (essa é cadastrada no GitHub).

## 3. Cadastrar a chave pública no GitHub

1. Exiba o conteúdo da chave pública:
   ```bash
   cat ~/.ssh/id_ed25519_NOME_DA_CONTA.pub
   ```
2. Logado na conta GitHub correta, acesse: https://github.com/settings/ssh/new
3. Cole o conteúdo da chave no campo **Key**.
4. Dê um título que identifique a máquina/propósito (ex: "Notebook Totvs - Linux").
5. Clique em **Add SSH key**.

## 4. Configurar o SSH para usar a chave certa por host

Quando há mais de uma conta GitHub na mesma máquina, use um **alias de host** no arquivo `~/.ssh/config` para que o Git saiba qual chave usar em cada caso:

```
Host github-NOME_DA_CONTA
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_NOME_DA_CONTA
    IdentitiesOnly yes
```

- `IdentitiesOnly yes` garante que **apenas** essa chave seja oferecida para esse host, evitando que o SSH tente outra chave por engano.

## 5. Validar a autenticação

Teste a conexão com o alias configurado:

```bash
ssh -T github-NOME_DA_CONTA
```

Se tudo estiver correto, o retorno deve ser:

```
Hi NOME_DO_USUARIO_GITHUB! You've successfully authenticated, but GitHub does not provide shell access.
```

> A mensagem "does not provide shell access" é esperada — o GitHub não oferece shell, apenas confirma a autenticação.

Se aparecer `Permission denied (publickey)`, revise:
- Se a chave pública foi realmente cadastrada na conta certa.
- Se o `~/.ssh/config` está apontando para o arquivo de chave privada correto.
- Se o arquivo de chave privada tem permissão `600` (`chmod 600 ~/.ssh/id_ed25519_NOME_DA_CONTA`).

## 6. Apontar o repositório para usar o alias configurado

Atualize a URL do remote do repositório Git para usar o alias em vez de `github.com` diretamente:

```bash
git remote set-url origin github-NOME_DA_CONTA:ORGANIZACAO/REPOSITORIO.git
```

Confirme a alteração:

```bash
git remote -v
```

## 7. Validar acesso de leitura e escrita no repositório

```bash
git fetch origin
git push origin NOME_DA_BRANCH --dry-run
```

- `git fetch` confirma acesso de **leitura**.
- `git push --dry-run` simula o push sem enviar nada, confirmando acesso de **escrita** sem risco.

Se o `push --dry-run` retornar `Everything up-to-date` ou simular o envio sem erro, a conta tem permissão de push no repositório.

## Erros comuns

| Erro | Causa provável | Solução |
|---|---|---|
| `Permission denied to USUARIO. fatal: Could not read from remote repository.` | A chave usada autentica com uma conta sem acesso ao repositório | Verificar qual conta está autenticando (`ssh -T git@github.com`) e garantir que ela é colaboradora do repositório ou membro da organização |
| `Permission denied (publickey)` | Chave pública não cadastrada, ou SSH está tentando a chave errada | Cadastrar a chave pública na conta certa e usar `IdentitiesOnly yes` no `~/.ssh/config` |
| Autentica com a conta errada mesmo tendo mais de uma chave | SSH tentando chaves na ordem padrão antes do alias configurado | Usar um `Host` dedicado no `~/.ssh/config` e apontar o remote do Git para esse alias |

## Checklist rápido

- [ ] Chave SSH gerada com `ssh-keygen`
- [ ] Chave pública cadastrada em https://github.com/settings/ssh/new na conta correta
- [ ] Alias de `Host` configurado em `~/.ssh/config`
- [ ] `ssh -T github-NOME_DA_CONTA` retorna "successfully authenticated"
- [ ] Remote do repositório atualizado para usar o alias
- [ ] `git fetch` e `git push --dry-run` funcionam sem erro de permissão
