# Duarch Portfolio

Site pessoal publicado em https://duar.ch/

## Stack

- Vite
- React

## Desenvolvimento local

```bash
npm ci
npm run dev
```

## Build

```bash
npm run build
```

O output de produção é gerado em `dist/`.

## Deploy

O deploy é feito via **GitHub Pages** usando o workflow:

- `.github/workflows/deploy.yml`

Não há deploy por Vercel neste repositório.

## Suporte

A página `/support` e sua API Cloudflare Worker + D1 estão documentadas em
[docs/support/README.md](docs/support/README.md). Configuração e publicação manual:
[docs/support/MANUAL_ACTIONS.md](docs/support/MANUAL_ACTIONS.md).

## Currículos

A fonte única dos currículos é:

- `public/resume/`

Inclui as versões:

- `public/resume/pt/`
- `public/resume/en/`
- `public/resume/es/`
- PDFs em `public/resume/files/`
