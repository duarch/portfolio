# Ações manuais para publicar o suporte

Execute este checklist na raiz do repositório e na ordem abaixo. **Os comandos desta página não foram executados contra serviços reais pelo agente.** A criação de recursos, a configuração de DNS/painéis e o deploy são ações manuais do responsável. Não cole valores reais de segredos em chat, issue ou commit.

## 1. Validar a implementação local

- [ ] Usar Node.js 22.13 ou superior (recomendado: Node.js 24) e instalar dependências locais:

  ```sh
  node --version
  npm ci
  npm test
  npm run build:support
  npm run support:migrate:local
  npm run support:check
  ```

- [ ] Abrir dois terminais. No primeiro:

  ```sh
  npm run dev:support:api
  ```

  No segundo:

  ```sh
  npm run dev:support
  ```

  Abrir `http://127.0.0.1:3000/support/`, testar os três idiomas, validações, imagem, vídeo, remoção e sucesso com protocolo. Esse ambiente usa D1 local e mocks; não precisa de `.env` nem `.dev.vars.local` e não envia arquivos/e-mails para serviços reais. O D1 persiste em `.wrangler/`, mas os anexos simulados somem ao reiniciar o Worker.

  Se fizer outro build com o Worker aberto e os assets passarem a responder `404`, encerrar e reiniciar `npm run dev:support:api` para renovar o observador de `dist/support`.

## 2. Revisar privacidade e escolhas de produto

- [ ] Revisar [DECISIONS.md](./DECISIONS.md), especialmente os padrões D3 a D7.
- [ ] Revisar a política completa publicada em `https://duar.ch/support/privacy/`. Definir o prazo de retenção dos tickets e o procedimento para pedidos de exclusão via `support@duar.ch`; considerar D1, R2, caixas de e-mail e backups. A implementação não apaga tickets automaticamente.
- [x] Revisar o aviso curto nas três traduções (`ui.privacyNotice` e `ui.privacyReview`) e a versão `CONSENT_VERSION` em `support/shared/config.js`. Remover a marcação de revisão somente depois de concluir essa revisão. Não publicar o aviso com prazo de tickets ainda indefinido.

## 3. Preparar a conta e o D1

- [x] Autenticar manualmente o Wrangler na conta correta:

  ```sh
  npx wrangler login
  npx wrangler whoami
  ```

  Se houver múltiplas contas, selecionar a conta esperada no Wrangler ou definir `CLOUDFLARE_ACCOUNT_ID` no seu terminal com o ID real; isso não é um segredo do Worker.

- [x] Criar o banco de produção:

  ```sh
  npx wrangler d1 create support-db
  ```

  Copiar o `database_id` retornado para `d1_databases[0].database_id` **no nível principal** de `wrangler.jsonc`. Manter o ID fictício dentro de `env.local`. Se esse banco já existir na conta, usar seu ID em vez de criar outro. O binding continua `DB`, o nome `support-db` e o diretório de migrações `support/migrations`.

## 4. Confirmar os provedores já previstos

- [x] No Turnstile, criar o widget para `duar.ch` e obter site key e secret key correspondentes. A site key é pública; a secret key vai somente no servidor. As chaves de teste do exemplo são exclusivas de desenvolvimento.
- [x] No Resend, confirmar o subdomínio real verificado (premissa `notify.duar.ch`) e os remetentes `form@notify.duar.ch` e `support@notify.duar.ch`. Criar uma API key com permissão apenas de envio e restrição ao domínio, se disponível. **Manter tracking de abertura e de cliques desligado.**
- [x] Confirmar que `support@duar.ch` continua recebendo pelo Zoho. O código não depende de SMTP do Zoho e não altera seus registros MX.
- [x] Confirmar as configurações R2 já existentes, sem recriar bucket ou liberar acesso público: `duarch-support-attachments`, credencial Object Read & Write restrita a esse bucket, endpoint S3 da conta, retenção de objetos de 90 dias e CORS de produção somente para `https://duar.ch`, com PUT e Content-Type, expondo ETag.
- [ ] Confirmar no dry-run/deploy que `ATTACHMENTS` aparece como binding R2 para `duarch-support-attachments`. O Worker usa esse binding para validar e promover anexos; as credenciais S3 permanecem necessárias para URLs temporárias.
- [ ] Confirmar que `R2_API_URL` no `wrangler.jsonc` corresponde a `https://ba0a5a6e4e035092742595d302d1d39c.r2.cloudflarestorage.com/duarch-support-attachments`.
- [ ] No CORS do bucket, manter `https://duar.ch`. Para o fluxo local atual, substituir `http://localhost:3000` por `http://127.0.0.1:3000`; origens com hostnames diferentes não são equivalentes para o navegador.
- [ ] Opcional: adicionar uma regra de ciclo de vida para apagar apenas `pending/` após um dia, mantendo a retenção de 90 dias para os anexos dos tickets. Essa regra não limpa os metadados D1.

## 5. Preencher configuração e segredos

- [x] Criar um arquivo local ignorado sem sobrescrever um arquivo existente:

  ```sh
  cp -n .env.example .env
  chmod 600 .env
  ```

  Preencher os valores reais em editor local. Nenhum valor de exemplo entre `<...>` deve permanecer no arquivo de publicação.

- [x] Gerar **dois valores diferentes**, um para `ADMIN_API_TOKEN` e outro para `UPLOAD_SIGNING_SECRET`. Executar uma vez para cada segredo e copiar o resultado para a variável correspondente no editor:

  ```sh
  openssl rand -hex 32
  openssl rand -hex 32
  ```

  Esses valores são gerados por você, não pelo agente; não os reutilize entre as duas variáveis ou entre ambientes.

- [x] Editar `vars` **de produção** em `wrangler.jsonc` com `SUPPORT_ORIGIN=https://duar.ch`, `SUPPORT_MOCK_SERVICES=false`, `R2_BUCKET`, `SUPPORT_INBOX`, remetentes, `TURNSTILE_SITE_KEY` real e `PRIVACY_POLICY_URL=https://duar.ch/support/privacy/`. O código rejeita tickets de produção sem a URL HTTPS configurada.
- [x] Deixar `.env` com **somente** estas variáveis, todas preenchidas: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_API_TOKEN`, `UPLOAD_SIGNING_SECRET`. Remover de `.env` as variáveis públicas, `CLOUDFLARE_ACCOUNT_ID` e `D1_DATABASE_ID`, pois já foram configuradas nos locais próprios. O arquivo será usado para publicar os segredos em conjunto com o código.
- [x] Confirmar que `.env` está ignorado e conferir apenas o estado dos arquivos, sem imprimir segredos:

  ```sh
  git check-ignore .env
  git status --short
  ```

  Não exportar nem usar esse `.env` de produção no fluxo local com mocks. Não criar `.dev.vars.local` com credenciais de produção.

## 6. Preparar o Worker e a origem da API

- [x] Publicar o Worker manualmente com `workers_dev=true`. Copiar a URL `https://<worker>.<subdomínio>.workers.dev` exibida pelo Wrangler; ela é a origem da API e não deve ser confundida com `https://duar.ch`.
- [x] Criar/confirmar o hostname do widget Turnstile como `duar.ch` (a página continua no GitHub Pages). O Worker valida o hostname retornado pelo Turnstile.
- [x] Em GitHub, abrir Settings → Secrets and variables → Actions → Variables e criar `VITE_SUPPORT_API_BASE` com a URL completa `https://<worker>.<subdomínio>.workers.dev`. Variáveis de Actions são públicas no artefato final; não coloque segredos nesse campo.
- [x] A página estática envia `Origin: https://duar.ch`; o Worker permite exatamente essa origem. Não adicione `*`, credenciais ou cookies ao CORS.
- [ ] Se forem usados previews reais: criar Worker/banco/configuração isolados, definir `SUPPORT_ORIGIN` como a origem exata do preview e adicioná-la ao CORS do bucket antes de testar. A API não aceita automaticamente qualquer origem de preview. Não compartilhar banco e segredos de produção com previews.
- [ ] Se você decidir testar contra serviços reais em `http://127.0.0.1:3000`, usar um ambiente e bucket de teste próprios e liberar essa origem exata apenas neles. Esse ajuste não é necessário para os mocks locais.

## 7. Aplicar migração e publicar manualmente

- [ ] Aplicar a migração remota depois de confirmar conta e `database_id`:

  ```sh
  npx wrangler d1 migrations list support-db --remote
  npm run support:migrate:remote
  npx wrangler d1 migrations list support-db --remote
  ```

  Confirmar que `0002_email_payload.sql` aparece como aplicada. Sem essa migração, o ticket é gravado e recebe protocolo, mas os trabalhos de e-mail falham antes da chamada ao Resend.

- [ ] Executar a validação final, gerar a página estática para o GitHub Pages e conferir o pacote da API:

  ```sh
  npm test
  npm run build:support
  npm run support:check
  ```

- [ ] Publicar **manualmente**, já com `.env` contendo somente os segredos e `vars` contendo a configuração pública revisada:

  ```sh
  npx wrangler deploy --env '' --secrets-file .env
  ```

  Esse comando faz deploy e envia os segredos para o Worker de produção. A opção `--env ''` seleciona o nível principal, e não o ambiente `local`. Não usar `--env local` em produção. O [procedimento de segredos do Wrangler](https://developers.cloudflare.com/workers/configuration/secrets/) aceita `.env` e JSON; nenhum segredo real está versionado neste repositório. A publicação do Worker não substitui o workflow do portfólio no GitHub Pages.

## 8. Testar o fluxo em produção

- [ ] Abrir `https://duar.ch/support/`, confirmar ausência de erros de assets/CSP, os três idiomas, persistência do idioma e o link real de privacidade. Confirmar que o restante de `https://duar.ch` continua atendido pelo portfólio.
- [ ] Enviar um ticket real com imagem e vídeo válidos e a opção de retorno marcada. Guardar o protocolo, conferir os objetos privados no prefixo `tickets/<protocolo>/` e a remoção dos originais `pending/` do ticket concluído.
- [ ] Conferir a caixa de entrada **e o spam do Zoho**. O aviso interno deve ter todos os dados e links de anexo por sete dias; a confirmação ao solicitante deve ter protocolo, cópia do pedido e somente nomes dos anexos. Testar o Reply-To de ambos.
- [ ] Se um e-mail cair no spam do Zoho, marcar como “não é spam” e criar um filtro para o subdomínio de envio confirmado.
- [ ] Em zsh, solicitar o token administrativo sem ecoá-lo e definir o protocolo retornado no teste:

  ```sh
  read -rs 'SUPPORT_ADMIN_TOKEN?Token administrativo: '
  printf '\n'
  SUPPORT_API_BASE='https://duarch-support-api.<seu-subdominio>.workers.dev'
  SUPPORT_PROTOCOL='DUAR-2026-000001'
  ```

  Substituir o protocolo do exemplo pelo real antes de executar:

  ```sh
  curl --fail-with-body --request POST \
    "$SUPPORT_API_BASE/api/support/admin/status" \
    --header "Authorization: Bearer $SUPPORT_ADMIN_TOKEN" \
    --header 'Content-Type: application/json' \
    --data "{\"protocolo\":\"$SUPPORT_PROTOCOL\",\"status\":\"in_review\",\"mensagem\":\"Estamos analisando sua solicitação.\"}"

  curl --fail-with-body --get \
    "$SUPPORT_API_BASE/api/support/admin/attachment-links" \
    --header "Authorization: Bearer $SUPPORT_ADMIN_TOKEN" \
    --data-urlencode "protocol=$SUPPORT_PROTOCOL"

  curl --fail-with-body --get \
    "$SUPPORT_API_BASE/api/support/admin/diagnostics" \
    --header "Authorization: Bearer $SUPPORT_ADMIN_TOKEN" \
    --data-urlencode "protocol=$SUPPORT_PROTOCOL"

  curl --fail-with-body --request POST \
    "$SUPPORT_API_BASE/api/support/admin/retry-emails" \
    --header "Authorization: Bearer $SUPPORT_ADMIN_TOKEN" \
    --header 'Content-Type: application/json' \
    --data "{\"protocol\":\"$SUPPORT_PROTOCOL\"}"

  unset SUPPORT_ADMIN_TOKEN SUPPORT_API_BASE SUPPORT_PROTOCOL
  ```

  Para protocolos já criados sem e-mail, aplicar primeiro a migração pendente, publicar o Worker corrigido, consultar `diagnostics` e então chamar `retry-emails`. Os trabalhos foram preservados no D1 e não exigem criar outro ticket.

- [ ] Confirmar e-mail de atualização no idioma do ticket e funcionamento dos links novos. Enviar outro ticket com retorno desmarcado: a confirmação deve chegar e uma alteração de status não deve enviar atualização. Repetir uma mudança para o mesmo estado não deve duplicar eventos/avisos.
- [ ] Confirmar que endpoints administrativos sem bearer token respondem `401`. Os exemplos e estados completos estão no [README](./README.md#api-administrativa).

## 9. Operação e manutenção

- [ ] Acompanhar os limites Resend (100 e-mails/dia, 3.000/mês), R2 Standard (franquia de 10 GB-mês e operações) e quotas do D1/Worker. O R2 pode cobrar pelo excedente; o aplicativo não configura um bloqueio de faturamento.
- [ ] Quando houver falha de e-mail, corrigir configuração ou aguardar a quota e chamar `retry-emails` novamente, conferindo `sent`, `failed` e `skipped`. Cada chamada tenta até três trabalhos; repetir até retornar `sent: 0` e `failed: 0`, aguardando trabalhos reservados quando necessário. Não há cron automático. Se receber `429`, aguardar a janela de limite de dez minutos. Após interrupção, esperar a reserva de dois minutos antes de recuperar o trabalho. Os payloads ficam estáveis nas tentativas e são renovados depois de seis dias; respeitar a possibilidade de duplicação fora da janela de idempotência de 24 horas do provedor descrita no README.
- [ ] Executar o procedimento definido para exclusão de dados quando solicitado e revisar a retenção dos tickets. A regra R2 de 90 dias não apaga banco, e-mails ou backups.
- [ ] Rotacionar imediatamente qualquer chave exposta em chat, issue ou commit e atualizar o segredo do Worker. Para rotação regular, seguir o [README](./README.md#rotação-de-chaves); revogar a chave antiga e conferir o funcionamento. A troca de `UPLOAD_SIGNING_SECRET` invalida provas pendentes de até uma hora; a troca de credenciais R2 pode invalidar links existentes.
