# Portfólio Duarch

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

O artefato de produção é gerado em `dist/`.

## Deploy

O deploy é feito via **GitHub Pages** pelo workflow:

- `.github/workflows/deploy.yml`

Este repositório não usa Vercel para deploy.

## Currículos

A fonte única dos currículos é:

- `public/resume/`

Estrutura:

- `public/resume/pt/`
- `public/resume/en/`
- `public/resume/es/`
- PDFs em `public/resume/files/`


