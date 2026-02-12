// Detecção de localização do usuário para carregar idioma padrão
export const getDefaultLanguage = () => {
  // Tentar pegar do localStorage primeiro
  const saved = localStorage.getItem('language');
  if (saved) return saved;

  // Usar Intl para detectar idioma do navegador
  const browserLang = navigator.language || navigator.userLanguage;
  const langCode = browserLang.split('-')[0];

  // Mapa de países por idioma
  const portuguesCountries = ['pt', 'br'];
  const spanishCountries = ['es', 'es-MX', 'es-AR', 'es-CL', 'es-CO', 'es-PE', 'es-VE', 'es-EC', 'es-BO', 'es-PY', 'es-UY'];

  if (portuguesCountries.includes(langCode)) {
    return 'pt';
  }
  if (spanishCountries.some(country => browserLang.toLowerCase().includes(country.toLowerCase()))) {
    return 'es';
  }

  // Default: Inglês para todos os outros países
  return 'en';
};

export const translations = {
  en: {
    // Header/Hero
    eyebrow: "DUAR.CH 2026",
    heroTitle: "I'm the missing piece in your team.",
    heroSubtitle: "Fullstack with product vision, design and automation. I connect the pieces to deliver complete experiences.",
    viewProjects: "View projects",
    contactMe: "Get in touch",
    curriculum: "Resume",
    scrollHint: "Scroll to assemble",
    puzzleAlt: "3D animation of a jigsaw puzzle that assembles the word DUAR.CH",

    // Skills Section
    skillsEyebrow: "How I fit in",
    skillsTitle: "What I deliver",
    skills: [
      {
        title: "Frontend",
        description: "Lively, accessible interfaces with personality.",
      },
      {
        title: "Backend",
        description: "Stable APIs, integrations and data in the right place.",
      },
      {
        title: "UI/UX",
        description: "Clear flows, micro-interactions and visual hierarchy.",
      },
      {
        title: "Automation",
        description: "Pipelines, repetitive tasks and painless deployment.",
      },
      {
        title: "Architecture",
        description: "Solid foundations to grow without bottlenecks.",
      },
      {
        title: "Product",
        description: "Business vision and focus on real impact.",
      },
    ],

    // Timeline Section
    timelineEyebrow: "Building the journey",
    timelineTitle: "Technical storytelling",
    timeline: [
      {
        year: "2018",
        title: "First experiences",
        text: "Beginning of the journey with web and design.",
      },
      {
        year: "2020",
        title: "Real projects",
        text: "Websites, dashboards and products in the real world.",
      },
      {
        year: "2022",
        title: "Automation and backend",
        text: "Processes, APIs and organized infrastructure.",
      },
      {
        year: "2024",
        title: "AI and modern systems",
        text: "Experiments with applied AI and fast products.",
      },
      {
        year: "2026",
        title: "Ready piece",
        text: "Complete vision to fit into the right team.",
      },
    ],

    // Projects Section
    projectsEyebrow: "Highlights",
    projectsTitle: "Projects in focus",
    projects: [
      {
        name: "persi.ga",
        description: "Portuguese Wordle focused on community.",
        link: "https://persiga.duar.ch",
        image: "/assets/persiga.webp",
      },
      {
        name: "WallSpot",
        description: "Wallpaper generator with strong identity.",
        link: "https://github.com/duarch/WallSpot",
        image: "/assets/wallspot.webp",
      },
      {
        name: "Gloone",
        description: "Conceptual clone focused on UI and details.",
        link: "https://duarch.github.io/gloone",
        image: "/assets/gloone.webp",
      },
      {
        name: "Easy Poll",
        description: "Lightweight tool for creating quick polls.",
        link: "https://duarch.github.io/easypoll",
        image: "/assets/easypoll.webp",
      },
    ],
    viewProject: "View project",

    // Unique Section
    uniqueEyebrow: "Differential",
    uniqueTitle: "I'm not just another piece.",
    uniqueText: "I'm the piece that connects the others. I translate objectives into clear experiences, build bridges between product and technology and join the team to unlock the next level.",

    // Archive Section
    archiveEyebrow: "Archive",
    archiveTitle: "Evolution and old versions",
    archive: [
      {
        year: "2026",
        label: "Puzzle Story (current)",
        link: "/",
      },
      {
        year: "2023",
        label: "Minimalist version",
        link: "/2023/",
      },
      {
        year: "2021",
        label: "Previous version",
        link: "/2021/",
      },
    ],

    // Contact Section
    contactTitle: "Let's build something together?",
    contactText: "Hit me up to talk about product, technology or that challenge that needs a new piece.",
    contactButton: "Get in touch",

    // Footer
    copyright: "© 2026 DUAR.CH",
    footerResume: "Resume",
    footerGithub: "GitHub",
    footerTwitter: "Twitter",
    footerDev: "DEV",

    // Resume Page
    resumeTitle: "Resume - André Duarte",
    resumeBack: "← Back",
    resumeSummary: "Summary",
    resumeAbout: "Fullstack developer with 6+ years of experience building complete solutions—from interfaces to infrastructure. Focused on impact and user experience.",
    resumeSkills: "Skills",
    resumeExperience: "Experience",
    resumeEducation: "Education",
    resumeCertifications: "Certifications",
    resumeContact: "Contact",
    resumeEmail: "Email",
    resumePhone: "Phone",
    resumeLinkedin: "LinkedIn",
  },
  pt: {
    // Header/Hero
    eyebrow: "DUAR.CH 2026",
    heroTitle: "Sou a peça que falta no seu time.",
    heroSubtitle: "Fullstack com visão de produto, design e automação. Eu conecto as peças para entregar experiências completas.",
    viewProjects: "Ver projetos",
    contactMe: "Entrar em contato",
    curriculum: "Currículo",
    scrollHint: "Scroll para montar",
    puzzleAlt: "Animação 3D de quebra-cabeça que monta a palavra DUAR.CH",

    // Skills Section
    skillsEyebrow: "Como eu me encaixo",
    skillsTitle: "O que eu entrego",
    skills: [
      {
        title: "Frontend",
        description: "Interfaces vivas, acessíveis e com personalidade.",
      },
      {
        title: "Backend",
        description: "APIs estáveis, integrações e dados no lugar certo.",
      },
      {
        title: "UI/UX",
        description: "Fluxos claros, micro-interações e hierarquia visual.",
      },
      {
        title: "Automação",
        description: "Pipelines, tarefas repetitivas e deploy sem dor.",
      },
      {
        title: "Arquitetura",
        description: "Bases sólidas para crescer sem travar.",
      },
      {
        title: "Produto",
        description: "Visão de negócio e foco em impacto real.",
      },
    ],

    // Timeline Section
    timelineEyebrow: "Montando a jornada",
    timelineTitle: "Storytelling técnico",
    timeline: [
      {
        year: "2018",
        title: "Primeiras experiências",
        text: "Começo da jornada com web e design.",
      },
      {
        year: "2020",
        title: "Projetos reais",
        text: "Sites, dashboards e produtos no mundo real.",
      },
      {
        year: "2022",
        title: "Automação e backend",
        text: "Processos, APIs e infraestrutura organizada.",
      },
      {
        year: "2024",
        title: "IA e sistemas modernos",
        text: "Experimentos com AI aplicada e produtos rápidos.",
      },
      {
        year: "2026",
        title: "Peça pronta",
        text: "Visão completa para encaixar no time certo.",
      },
    ],

    // Projects Section
    projectsEyebrow: "Destaques",
    projectsTitle: "Projetos em foco",
    projects: [
      {
        name: "persi.ga",
        description: "Wordle em português com foco em comunidade.",
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
        description: "Ferramenta leve para criar enquetes rápidas.",
        link: "https://duarch.github.io/easypoll",
        image: "/assets/easypoll.webp",
      },
    ],
    viewProject: "Ver projeto",

    // Unique Section
    uniqueEyebrow: "Diferencial",
    uniqueTitle: "Eu não sou apenas mais uma peça.",
    uniqueText: "Sou a peça que conecta as outras. Traduzo objetivos em experiências claras, construo pontes entre produto e tecnologia e entro no time para destravar o próximo nível.",

    // Archive Section
    archiveEyebrow: "Arquivo",
    archiveTitle: "Evolução e versões antigas",
    archive: [
      {
        year: "2026",
        label: "Puzzle Story (atual)",
        link: "/",
      },
      {
        year: "2023",
        label: "Versão minimalista",
        link: "/2023/",
      },
      {
        year: "2021",
        label: "Versão anterior",
        link: "/2021/",
      },
    ],

    // Contact Section
    contactTitle: "Vamos montar algo juntos?",
    contactText: "Me chama para conversar sobre produto, tecnologia ou aquele desafio que precisa de uma peça nova.",
    contactButton: "Entrar em contato",

    // Footer
    copyright: "© 2026 DUAR.CH",
    footerResume: "Resume",
    footerGithub: "GitHub",
    footerTwitter: "Twitter",
    footerDev: "DEV",

    // Resume Page
    resumeTitle: "Resume - André Duarte",
    resumeBack: "← Voltar",
    resumeSummary: "Resumo",
    resumeAbout: "Desenvolvedor fullstack com 6+ anos de experiência construindo soluções completas—do frontend até infraestrutura. Focado em impacto e experiência do usuário.",
    resumeSkills: "Habilidades",
    resumeExperience: "Experiência",
    resumeEducation: "Formação",
    resumeCertifications: "Certificações",
    resumeContact: "Contato",
    resumeEmail: "Email",
    resumePhone: "Telefone",
    resumeLinkedin: "LinkedIn",
  },
  es: {
    // Header/Hero
    eyebrow: "DUAR.CH 2026",
    heroTitle: "Soy la pieza que falta en tu equipo.",
    heroSubtitle: "Fullstack con visión de producto, diseño y automatización. Conecto las piezas para entregar experiencias completas.",
    viewProjects: "Ver proyectos",
    contactMe: "Contáctame",
    curriculum: "Currículum",
    scrollHint: "Desliza para armar",
    puzzleAlt: "Animación 3D de un rompecabezas que arma la palabra DUAR.CH",

    // Skills Section
    skillsEyebrow: "Cómo encajo",
    skillsTitle: "Lo que entrego",
    skills: [
      {
        title: "Frontend",
        description: "Interfaces vivas, accesibles y con personalidad.",
      },
      {
        title: "Backend",
        description: "APIs estables, integraciones y datos en el lugar correcto.",
      },
      {
        title: "UI/UX",
        description: "Flujos claros, micro-interacciones y jerarquía visual.",
      },
      {
        title: "Automatización",
        description: "Pipelines, tareas repetitivas y despliegue sin dolor.",
      },
      {
        title: "Arquitectura",
        description: "Bases sólidas para crecer sin atascarse.",
      },
      {
        title: "Producto",
        description: "Visión de negocio y enfoque en impacto real.",
      },
    ],

    // Timeline Section
    timelineEyebrow: "Armando el viaje",
    timelineTitle: "Storytelling técnico",
    timeline: [
      {
        year: "2018",
        title: "Primeras experiencias",
        text: "Comienzo del viaje con web y diseño.",
      },
      {
        year: "2020",
        title: "Proyectos reales",
        text: "Sitios web, dashboards y productos en el mundo real.",
      },
      {
        year: "2022",
        title: "Automatización y backend",
        text: "Procesos, APIs e infraestructura organizada.",
      },
      {
        year: "2024",
        title: "IA y sistemas modernos",
        text: "Experimentos con IA aplicada y productos rápidos.",
      },
      {
        year: "2026",
        title: "Pieza lista",
        text: "Visión completa para encajar en el equipo correcto.",
      },
    ],

    // Projects Section
    projectsEyebrow: "Destacados",
    projectsTitle: "Proyectos en foco",
    projects: [
      {
        name: "persi.ga",
        description: "Wordle en portugués enfocado en comunidad.",
        link: "https://persiga.duar.ch",
        image: "/assets/persiga.webp",
      },
      {
        name: "WallSpot",
        description: "Generador de wallpapers con identidad fuerte.",
        link: "https://github.com/duarch/WallSpot",
        image: "/assets/wallspot.webp",
      },
      {
        name: "Gloone",
        description: "Clon conceptual enfocado en UI y detalles.",
        link: "https://duarch.github.io/gloone",
        image: "/assets/gloone.webp",
      },
      {
        name: "Easy Poll",
        description: "Herramienta ligera para crear encuestas rápidas.",
        link: "https://duarch.github.io/easypoll",
        image: "/assets/easypoll.webp",
      },
    ],
    viewProject: "Ver proyecto",

    // Unique Section
    uniqueEyebrow: "Diferencial",
    uniqueTitle: "No soy solo otra pieza.",
    uniqueText: "Soy la pieza que conecta las otras. Traduzco objetivos en experiencias claras, construyo puentes entre producto y tecnología y me uno al equipo para desbloquear el siguiente nivel.",

    // Archive Section
    archiveEyebrow: "Archivo",
    archiveTitle: "Evolución y versiones antiguas",
    archive: [
      {
        year: "2026",
        label: "Puzzle Story (actual)",
        link: "/",
      },
      {
        year: "2023",
        label: "Versión minimalista",
        link: "/2023/",
      },
      {
        year: "2021",
        label: "Versión anterior",
        link: "/2021/",
      },
    ],

    // Contact Section
    contactTitle: "¿Vamos a armar algo juntos?",
    contactText: "Contáctame para hablar sobre producto, tecnología o ese desafío que necesita una pieza nueva.",
    contactButton: "Contáctame",

    // Footer
    copyright: "© 2026 DUAR.CH",
    footerResume: "Currículum",
    footerGithub: "GitHub",
    footerTwitter: "Twitter",
    footerDev: "DEV",

    // Resume Page
    resumeTitle: "Currículum - André Duarte",
    resumeBack: "← Volver",
    resumeSummary: "Resumen",
    resumeAbout: "Desarrollador fullstack con 6+ años de experiencia construyendo soluciones completas—desde interfaces hasta infraestructura. Enfocado en impacto y experiencia del usuario.",
    resumeSkills: "Habilidades",
    resumeExperience: "Experiencia",
    resumeEducation: "Educación",
    resumeCertifications: "Certificaciones",
    resumeContact: "Contacto",
    resumeEmail: "Correo",
    resumePhone: "Teléfono",
    resumeLinkedin: "LinkedIn",
  },
};
