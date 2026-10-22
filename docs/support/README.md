# Suporte duar.ch

A página `/support/` e a política completa de `docs/support/privacy_policy.md`, convertida em HTML semântico durante o build e publicada em `/support/privacy/`, são arquivos estáticos do GitHub Pages. A API roda separadamente em um Cloudflare Worker `workers.dev` com D1; o formulário usa a URL definida em `VITE_SUPPORT_API_BASE`. A entrada HTML do suporte é independente e não carrega os scripts de analytics da página principal.

Nenhuma conta, chave, migração remota, alteração de DNS ou publicação é feita por esta documentação. Execute a preparação de produção na ordem de [MANUAL_ACTIONS.md](./MANUAL_ACTIONS.md). As escolhas de produto e arquitetura estão em [DECISIONS.md](./DECISIONS.md). A zona DNS de `duar.ch` permanece no Netlify; não é necessário migrá-la para a Cloudflare.

## Desenvolvimento local

Use Node.js **22.13 ou superior** e npm; **Node.js 24 é a versão recomendada e usada na CI**. Todos os comandos abaixo partem da raiz do repositório e usam as dependências locais; não instale ferramentas globais.

```sh
npm ci
npm run build:support
npm run support:migrate:local
npm test
```

Em um terminal:

```sh
npm run dev:support:api
```

Em outro:

```sh
npm run dev:support
```

Abra `http://127.0.0.1:3000/support/`. O Vite encaminha `/api/support/*` para o Worker local em `127.0.0.1:8787`. Use esse endereço exato: `localhost` e `127.0.0.1` são origens diferentes.

O ambiente Wrangler `local` possui apenas valores fictícios, `SUPPORT_MOCK_SERVICES=true` e D1 local. R2, Resend e Turnstile são substituídos por implementações em memória: nenhum arquivo é enviado para um bucket, nenhum e-mail sai e nenhum desafio externo é solicitado. O D1 local persiste em `.wrangler/`; os objetos de teste e a entrega simulada de e-mails pertencem ao processo e são perdidos ao reiniciá-lo. Um ticket local pode continuar no D1 depois que seus anexos simulados desaparecerem.

Não é necessário criar `.env`, `.dev.vars` ou `.dev.vars.local` para esse fluxo. Os scripts locais desabilitam a leitura automática de arquivos `.env`; não crie arquivos `.dev.vars*` com credenciais reais para esse ambiente. Não exporte credenciais de produção no terminal de desenvolvimento. Os mocks também dependem de um hostname local; a mesma flag não habilita simulação em um domínio público.

As chaves oficiais de teste do Turnstile estão comentadas em `.env.example` como referência. O fluxo padrão usa o mock local e não faz a chamada real de verificação. Um teste contra provedores reais exige uma decisão explícita do responsável, variáveis separadas e CORS compatível; não faz parte dos testes automatizados.

## Verificação e builds

```sh
npm test
npm run test:support
npm run build:support
npm run support:check
```

`npm test` e `test:support` executam Vitest com mocks de R2, Resend e Turnstile e verificam os schemas, idiomas, anexos, fluxo dos tickets, e-mails e endpoints administrativos. `support:check` seleciona o nível principal com `--env ''` e gera o pacote Wrangler em `/tmp/duarch-support-worker` com `--dry-run`; não publica o Worker. Faça o build do suporte antes dessa verificação.

`npm run build` gera o portfólio, `/support/` e `/support/privacy/`. O workflow do GitHub Pages publica todo `dist/`, incluindo `dist/support`. A URL pública da API vem da variável de repositório `VITE_SUPPORT_API_BASE`; ela não é segredo. O Worker é publicado separadamente, sem nenhum deploy no workflow do site.

O binding `ASSETS` existe somente em `env.local` para o fluxo com `wrangler dev`. O Worker de produção não empacota nem serve `/support/`; caminhos fora da API respondem `404`.

Se `npm run build` ou `build:support` recriar `dist` enquanto o Worker local estiver aberto, o observador de assets pode passar a responder `404`. Encerre e reinicie `npm run dev:support:api` depois do build. O endereço direto `http://127.0.0.1:8787/support/` deve então servir a página compilada; o Vite em `127.0.0.1:3000` continua sendo a opção para editar o formulário.

## Configuração

`.env.example` é a referência sem credenciais reais. Arquivos `.env*` e `.dev.vars*` estão ignorados, com exceção dos exemplos. O navegador recebe somente a configuração pública necessária pelo endpoint `/api/support/config`; as credenciais do R2, Resend e Turnstile ficam no servidor.

### Variáveis públicas do Worker

Configure estes valores no objeto `vars` de produção em `wrangler.jsonc` ou no painel, mantendo uma fonte de configuração consistente para as próximas publicações:

| Nome | Valor ou finalidade |
| --- | --- |
| `SUPPORT_ORIGIN` | `https://duar.ch`; uma origem exata autorizada para a API pública. |
| `VITE_SUPPORT_API_BASE` | URL `https://<worker>.<subdomínio>.workers.dev` usada somente no build do GitHub Pages. |
| `SUPPORT_MOCK_SERVICES` | `false` em produção. |
| `R2_BUCKET` | `duarch-support-attachments`, bucket privado existente. |
| `R2_API_URL` | URL S3 completa do bucket, definida em `wrangler.jsonc`. |
| `SUPPORT_INBOX` | `support@duar.ch`, caixa existente no Zoho. |
| `EMAIL_FROM_INTERNAL` | Padrão `form@notify.duar.ch`, pertencente ao domínio verificado no Resend. |
| `EMAIL_FROM_USER` | Padrão `support@notify.duar.ch`, pertencente ao domínio verificado no Resend. |
| `TURNSTILE_SITE_KEY` | Chave pública do widget habilitado para `duar.ch`. |
| `PRIVACY_POLICY_URL` | URL HTTPS absoluta para a política revisada. Obrigatória para aceitar tickets em produção. |

O mesmo bucket está ligado ao Worker como `ATTACHMENTS` em `r2_buckets`. O binding é usado primeiro nas operações internas de validação, promoção e limpeza. Se uma operação interna falhar temporariamente, o Worker repete pela API S3 autenticada e registra `support_r2_s3_fallback`. As credenciais S3 também geram os PUTs e GETs temporários usados pelo navegador e pelos e-mails internos.

### Segredos do Worker

| Nome | Finalidade |
| --- | --- |
| `R2_ACCOUNT_ID` | Conta que fornece o endpoint S3 do bucket. |
| `R2_ACCESS_KEY_ID` | Credencial R2 com permissão de leitura e escrita restrita ao bucket. |
| `R2_SECRET_ACCESS_KEY` | Segredo da credencial R2. |
| `RESEND_API_KEY` | Chave com permissão de envio, restrita ao domínio quando disponível. |
| `TURNSTILE_SECRET_KEY` | Segredo de verificação do widget. |
| `ADMIN_API_TOKEN` | Token administrativo aleatório independente, com pelo menos 32 caracteres. |
| `UPLOAD_SIGNING_SECRET` | Segredo aleatório independente, com pelo menos 32 caracteres; autentica as referências de anexos. |

### D1 e conta de publicação

O banco é um binding chamado `DB`, configurado em `d1_databases` de `wrangler.jsonc`, e não uma URL de conexão. `D1_DATABASE_ID` no exemplo serve para registrar o ID retornado pela criação manual: copie-o para `d1_databases[0].database_id` no nível de produção. O ambiente `local` continua com seu ID fictício. `CLOUDFLARE_ACCOUNT_ID` seleciona a conta do Wrangler quando necessário; não é uma credencial de acesso ao banco nem precisa ser enviado ao Worker. A autenticação do Wrangler é feita manualmente pelo responsável.

Para publicação com `--secrets-file`, mantenha `.env` contendo **somente as sete variáveis da tabela de segredos**, preenchidas com valores reais. Os demais valores ficam em `wrangler.jsonc`; remova de `.env` `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID` e todas as variáveis públicas após usar o exemplo como referência. Assim nenhum placeholder ou variável pública duplicada é publicado como segredo. O procedimento completo está no checklist manual. O [Wrangler aceita um arquivo `.env` ou JSON ao publicar os segredos junto do código](https://developers.cloudflare.com/workers/configuration/secrets/).

## Comportamento dos tickets

Os campos obrigatórios são nome, e-mail válido, país, app, descrição de 20 a 5.000 caracteres e consentimento. Telefone, cidade e anexos são opcionais; o telefone informado é validado com `libphonenumber-js` e armazenado em E.164. A opção de retorno vem marcada. A confirmação é enviada mesmo quando o usuário desmarca o retorno; essa preferência controla os e-mails de mudança de status.

O servidor gera `DUAR-AAAA-NNNNNN` com contador anual atômico no D1. O ticket, os metadados dos anexos e os trabalhos de e-mail são persistidos antes de tentar enviar mensagens. Uma falha de e-mail preserva o ticket e o protocolo de sucesso; o administrador pode reenviar os trabalhos pendentes. Não existe página pública de acompanhamento nem link mágico.

O cliente gera uma chave UUID `Idempotency-Key` para o envio do ticket e a reutiliza nas tentativas do mesmo conteúdo. O servidor verifica também uma impressão do conteúdo; a mesma chave com dados diferentes é rejeitada. Isso permite repetir uma solicitação quando a resposta foi perdida sem criar outro protocolo.

Os estados armazenados são `received`, `in_review`, `awaiting_user` e `resolved`, com rótulos traduzidos. Alterar para o mesmo estado não cria evento ou aviso duplicado. Cada mudança efetiva grava um evento com mensagem opcional e agenda aviso somente se o ticket pediu retorno.

### Anexos

Os limites ficam em `support/shared/config.js`: cinco arquivos, até 10 MB por imagem e 50 MB por vídeo, usando 1 MB = 1.048.576 bytes. São aceitos JPEG/JPG, PNG, WebP, HEIC, MP4, QuickTime/MOV e WebM. A extensão da chave deriva do MIME validado, nunca do nome enviado.

O fluxo usa `POST /api/support/uploads` para reservar metadados e obter URLs de **PUT** pré-assinadas por 15 minutos. O navegador faz o upload direto, com progresso. A reserva tem validade de uma hora e uma prova HMAC vinculada à chave, tipo, tamanho, nome e expiração. A prova impede associar ao ticket um objeto de outro solicitante apenas conhecendo sua chave.

Ao receber o ticket, o servidor valida todas as provas e reserva os anexos para aquele processamento; exige chaves `pending/<uuid>.<ext>`, consulta tamanho e tipo e lê os primeiros 8 KiB pelo binding `ATTACHMENTS` para verificar o conteúdo real. Anexos inválidos são apagados e rejeitados. Falhas temporárias de leitura preservam o arquivo para nova tentativa. Os arquivos válidos são copiados por streaming para `tickets/<PROTOCOLO>/...`; os originais pendentes são removidos depois da gravação durável do ticket. A regra existente do bucket remove os objetos após 90 dias.

Somente o aviso interno contém links GET pré-assinados por sete dias. A confirmação ao usuário contém apenas os nomes dos arquivos. O endpoint administrativo pode emitir novos links enquanto o objeto ainda existir; ele não restaura objetos apagados pela retenção. URLs e provas expiram também se as credenciais correspondentes forem revogadas. Uploads removidos ou abandonados antes de um ticket ficam cobertos pela regra do bucket; recomenda-se a regra opcional de um dia para `pending/`.

### Idioma e apps

O link do portfólio inclui o idioma atual em `?lang=`. Essa preferência tem prioridade, seguida de `localStorage.language` (`pt` é normalizado para `pt-BR`), do cabeçalho `Accept-Language`, considerando os pesos `q`, e do fallback `en`. O seletor salva a escolha na mesma chave que o portfólio usa. O idioma é persistido no ticket e determina os e-mails posteriores. Os nomes de países usam `Intl.DisplayNames` sobre a lista ISO 3166-1 alpha-2.

Para adicionar ou remover um app, edite uma linha de `config/apps.json` e publique novamente o suporte. IDs devem ser únicos e estáveis; mantenha `{ "id": "other", "name": "Other" }` por último. O rótulo desse item vem das traduções. O servidor aceita somente os IDs presentes no arquivo, e os testes validam a estrutura. Remover um app não remove tickets anteriores.

Para adicionar um idioma, crie `support/locales/<idioma>.js` com exatamente as mesmas chaves e placeholders, registre-o em `support/shared/locale.js` e no renderizador de e-mail em `support/server/email.js`, atualize a normalização, o seletor do formulário e o enum de idioma em `support/shared/schema.js`. Crie uma **nova migração** para alterar a restrição `locale` do D1; não edite uma migração já aplicada. Atualize os testes de idioma, execute-os e faça as migrações/publicações necessárias. Os três idiomas atuais já passam pela verificação de igualdade das chaves e placeholders.

## API administrativa

Os endpoints não têm interface ou CORS e exigem `Authorization: Bearer ...`. O token é comparado em tempo constante; ausente ou com menos de 32 caracteres no servidor, o acesso falha fechado. Use HTTPS em produção. Os POSTs exigem `Content-Type: application/json`, inclusive o reenvio sem parâmetros.

Exemplos para **zsh**, executados apenas pelo administrador. O token é solicitado sem ecoar na tela ou ser gravado como um literal no histórico:

```sh
read -rs 'SUPPORT_ADMIN_TOKEN?Token administrativo: '
printf '\n'
SUPPORT_API_BASE='https://duarch-support-api.<seu-subdominio>.workers.dev'
SUPPORT_PROTOCOL='DUAR-2026-000001'
```

Troque o protocolo pelo retornado por um ticket real. Para uso local, `SUPPORT_API_BASE='http://127.0.0.1:8787'` e informe o token fictício de `env.local.vars.ADMIN_API_TOKEN` em `wrangler.jsonc`.

### Mudar status e enviar mensagem opcional

```sh
curl --fail-with-body --request POST \
  "$SUPPORT_API_BASE/api/support/admin/status" \
  --header "Authorization: Bearer $SUPPORT_ADMIN_TOKEN" \
  --header 'Content-Type: application/json' \
  --data "{\"protocolo\":\"$SUPPORT_PROTOCOL\",\"status\":\"in_review\",\"mensagem\":\"Estamos analisando sua solicitação.\"}"
```

Use um dos quatro valores de estado descritos acima. A mensagem é opcional e tem limite de 5.000 caracteres. O e-mail usa o idioma do ticket; o texto livre da mensagem é enviado como foi escrito pelo suporte.

### Reenviar e-mails pendentes ou com falha

```sh
curl --fail-with-body --request POST \
  "$SUPPORT_API_BASE/api/support/admin/retry-emails" \
  --header "Authorization: Bearer $SUPPORT_ADMIN_TOKEN" \
  --header 'Content-Type: application/json' \
  --data "{\"protocol\":\"$SUPPORT_PROTOCOL\"}"
```

O campo `protocol` seleciona os trabalhos daquele ticket. Também é possível enviar `{}` para processar os próximos trabalhos pendentes globalmente. O resultado informa `sent`, `failed` e `skipped`. Cada chamada processa **até três trabalhos**, preservando o orçamento de consultas por invocação do D1 Free. Repita após verificar o retorno e a quota do provedor até uma chamada retornar `sent: 0` e `failed: 0`; trabalhos ainda reservados podem exigir aguardar dois minutos. Se houver falhas, corrija a causa antes de continuar; se receber `429`, aguarde o limite indicado pela janela de dez minutos. Não há cron ou serviço de reenvio automático.

O payload de cada e-mail é armazenado no D1 para repetir conteúdo e links idênticos nas tentativas. Isso evita conflito de idempotência no Resend por gerar uma URL de anexo diferente a cada reenvio. Após seis dias, o conteúdo pode ser renovado com links novos e uma nova chave de envio. O corpo armazenado integra os dados do ticket e segue a retenção definida pelo responsável.

Uma chave estável por payload reduz duplicação durante a [janela de idempotência de 24 horas do Resend](https://resend.com/docs/dashboard/emails/idempotency-keys). A entrega é pelo menos uma vez: se o provedor aceitar o e-mail e o processo falhar antes de marcar o trabalho no D1, um reenvio fora dessa janela pode duplicar a mensagem. A reserva de dois minutos evita processamento simultâneo normal, mas não promete entrega exatamente uma vez.

### Diagnosticar entrega de e-mail

```sh
curl --fail-with-body --get \
  "$SUPPORT_API_BASE/api/support/admin/diagnostics" \
  --header "Authorization: Bearer $SUPPORT_ADMIN_TOKEN" \
  --data-urlencode "protocol=$SUPPORT_PROTOCOL"
```

O retorno não inclui dados pessoais. Ele informa tentativas, trabalhos pendentes, destinos lógicos (`internal`, `confirmation` ou `status`), a presença/formato da chave Resend e códigos seguros como `EMAIL_CONFIGURATION`, `EMAIL_HTTP_403` e `EMAIL_RATE_LIMIT`. Falhas de transporte registram `support_email_provider_fetch_failed` sem incluir a mensagem original ou o segredo. Se todos os trabalhos falharem antes do envio, confirme primeiro que `0002_email_payload.sql` aparece como aplicada no D1 remoto; sem suas colunas, a fila não consegue preparar o payload.

### Gerar novos links dos anexos

```sh
curl --fail-with-body --get \
  "$SUPPORT_API_BASE/api/support/admin/attachment-links" \
  --header "Authorization: Bearer $SUPPORT_ADMIN_TOKEN" \
  --data-urlencode "protocol=$SUPPORT_PROTOCOL"
```

O JSON contém nome, tipo, tamanho e URL válida por sete dias. Trate os links como acesso aos arquivos privados. Ao terminar:

```sh
unset SUPPORT_ADMIN_TOKEN SUPPORT_PROTOCOL SUPPORT_API_BASE
```

## Segurança e privacidade

Os schemas Zod são compartilhados pelo cliente e servidor, são estritos e normalizam textos; o servidor escapa o conteúdo dos usuários nas mensagens HTML e também envia texto simples. Consentimento registra data e `CONSENT_VERSION`, atualmente uma versão explicitamente marcada para revisão. Não há política jurídica inventada: configure uma política real e revise o aviso curto antes de publicar. Tickets em produção são recusados enquanto não houver `PRIVACY_POLICY_URL` HTTPS válido.

Cada chamada protegida consome um token Turnstile diferente. Quando há anexos, o widget é resetado depois do pedido de URLs e um novo token é usado no envio do ticket. O honeypot e limites por IP também protegem ambos os POSTs. As janelas atuais são fixas de dez minutos: até 12 pedidos de upload, cinco envios de ticket e 60 chamadas administrativas por IP. O identificador persistido é derivado por hash com segredo; os registros de limite são limpos após dois dias e o código não registra IPs, conteúdo do formulário ou respostas dos provedores em logs.

A API pública verifica `Origin` e JSON; o Worker exige HTTPS fora do ambiente local e entrega cabeçalhos de segurança na API. A página estática aplica CSP por meta tag; `frame-ancestors` não pode ser aplicado via meta e, portanto, deve ser configurado pelo host se necessário. R2 permanece privado, com CORS restrito às origens aprovadas. Rastreamento de abertura/cliques deve continuar desligado no domínio Resend; o código não ativa rastreamento nem inclui pixels, analytics ou marketing no suporte.

**Retenção a definir:** tickets, eventos, metadados e fila de e-mails não têm exclusão automática. Isso inclui as reservas/metadados de uploads no D1; a expiração de uma prova não apaga sua linha. A regra de 90 dias apaga objetos no R2, não os registros no banco nem cópias de e-mail no Zoho/Resend. O responsável deve definir o prazo, revisar a política e executar os pedidos de exclusão em todos os locais aplicáveis, inclusive considerando backups e mensagens recebidas. O contato indicado é `support@duar.ch`.

## Trocar o provedor de e-mail

A integração externa está isolada em `ResendEmailProvider`, dentro de `support/server/email.js`. Os templates e a fila recebem uma interface `send(message, { idempotencyKey })`. Implemente um adaptador com esse contrato e injete-o em `support/server/runtime.js`; mantenha texto e HTML, `reply_to`, remetentes, erros sanitizados e sem rastreamento. Atualize `.env.example`, a documentação e os testes com mock do novo provedor. Preserve as chaves estáveis de idempotência ou documente a janela equivalente do novo serviço.

## Rotação de chaves

Faça a rotação no provedor e atualize o segredo do Worker, um por vez, por exemplo:

```sh
npx wrangler secret put RESEND_API_KEY --env ''
```

O Wrangler solicitará o valor de forma interativa. Esse comando altera uma versão publicada e deve ser executado manualmente. Repita para a variável correspondente; para R2, troque `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` como um par. Revogue a credencial anterior depois de confirmar a nova, exceto se houver exposição, quando a revogação deve ser imediata conforme o procedimento do responsável.

Rotacionar `UPLOAD_SIGNING_SECRET` invalida as provas pendentes ainda não consumidas, cuja reserva dura uma hora; os usuários precisam anexar novamente. Rotacionar `ADMIN_API_TOKEN` exige atualizar os clientes administrativos. Revogar credenciais R2 pode invalidar links já emitidos; gere novos links após a troca. Turnstile exige coordenar site key e secret do mesmo widget. Nenhum segredo real deve aparecer em código, issue, chat ou commit; se isso ocorrer, trate-o como exposto e rotacione-o.

## Quotas e recuperação

O Resend Free permite **3.000 e-mails por mês e 100 por dia**; cada ticket normalmente consome dois, além das atualizações. Ao atingir a quota ou receber outro erro de envio, o ticket salvo permanece acessível por protocolo e os trabalhos ficam pendentes com códigos de erro sem dados pessoais. Aguarde a renovação da quota ou ajuste o plano e use o endpoint de reenvio. Não existe garantia de recebimento imediato. [Quotas oficiais do Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

A franquia R2 Standard inclui **10 GB-mês**, um milhão de operações classe A e dez milhões classe B por mês. Não é um bloqueio configurado pelo aplicativo: uso excedente pode ser cobrado. Se armazenamento ou operações falharem, o formulário mostra erro e preserva os dados digitados; a API não conclui um ticket com anexos sem validar/copiar os objetos. Acompanhe uso e faturamento, mantendo a regra de 90 dias. [Preços e franquia oficiais do R2](https://developers.cloudflare.com/r2/pricing/).

D1 e Workers também têm quotas próprias. D1 Free tem limite de tamanho por banco e de consultas por invocação; exceder a franquia diária de leituras/escritas impede consultas até a renovação ou mudança de plano, e esgotar armazenamento impede novas gravações. O formulário só mostra sucesso depois de salvar o ticket. Verifique [limites do D1](https://developers.cloudflare.com/d1/platform/limits/), [comportamento das quotas D1](https://developers.cloudflare.com/d1/platform/pricing/) e [limites do Workers](https://developers.cloudflare.com/workers/platform/limits/) na conta usada. As referências foram consultadas em 20/10/2026; confirme condições do seu plano antes da publicação.
