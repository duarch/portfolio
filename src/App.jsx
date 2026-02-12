import { useEffect, useRef } from "react";
import PuzzleScene, { puzzlePositions } from "./components/PuzzleScene.jsx";
import LanguageSwitcher from "./components/LanguageSwitcher.jsx";
import { useLanguage } from "./contexts/LanguageContext.jsx";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function App() {
  const heroRef = useRef(null);
  const piecesRef = useRef([]);
  const { t, language } = useLanguage();

  // Definir URL do currículo baseado no idioma
  const getResumeUrl = () => {
    const urlMap = {
      'pt': '/resume/',
      'en': '/resume/en/',
      'es': '/resume/es/'
    };
    return urlMap[language] || '/resume/';
  };

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
      <LanguageSwitcher />

      <header className="hero" id="top" ref={heroRef}>
        <div className="hero-media" aria-label={t("puzzleAlt")}>
          <PuzzleScene piecesRef={piecesRef} />
        </div>
        <div className="hero-content">
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1>{t("heroTitle")}</h1>
          <p className="hero-subtitle">
            {t("heroSubtitle")}
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#projects" aria-label={`${t("viewProjects")} - ir para secao de projetos`}>
              {t("viewProjects")}
            </a>
            <a className="btn btn-ghost" href="https://api.whatsapp.com/send?phone=5561920028650&text=👋" target="_blank" rel="noreferrer" aria-label={`${t("contactMe")} via WhatsApp - abre em nova aba`}>
              {t("contactMe")}
            </a>
            <a className="btn btn-ghost" href={getResumeUrl()} aria-label={`Ver meu ${t("curriculum").toLowerCase()} completo`}>
              {t("curriculum")}
            </a>
          </div>
          <div className="scroll-hint" aria-live="polite" aria-label={`Dica: Role a pagina para ver a animacao do quebra-cabeca se montando`}>
            <span>{t("scrollHint")}</span>
            <div className="scroll-line" aria-hidden="true" />
          </div>
        </div>
      </header>

      <section className="section section-light" id="deliver" aria-labelledby="skills-heading">
        <div className="section-header reveal">
          <p className="eyebrow">{t("skillsEyebrow")}</p>
          <h2 id="skills-heading">{t("skillsTitle")}</h2>
        </div>
        <div className="skill-grid" role="list">
          {t("skills").map((skill) => (
            <article className="skill-card reveal" key={skill.title} role="listitem">
              <h3>{skill.title}</h3>
              <p>{skill.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-dark" id="story" aria-labelledby="timeline-heading">
        <div className="section-header reveal">
          <p className="eyebrow">{t("timelineEyebrow")}</p>
          <h2 id="timeline-heading">{t("timelineTitle")}</h2>
        </div>
        <div className="timeline" role="list">
          {t("timeline").map((item) => (
            <div className="timeline-item reveal" key={item.year} role="listitem">
              <div className="timeline-year" aria-label={`ano ${item.year}`}>{item.year}</div>
              <div className="timeline-content">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section section-light" id="projects" aria-labelledby="projects-heading">
        <div className="section-header reveal">
          <p className="eyebrow">{t("projectsEyebrow")}</p>
          <h2 id="projects-heading">{t("projectsTitle")}</h2>
        </div>
        <div className="project-list" role="list">
          {t("projects").map((project) => (
            <article className="project-card reveal" key={project.name} role="listitem">
              <div className="project-visual">
                <img src={project.image} alt={`Imagem do projeto ${project.name}: ${project.description}`} loading="lazy" />
              </div>
              <div className="project-info">
                <h3>{project.name}</h3>
                <p>{project.description}</p>
                <a className="project-link" href={project.link} target="_blank" rel="noreferrer" aria-label={`${t("viewProject")} ${project.name} (abre em nova aba)`}>
                  {t("viewProject")} <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-dark" id="why" aria-labelledby="unique-heading">
        <div className="split">
          <div className="split-text reveal">
            <p className="eyebrow">{t("uniqueEyebrow")}</p>
            <h2 id="unique-heading">{t("uniqueTitle")}</h2>
            <p>
              {t("uniqueText")}
            </p>
          </div>
          <div className="split-visual reveal" aria-hidden="true">
            <div className="puzzle-connector" aria-label="Visualizacao decorativa de pecas de quebra-cabeca em orbita">
              <div className="center-piece"></div>
              <div className="orbit-piece piece-1"></div>
              <div className="orbit-piece piece-2"></div>
              <div className="orbit-piece piece-3"></div>
              <div className="orbit-piece piece-4"></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-light" id="archive" aria-labelledby="archive-heading">
        <div className="section-header reveal">
          <p className="eyebrow">{t("archiveEyebrow")}</p>
          <h2 id="archive-heading">{t("archiveTitle")}</h2>
        </div>
        <div className="archive-grid" role="list">
          {t("archive").map((item) => (
            <a className="archive-card reveal" href={item.link} key={item.year} role="listitem" aria-label={`${item.label} - ${item.year}`}>
              <span className="archive-year" aria-hidden="true">{item.year}</span>
              <span className="archive-label">{item.label}</span>
            </a>
          ))}
        </div>
      </section>

      <section className="section section-dark" id="contact" aria-labelledby="contact-heading">
        <div className="cta reveal">
          <h2 id="contact-heading">{t("contactTitle")}</h2>
          <p>
            {t("contactText")}
          </p>
          <a className="btn btn-primary" href="mailto:andre@duar.ch" aria-label={`Enviar email para andre@duar.ch`}>
            {t("contactButton")}
          </a>
        </div>
      </section>

      <footer className="footer" role="contentinfo">
        <div>
          <span>{t("copyright")}</span>
        </div>
        <nav className="footer-links" aria-label="Links adicionais e redes sociais">
          <a href={getResumeUrl()} aria-label={`Ver meu ${t("footerResume").toLowerCase()} completo`}>{t("footerResume")}</a>
          <a href="https://github.com/duarch" aria-label={`Perfil ${t("footerGithub")} de Andre`}>{t("footerGithub")}</a>
          <a href="https://twitter.com/andrebh" aria-label={`Perfil ${t("footerTwitter")} de Andre`}>{t("footerTwitter")}</a>
          <a href="https://dev.to/duarch" aria-label={`Perfil ${t("footerDev")} de Andre`}>{t("footerDev")}</a>
        </nav>
      </footer>
    </div>
  );
}