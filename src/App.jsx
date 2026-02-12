import { useEffect, useRef } from "react";
import PuzzleScene, { puzzlePositions } from "./components/PuzzleScene.jsx";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const skills = [
  {
    title: "Frontend",
    description: "Interfaces vivas, acessiveis e com personalidade.",
  },
  {
    title: "Backend",
    description: "APIs estaveis, integracoes e dados no lugar certo.",
  },
  {
    title: "UI/UX",
    description: "Fluxos claros, micro-interacoes e hierarquia visual.",
  },
  {
    title: "Automacao",
    description: "Pipelines, tarefas repetitivas e deploy sem dor.",
  },
  {
    title: "Arquitetura",
    description: "Bases solidas para crescer sem travar.",
  },
  {
    title: "Produto",
    description: "Visao de negocio e foco em impacto real.",
  },
];

const timeline = [
  {
    year: "2018",
    title: "Primeiras experiencias",
    text: "Comeco da jornada com web e design.",
  },
  {
    year: "2020",
    title: "Projetos reais",
    text: "Sites, dashboards e produtos no mundo real.",
  },
  {
    year: "2022",
    title: "Automacao e backend",
    text: "Processos, APIs e infraestrutura organizada.",
  },
  {
    year: "2024",
    title: "IA e sistemas modernos",
    text: "Experimentos com AI aplicada e produtos rapidos.",
  },
  {
    year: "2026",
    title: "Peca pronta",
    text: "Visao completa para encaixar no time certo.",
  },
];

const projects = [
  {
    name: "persi.ga",
    description: "Wordle em portugues com foco em comunidade.",
    link: "https://persiga.duar.ch",
    image: "/assets/persiga.webp",
  },
  {
    name: "WallSpot",
    description: "Gerador de wallpapers com identidade forte.",
    link: "https://github.com/duarch/WallSpot",
    image: "/assets/wallspot.webp",
  },
  {
    name: "Gloone",
    description: "Clone conceitual com foco em UI e detalhes.",
    link: "https://duarch.github.io/gloone",
    image: "/assets/gloone.webp",
  },
  {
    name: "Easy Poll",
    description: "Ferramenta leve para criar enquetes rapidas.",
    link: "https://duarch.github.io/easypoll",
    image: "/assets/easypoll.webp",
  },
];

const archive = [
  {
    year: "2026",
    label: "Puzzle Story (atual)",
    link: "/",
  },
  {
    year: "2023",
    label: "Versao minimalista",
    link: "/2023/",
  },
  {
    year: "2021",
    label: "Versao anterior",
    link: "/2021/",
  },
];

export default function App() {
  const heroRef = useRef(null);
  const piecesRef = useRef([]);

  // ScrollTrigger + Animação das peças (FORA do Canvas)
  useEffect(() => {
    let ctx;
    
    // Aguardar as peças carregarem
    const checkPieces = setInterval(() => {
      if (piecesRef.current.length === puzzlePositions.length && heroRef.current) {
        clearInterval(checkPieces);
        
        console.log(`[${new Date().toLocaleTimeString()}] 🎬 Criando ScrollTrigger no App.jsx`);
        console.log('heroRef.current:', heroRef.current);
        console.log('piecesRef.current.length:', piecesRef.current.length);

        ctx = gsap.context(() => {
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: heroRef.current,
              start: "top top",
              end: "+=200%",
              pin: true,
              pinSpacing: true,
              scrub: 1,
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onEnter: () => console.log(`[${new Date().toLocaleTimeString()}] ✅ Pin ATIVO`),
              onUpdate: (self) => {
                const progress = Math.round(self.progress * 100);
                if (progress % 25 === 0) {
                  console.log(`[${new Date().toLocaleTimeString()}] 📊 Progresso: ${progress}%`);
                }
              },
              onLeave: () => console.log(`[${new Date().toLocaleTimeString()}] 🚀 Pin liberado`),
            },
          });

          // Animar todas as peças
          piecesRef.current.forEach((piece, index) => {
            if (!piece) return;
            
            const data = puzzlePositions[index];
            
            tl.to(
              piece.position,
              {
                x: data.final[0],
                y: data.final[1],
                z: data.final[2],
                duration: 0.8,
                ease: "power2.out",
              },
              index * 0.02
            ).to(
              piece.rotation,
              {
                x: 0,
                y: 0,
                z: 0,
                duration: 0.8,
                ease: "power2.out",
              },
              index * 0.02
            );
          });
          
          console.log(`[${new Date().toLocaleTimeString()}] ✅ Timeline criada com sucesso`);
        });
      }
    }, 100);

    return () => {
      clearInterval(checkPieces);
      if (ctx) ctx.revert();
    };
  }, []);

  // Intersection Observer para reveal
  useEffect(() => {
    const targets = document.querySelectorAll(".reveal");
    if (!targets.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="app">
      <header className="hero" id="top" ref={heroRef}>
        <div className="hero-media" aria-hidden="true">
          <PuzzleScene piecesRef={piecesRef} />
        </div>
        <div className="hero-content">
          <p className="eyebrow">DUAR.CH 2026</p>
          <h1>Sou a peca que falta no seu time.</h1>
          <p className="hero-subtitle">
            Fullstack com visao de produto, design e automacao. Eu conecto as
            pecas para entregar experiencias completas.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#projects">
              Ver projetos
            </a>
            <a className="btn btn-ghost" href="#contact">
              Entrar em contato
            </a>
          </div>
          <div className="scroll-hint">
            <span>Scroll para montar</span>
            <div className="scroll-line" />
          </div>
        </div>
      </header>

      <section className="section section-light" id="deliver">
        <div className="section-header reveal">
          <p className="eyebrow">Como eu me encaixo</p>
          <h2>O que eu entrego</h2>
        </div>
        <div className="skill-grid">
          {skills.map((skill) => (
            <article className="skill-card reveal" key={skill.title}>
              <h3>{skill.title}</h3>
              <p>{skill.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-dark" id="story">
        <div className="section-header reveal">
          <p className="eyebrow">Montando a jornada</p>
          <h2>Storytelling tecnico</h2>
        </div>
        <div className="timeline">
          {timeline.map((item) => (
            <div className="timeline-item reveal" key={item.year}>
              <div className="timeline-year">{item.year}</div>
              <div className="timeline-content">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section section-light" id="projects">
        <div className="section-header reveal">
          <p className="eyebrow">Destaques</p>
          <h2>Projetos em foco</h2>
        </div>
        <div className="project-list">
          {projects.map((project) => (
            <article className="project-card reveal" key={project.name}>
              <div className="project-visual">
                <img src={project.image} alt={project.name} />
              </div>
              <div className="project-info">
                <h3>{project.name}</h3>
                <p>{project.description}</p>
                <a className="project-link" href={project.link} target="_blank" rel="noreferrer">
                  Ver projeto →
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-dark" id="why">
        <div className="split">
          <div className="split-text reveal">
            <p className="eyebrow">Diferencial</p>
            <h2>Eu nao sou apenas mais uma peca.</h2>
            <p>
              Sou a peca que conecta as outras. Traduzo objetivos em experiencias
              claras, construo pontes entre produto e tecnologia e entro no time
              para destravar o proximo nivel.
            </p>
          </div>
          <div className="split-visual reveal" aria-hidden="true">
            <div className="puzzle-connector">
              <div className="center-piece"></div>
              <div className="orbit-piece piece-1"></div>
              <div className="orbit-piece piece-2"></div>
              <div className="orbit-piece piece-3"></div>
              <div className="orbit-piece piece-4"></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-light" id="archive">
        <div className="section-header reveal">
          <p className="eyebrow">Arquivo</p>
          <h2>Evolucao e versoes antigas</h2>
        </div>
        <div className="archive-grid">
          {archive.map((item) => (
            <a className="archive-card reveal" href={item.link} key={item.year}>
              <span className="archive-year">{item.year}</span>
              <span className="archive-label">{item.label}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="section section-dark" id="contact">
        <div className="cta reveal">
          <h2>Vamos montar algo juntos?</h2>
          <p>
            Me chama para conversar sobre produto, tecnologia ou aquele desafio
            que precisa de uma peca nova.
          </p>
          <a className="btn btn-primary" href="mailto:andre@duar.ch">
            Entrar em contato
          </a>
        </div>
      </section>

      <footer className="footer">
        <div>
          <span>© 2026 DUAR.CH</span>
        </div>
        <div className="footer-links">
          <a href="https://github.com/duarch">GitHub</a>
          <a href="https://twitter.com/andrebh">Twitter</a>
          <a href="https://dev.to/duarch">DEV</a>
        </div>
      </footer>
    </div>
  );
}