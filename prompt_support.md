# Papel e modo de trabalho
Você é um engenheiro sênior responsável por implementar, DENTRO DESTE REPOSITÓRIO,
uma página de suporte multilíngue para https://duar.ch/support. Trabalhe de forma
autônoma, mas respeite estritamente o escopo abaixo. Comunique-se comigo em português.

Ordem de trabalho:
1. Explore o repositório em modo leitura (stack, rotas, i18n existente, estilos,
   banco de dados, testes, CI) e resuma em poucas linhas o que encontrou.
2. Se alguma "Decisão que depende de mim" estiver em aberto E bloquear a arquitetura,
   faça TODAS as perguntas de uma vez (uma única rodada) e aguarde. Para as demais,
   adote o padrão indicado, registre em `docs/support/DECISIONS.md` e siga em frente.
3. Apresente um plano curto (arquivos a criar/alterar) e então implemente.
4. Não faça commit nem push, a menos que eu peça. Deixe tudo na árvore de trabalho.

# Escopo
DENTRO do escopo: código, configuração, testes e documentação neste repositório.

FORA do escopo (NÃO faça, mesmo que pareça útil):
- Deploy, alterações de DNS, ou qualquer ação nos painéis da Cloudflare, Resend, Zoho
  ou do provedor de hospedagem. Isso é ação manual minha (ver "Ações manuais").
- Criar contas, chaves de API ou segredos. Nunca peça nem grave segredos reais no repo.
- Chamar serviços externos reais durante desenvolvimento/testes (R2, Resend, Turnstile):
  use mocks. Só rode contra serviços reais se eu fornecer as variáveis e pedir.
- Alterar páginas, componentes ou estilos não relacionados a /support, ou instalar
  ferramentas globais na minha máquina.
- Rastreamento, analytics, pixels ou e-mails de marketing.
Se algo fora do escopo for necessário, NÃO execute: descreva-o em "Ações manuais".

# Contexto já configurado por mim (não refaça)
- Domínio: https://duar.ch. A página fica em /support.
- support@duar.ch é uma caixa do Zoho Mail (plano gratuito, só recebe; sem SMTP).
- E-mail transacional: Resend (plano gratuito: 3.000/mês e 100/dia, 1 domínio),
  enviando de um subdomínio verificado [PREMISSA: notify.duar.ch]. Rastreamento de
  abertura e de cliques está DESLIGADO no domínio; não ative no código.
- Armazenamento: Cloudflare R2, bucket PRIVADO `duarch-support-attachments`
  (sem acesso público, sem domínio personalizado). Token de API com permissão
  "Object Read & Write" restrito a esse bucket. CORS configurado para
  https://duar.ch e http://localhost:3000 (método PUT, header Content-Type, expõe ETag).
  Regra de ciclo de vida: apagar objetos após 90 dias.
- Endpoint S3 do R2: https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com (region "auto").

# Decisões que dependem de mim
Pergunte (uma vez, em lote) só o que não puder ser deduzido do repositório; senão use o padrão.
- D1. Stack/framework: deduza do repo. Se não houver app definido, PERGUNTE.
- D2. Banco de dados dos tickets: use o que já existir no repo. Se não houver,
  PERGUNTE e ofereça opções (ex.: Cloudflare D1; Supabase gratuito, lembrando que o
  projeto pausa após 1 semana de inatividade; outro). Não escolha sozinho.
- D3. Campos obrigatórios vs. opcionais: padrão abaixo; confirme se tiver dúvida.
- D4. Retenção dos dados do ticket (anexos: 90 dias). Padrão: documentar, sem exclusão automática.
- D5. Página pública de acompanhamento com link mágico: padrão NÃO implementar
  (acompanhamento é só por e-mail). Só faça se eu confirmar.
- D6. Endereços de envio. Padrão: `form@<subdomínio>` (aviso interno) e
  `support@<subdomínio>` (confirmação ao usuário), configuráveis por variável de ambiente.
- D7. Se uso deploys de preview, o CORS do R2 precisa listar essas origens (ação manual minha).

# Requisitos funcionais

## Idiomas (i18n)
- pt-BR, en e es. Textos em arquivos de tradução (nada fixo no código), incluindo
  validações, mensagens de sucesso/erro e todos os e-mails.
- Ordem de decisão do idioma: (1) a escolha já feita pelo usuário em outras páginas,
  reutilizando o mecanismo que o site já usa (descubra no repo: cookie, localStorage,
  prefixo de rota ou parâmetro); (2) Accept-Language; (3) fallback en.
  Se o site não tiver mecanismo, crie um cookie `locale`.
- Seletor de idioma visível em /support; persistir a escolha. Salvar o idioma no ticket
  para que os e-mails de acompanhamento saiam no mesmo idioma.
- Nomes de países via Intl.DisplayNames no idioma ativo (lista ISO 3166).

## Campos do formulário (padrão da D3)
Obrigatórios (*): nome completo; e-mail (formato válido); app (dropdown);
descrição do ocorrido (mín. 20 e máx. 5.000 caracteres, com contador); país;
consentimento de privacidade (checkbox com link para a política).
Opcionais: telefone (validar com libphonenumber-js, guardar em E.164); cidade;
anexos; "Quero receber retorno sobre este assunto" (marcado por padrão).
Marque visualmente obrigatórios e opcionais.

## Lista de apps (fácil de editar)
- Arquivo único `config/apps.json` (ou equivalente na stack): `[{ "id": "persiga", "name": "Persiga" }, ...]`.
- Itens iniciais: Persiga, WallSpot, Siglas, mais "Outro / Não sei" (id `other`, texto traduzido) sempre por último.
- Adicionar ou remover um app = editar uma linha. Validar o schema do arquivo em teste.
- O servidor só aceita ids presentes nessa lista.

## Anexos (fluxo com URL pré-assinada)
- Tipos: JPG, PNG, WebP, HEIC, MP4, MOV, WebM. Limites: até 5 arquivos; 10 MB por imagem;
  50 MB por vídeo. Mantenha os limites em um único arquivo de configuração.
- Fluxo:
  1. O cliente valida tipo/tamanho e pede ao servidor as URLs de upload
     (`POST /api/support/uploads`, com metadados: nome, tipo, tamanho).
  2. O servidor valida os metadados e devolve URLs pré-assinadas de PUT (validade de
     15 min, `ContentType` assinado) para chaves `pending/<uuid>.<ext>`, com extensão
     derivada do tipo validado, nunca do nome enviado pelo usuário.
  3. O navegador envia direto ao R2 com PUT (use XHR/fetch com barra de progresso,
     pré-visualização e opção de remover antes de enviar o formulário).
  4. No envio do ticket, o servidor, para cada chave: confirma que está sob `pending/`,
     faz HeadObject (tamanho e content-type dentro dos limites) e lê os primeiros bytes
     (GET com Range) para validar os magic bytes reais. Inválido: apaga e rejeita com
     mensagem traduzida. Válido: CopyObject para `tickets/<PROTOCOLO>/<uuid>.<ext>` e
     apaga o original em `pending/`.
- POST de formulário HTML para o R2 NÃO é suportado; use PUT por JavaScript.
- Credenciais do R2 apenas no servidor, via variáveis de ambiente.
- Links de download no e-mail interno: URL pré-assinada de GET com validade de 7 dias
  (604800 s, o máximo permitido). Depois disso o link expira, mas o arquivo continua no
  bucket até a regra de 90 dias; por isso implemente o endpoint administrativo que gera
  link novo (abaixo).

## Tickets e status
- Protocolo único e legível: `DUAR-AAAA-NNNNNN`. Salve o ticket ANTES de enviar e-mails.
- Status: Recebido, Em análise, Aguardando usuário, Resolvido (rótulos traduzidos).
- Modelo mínimo (adapte à stack): ticket (protocolo, criado_em, idioma, nome, e-mail,
  telefone, país, cidade, app_id, descrição, quer_retorno, consentimento_em,
  versão_do_consentimento, status, status_atualizado_em, support_email_enviado_em,
  user_email_enviado_em, tentativas_email, último_erro_email); anexos (ticket, chave,
  nome sanitizado, tipo, tamanho); eventos_de_status (ticket, status, mensagem, criado_em, notificado_em).
- Migrações versionadas no repo (eu as executo; ver "Ações manuais").

## E-mails (Resend)
- Isole o provedor em um único módulo (ex.: `lib/email`) para permitir troca futura.
- E-mail 1 (para support@duar.ch): todos os dados, idioma, protocolo e links de anexos;
  `Reply-To` = e-mail do usuário; assunto `[DUAR-AAAA-NNNNNN] <App> – nova solicitação`.
- E-mail 2 (para o usuário, no idioma dele): confirmação com protocolo e cópia do que foi
  enviado (só nomes dos arquivos, SEM links de download); `Reply-To: support@duar.ch`.
- Atualizações de status: e-mail ao usuário, no idioma dele, a cada mudança, SOMENTE se
  ele marcou "quero retorno". Inclui protocolo, novo status e a mensagem opcional do suporte.
- Plano gratuito: 100 e-mails/dia. Se o envio falhar ou o limite estourar, o ticket já
  salvo é mantido, o usuário vê sucesso com o protocolo, o erro é registrado (sem dados
  pessoais nos logs) e o reenvio é possível pelo endpoint administrativo.
- Escape todo conteúdo do usuário nos e-mails (evite injeção de HTML). Texto simples + HTML simples.
- Não use rastreamento de abertura/cliques.

## Endpoints administrativos (sem interface)
Protegidos por `Authorization: Bearer ${ADMIN_API_TOKEN}` (comparação em tempo constante,
rate limit, sem CORS, falha fechada se a variável não existir):
- `POST /api/support/admin/status` { protocolo, status, mensagem? }: atualiza e notifica.
- `POST /api/support/admin/retry-emails`: reenvia e-mails pendentes/falhos.
- `GET  /api/support/admin/attachment-links?protocol=...`: gera links novos de 7 dias.
Documente exemplos de `curl` no README.

# Segurança e privacidade
- Validação no cliente E no servidor com o mesmo schema (ex.: zod), com sanitização de entrada.
- Anti-spam: Cloudflare Turnstile, honeypot e rate limit por IP, aplicados ao envio do
  ticket E ao endpoint de URLs de upload (evita encher o bucket). Trate tokens de uso único
  (resetar o widget entre chamadas ou emitir token curto assinado) e documente a escolha.
  Em desenvolvimento use as chaves de teste do Turnstile.
- Proteção contra CSRF (checar Origin e usar content-type JSON), HTTPS, e cabeçalhos de
  segurança/CSP nas rotas de /support, se a configuração do framework permitir.
- Nunca registre dados pessoais em logs. Nenhum segredo no repositório; crie `.env.example`
  com placeholders e confirme que `.env*` está no `.gitignore`.
- LGPD/GDPR: checkbox de consentimento (guarde data e versão do texto), aviso curto sobre
  uso dos dados, prazo de retenção e como pedir exclusão (support@duar.ch). Procure no repo
  uma página de política de privacidade e use-a; se não existir, use um link configurável e
  registre em "Ações manuais" que eu preciso redigir a política. NÃO invente texto jurídico
  além de um aviso curto e neutro, marcado como "revisar".

# UX e acessibilidade
- Mobile-first, responsivo, seguindo o visual e os componentes que o site já usa.
- WCAG 2.1 AA: labels associados, navegação por teclado, foco visível, contraste adequado,
  erros anunciados a leitores de tela (aria-live), resumo de erros no topo.
- Estados: carregando, erro (sem perder o que foi digitado, com mensagem útil), sucesso
  (protocolo em destaque e orientação do que acontece depois).

# Variáveis de ambiente (documentar em `.env.example`, sem valores reais)
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET=duarch-support-attachments,
RESEND_API_KEY, EMAIL_FROM_INTERNAL, EMAIL_FROM_USER, SUPPORT_INBOX=support@duar.ch,
TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY, ADMIN_API_TOKEN, e as variáveis do banco (D2).

# Testes (sem chamadas externas reais; mocks para R2, Resend e Turnstile)
- Validação do schema (obrigatórios, limites, telefone, país, app inexistente).
- Validação de anexos: tipo, tamanho, magic bytes inválidos, chave fora de `pending/`.
- Fluxo completo do ticket: salva, copia anexos, envia e-mails, falha de e-mail não perde o ticket.
- E-mails: idioma correto, escape de HTML, `Reply-To`, sem links de anexo na confirmação,
  atualização de status só com "quero retorno".
- Endpoints administrativos: 401 sem token e funcionamento com token.
- i18n: os três arquivos têm exatamente as mesmas chaves. `apps.json` válido.

# Documentação (README de /support ou `docs/support/`)
Como rodar localmente; variáveis de ambiente; como adicionar um app; como adicionar um
idioma; como usar os endpoints administrativos; como trocar o provedor de e-mail; como
rotacionar chaves; limites do plano gratuito (Resend 100/dia; R2 10 GB) e o que acontece ao atingi-los.

# Ações manuais (gere `docs/support/MANUAL_ACTIONS.md` com este checklist, adaptado ao que
# for implementado, com comandos exatos e na ordem em que devo executar)
- [ ] Definir as variáveis de ambiente localmente (`.env`) e no painel da hospedagem.
- [ ] Cloudflare Turnstile: criar o widget para duar.ch e copiar site key e secret key.
- [ ] Resend: confirmar que o domínio/subdomínio está verificado e que os endereços de
      envio (D6) pertencem a ele; criar a chave de API (com permissão apenas de envio,
      se disponível).
- [ ] Gerar um valor longo e aleatório para ADMIN_API_TOKEN (comando de exemplo no checklist).
- [ ] Executar a migração do banco (comando fornecido).
- [ ] Opcional: regra de ciclo de vida no R2 para apagar `pending/` após 1 dia.
- [ ] Se usar previews de deploy: adicionar essas origens ao CORS do bucket.
- [ ] Redigir/revisar a política de privacidade e definir o prazo de retenção (D4).
- [ ] Teste ponta a ponta em produção: enviar um ticket com imagem e vídeo, conferir a
      caixa de entrada E o spam do Zoho, abrir o link do anexo, mudar o status pelo endpoint.
- [ ] Se algum e-mail cair no spam do Zoho, marcar como "não é spam" e criar filtro para o subdomínio.
- [ ] Rotacionar qualquer chave que tenha sido colada em chat, issue ou commit por engano.

# Critérios de aceite
1. /support funciona em pt-BR, en e es e respeita o idioma escolhido em outras páginas.
2. Campos obrigatórios bloqueiam o envio com mensagens traduzidas; opcionais não bloqueiam.
3. Editar `config/apps.json` altera o dropdown sem tocar em mais nada.
4. Anexos válidos sobem direto ao R2; inválidos são rejeitados e removidos.
5. support@duar.ch recebe todos os dados com links de anexos; o usuário recebe confirmação
   com protocolo; mudanças de status notificam por e-mail quem pediu retorno.
6. Falha no envio de e-mail não perde o ticket e é recuperável pelo endpoint administrativo.
7. Testes passam; README e MANUAL_ACTIONS.md completos; nenhum segredo no repositório.
8. Nada foi alterado fora do escopo.

# Entrega final (sua última mensagem para mim)
1. Resumo do que foi feito (poucas linhas) e como rodar os testes.
2. Lista de arquivos criados/alterados.
3. Decisões tomadas por padrão (D1 a D7), para eu confirmar ou corrigir.
4. "O QUE VOCÊ PRECISA FAZER": o checklist de ações manuais, em ordem, com comandos exatos.
5. "DECISÕES PENDENTES": o que ainda depende de mim, com sua recomendação.