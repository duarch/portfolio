# Decisões do suporte

Registro da implementação de 20/10/2026. O usuário confirmou **Cloudflare D1 + Worker** na conversa. Nenhuma publicação, configuração de DNS, criação de recurso ou segredo foi executada como parte da implementação.

| Decisão | Escolha adotada | Situação |
| --- | --- | --- |
| D1 — stack | React 18 + Vite do repositório; `support/index.html` e `support/privacy.html` são publicados no GitHub Pages. A API usa um Worker independente em `workers.dev`. | Deducida da stack; Worker confirmado pelo usuário. |
| D2 — banco | Cloudflare D1, binding `DB`, com migrações SQL versionadas em `support/migrations`. | Confirmada pelo usuário. |
| D3 — campos | Obrigatórios: nome, e-mail, país, app, descrição de 20 a 5.000 caracteres e consentimento. Telefone, cidade e até cinco anexos são opcionais. Retorno marcado por padrão; confirmação sempre enviada, atualizações somente com retorno. | Padrão do pedido. |
| D4 — retenção | Objetos do R2 seguem a regra existente de 90 dias. Tickets, eventos, metadados de anexos/uploads e trabalhos de e-mail não têm exclusão automática no D1. | Prazo e procedimento de exclusão dos dados do ticket dependem de revisão do responsável antes da publicação. |
| D5 — acompanhamento público | Sem página de acompanhamento ou link mágico; protocolo e avisos por e-mail. | Padrão do pedido. |
| D6 — remetentes | Aviso interno de `form@notify.duar.ch`; confirmação e status de `support@notify.duar.ch`; ambos configuráveis. Inbox e Reply-To para o usuário: `support@duar.ch`. Reply-To do aviso interno: e-mail do solicitante. | `notify.duar.ch` é a premissa do pedido; responsável deve confirmar a verificação e os remetentes. |
| D7 — previews | Nenhuma origem de preview autorizada por padrão. API pública permite uma origem exata por ambiente. | Se houver preview real, criar configuração isolada e acrescentar sua origem ao CORS do R2 manualmente. |

## Decisões de implementação

- **Idioma:** reutilizar `localStorage.language`, já usado no portfólio; normalizar `pt` para `pt-BR`, então usar `Accept-Language` com pesos e fallback `en`. Não criar cookie alternativo, pois o mecanismo existente já atende ao requisito.
- **Página e privacidade:** manter entrada e estilos próprios do suporte para preservar o portfólio e evitar seus scripts de analytics em `/support`. O conteúdo completo de `docs/support/privacy_policy.md` é convertido em HTML semântico durante o build e incorporado às páginas estáticas publicadas em `/support/privacy/`; o link do formulário é configurável por `PRIVACY_POLICY_URL`, obrigatório e HTTPS em produção. O aviso curto e `CONSENT_VERSION` continuam sujeitos à revisão jurídica.
- **Publicação:** GitHub Pages serve `/support/` e `/support/privacy/`. O Worker é `workers_dev` em `workers.dev`; o navegador chama sua URL por `VITE_SUPPORT_API_BASE`. O binding de assets existe somente em `env.local`; produção responde apenas pela API. Não há Worker Routes, configuração de zona ou dependência de DNS na Cloudflare.
- **CORS:** apenas config, uploads e tickets aceitam preflight público para `https://duar.ch`; endpoints administrativos não têm CORS. O ambiente local aceita somente `http://127.0.0.1:3000`.
- **Anexos:** R2 privado, PUT S3 pré-assinado por 15 minutos, Content-Type assinado e extensão derivada do MIME. A reserva autenticada dura uma hora. HEAD e magic bytes precedem a cópia para `tickets/<protocolo>/`; nenhum POST HTML é usado para o R2.
- **Prova de upload:** `UPLOAD_SIGNING_SECRET` independente autentica cada reserva e evita anexar, validar ou apagar objetos conhecendo apenas suas chaves. Reservas são reclamadas durante o processamento para impedir uso concorrente em mais de um ticket.
- **Anti-spam:** tokens Turnstile de uso único por chamada. O widget é resetado entre o pedido de URLs e o ticket; não se reutiliza o mesmo token nos dois endpoints. Honeypot e limites por IP também se aplicam a ambos.
- **Idempotência:** UUID no header `Idempotency-Key`, com impressão dos dados no D1 para repetir a mesma submissão sem outro ticket. Contadores de protocolo são atômicos, podem ter lacunas em tentativas interrompidas e não reutilizam protocolos já emitidos.
- **E-mails:** fila persistente no D1, gravada com o ticket e com os eventos de status antes do envio. Falhas preservam o ticket e permitem reenvio administrativo em lotes de até três trabalhos, respeitando o orçamento de consultas D1 Free. Não há agendador automático. A reserva dura dois minutos; payload e links são persistidos para repetir o mesmo conteúdo, renovados após seis dias se necessário. Uma chave estável por payload é passada ao Resend; fora da janela de idempotência de 24 horas do provedor uma falha entre aceitação e marcação no D1 ainda pode causar duplicação.
- **Administrativo:** sem interface, sem CORS, bearer token obrigatório com comparação em tempo constante e limite por IP. Falha fechada sem token válido. POSTs exigem JSON; links GET de anexo duram sete dias.
- **Desenvolvimento:** Node.js 22.13 ou superior, CI em Node.js 24, Wrangler local e D1 local. Mocks de R2, Turnstile e Resend habilitados apenas em loopback; nenhum provedor real é chamado nos testes ou no fluxo local padrão.
- **Logs:** códigos de erro sem conteúdo do formulário ou respostas dos provedores. Os identificadores do rate limit são derivados por hash com segredo, com limpeza após dois dias. Não há analytics, pixels ou mensagens de marketing no suporte.

## Pendências do responsável

1. Redigir/revisar a política e o aviso curto, definir retenção dos dados do ticket e procedimento de exclusão e atualizar a versão de consentimento se o texto mudar.
2. Confirmar `notify.duar.ch` e remetentes disponíveis na conta Resend, mantendo abertura e cliques desativados.
3. Criar D1 e widget Turnstile, preencher variáveis e segredos e publicar manualmente seguindo [MANUAL_ACTIONS.md](./MANUAL_ACTIONS.md).
4. Confirmar se haverá previews; se houver, definir domínio e ambiente separado antes de liberar CORS.

Não há outra decisão arquitetural bloqueadora. Os padrões D3 a D7 podem ser confirmados ou corrigidos pelo responsável antes da publicação.
