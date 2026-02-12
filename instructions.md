# 📌 Especificações para a nova versão do portfólio

**Objetivo do portfólio:**
Mostrar seus projetos técnicos e conceituais, com narrativa que conecte sua história e personalidade profissional — especialmente usando o **tema de quebra-cabeça**, já que seu subtítulo será algo como:

> 🎯 **“Sou a peça que falta no seu time.”**

O site atual ([https://duar.ch](https://duar.ch)) é extremamente minimalista, com uma lista de links simples e sem muito conteúdo visual ou descritivo — ideal para scaffolding inicial, mas precisa *quebrar essa moldura básica para algo mais moderno e imersivo*. ([duar.ch][1])

---

## 1. 🧱 Conceito e narrativa (Storytelling)

### Tema principal — *Quebra-cabeça que conta sua história*

* **Hero Section interativa** (primeira tela):

  * Um quebra-cabeça 3D/2D (Three.js ou animação CSS/WebGL) que vai **se montando conforme o visitante scrolla ou interage**.
  * Cada peça revela sua história, skill ou projeto.
  * Texto principal:

    > **“Eu sou a peça que falta no seu time.”**
  * Subtexto: breve tagline com os seus valores profissionais.

👉 Inspire-se pelo projeto de three.js ([https://codepen.io/DenDionigi/pen/JoGOJVN](https://codepen.io/DenDionigi/pen/JoGOJVN)) para manipular peças, animações e interatividade — isso poderia ser a *abertura mais memorável possível*.

---

## 2. 🎨 Layout e estilo visual

Considere combinar elementos dos sites que você gosta:

### Moderno e fluido (tipo Sean Halpin)

* Tipografia grande e elegante.
* Layout arejado com espaços vazios e foco no *conteúdo visual forte*.
* Micro-interações suaves ao hover/click.

👉 [https://www.seanhalpin.xyz/](https://www.seanhalpin.xyz/) — bom para inspiração na **hierarquia visual e tipografia moderna**.

### Storytelling com referências visuais (tipo Sea Harvest)

* Seções que remetem a um *material tangível* — por exemplo, áreas que simulam páginas de um *caderno*, *jornais*, *arquivos*, ou *mapas*.
* Texturas ou transições que lembram páginas se virando ou itens sendo revelados.

👉 [https://www.seaharvest.net.au/](https://www.seaharvest.net.au/) — bom para explorar estilos visuais “com personalidade” e narrativa.

### Arquivo de versões antigas (tipo Lynn & Tonic)

* Uma seção do tipo `Archive` ou `Evolução` de portfólio, mostrando antigas versões do seu site/projetos.
* Permite que visitantes vejam sua **evolução profissional** ao longo do tempo.

👉 [https://lynnandtonic.com/archive/](https://lynnandtonic.com/archive/) — ótimo como referência de *histórico de versões*.

### Clean + experiente (tipo iamvdo.me)

* Minimalismo funcional aliado a animações *ao rolar* (scroll animations), transições suaves, sem distrair do conteúdo principal.

👉 [https://iamvdo.me/en](https://iamvdo.me/en) — funcional e limpo.

---

## 3. 📐 Arquitetura de conteúdo

### 🧱 Páginas / Seções principais

1. **Home / Intro Interativo**

   * Animação do quebra-cabeça.
   * Tagline e CTA (ex: ver portfolio, entrar em contato).
   * Navegação minimalista.

2. **Sobre (About)**

   * Uma história onde você é uma peça — que se encaixa em times, projetos e desafios.
   * Timeline ou narrativa com peças representando *momentos da carreira*.

3. **Portfolio / Projetos**

   * Cards ou módulos interativos (hover, expansão).
   * Cada projeto pode **abrir uma história detalhada** (contexto, desafio, solução, resultado).
   * Filtros por tipo (web, interatividade, UI/UX, etc.).

4. **Evolução / Arquivos**

   * Versões anteriores do portfólio ou projetos antigos.
   * Linha do tempo visual.

5. **Contato**

   * Formulário simples.
   * Link para redes (GitHub, LinkedIn, etc).

---

## 4. 🛠 Tecnologias sugeridas

* **Three.js / WebGL** para animações do quebra-cabeça.
* **GSAP ou ScrollTrigger** para animação de scroll.
* **Tailwind CSS / CSS customizado** para estilo moderno e responsivo.
* **React ou Svelte** (opcional) para UI dinâmica.

---

## 5. 📐 Tipografia e sensação visual

* Tipos grandes, com contraste alto para chamadas (“headlines”).
* Paleta baseada em **neutros + um *accent color*** que representa você (ex: um tom forte que recorde peça de quebra-cabeça).
* Uso de espaço “respirável”, animações minimalistas.

---

## 6. 🧠 UX / Interatividade

### Navegação

* Menu fixo minimalista, ícones simples.
* Rolagem suave + navegação por seções.
* Animações leves — nada que distraia demais.

### Micro-interações

* Quando o usuário passa sobre um projeto, ele poderia “vibrar” como peça de quebra-cabeça.
* O carregamento inicial pode ter uma *síntese de quebra-cabeça montando a logo/site*.

---

## 7. 🧱 Dicas narrativas

* **Narrativa envolvente:** cada seção conta *uma parte da sua jornada*, como se fosse inserir uma peça no quebra-cabeça geral (quem você é → o que você faz → onde já atuou → como pode ajudar o cliente/equipe).
* **Mostre seu processo:** não apenas o resultado final — desenhe o *caminho de montagem*, desafios e aprendizados.

---

## ⏱ Exemplo de estrutura em Markdown (pra você usar como template base)

```markdown
# 🌟 DUAR.CH – Portfólio 2026

## 🧩 Hero: “Sou a peça que falta no seu time”
Animação interativa do quebra-cabeça que se monta ao scrollar.

## 🧠 Sobre mim
Texto com narrativa pessoal e profissional, estilo storytelling.

## 🗂️ Portfolio
### Projeto 1 — Nome
Descrição, imagens, links, desafios e soluções.

### Projeto 2 — Nome
…

## 📜 Arquivo / Versões antigas
- Versão 2021 — captura / resumo
- Versão 2023 —…
- Evolução do design / projetos.

## 📬 Contato
Formulário, redes sociais, GitHub, LinkedIn.
```
