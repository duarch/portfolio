import { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext.jsx";
import "./LanguageSwitcher.css";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let scrollTimeout;

    const handleScroll = () => {
      const scrollPosition = window.scrollY;

      // Detecta se rolou mais de 50px
      if (scrollPosition > 50 && !isScrolled) {
        setIsScrolled(true);
        setIsExpanded(false);
      } else if (scrollPosition <= 50 && isScrolled) {
        setIsScrolled(false);
      }

      // Recolhe após parar de rolar (se estava expandido)
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (isExpanded && scrollPosition > 50) {
          setIsExpanded(false);
        }
      }, 1500);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [isExpanded, isScrolled]);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    // Recolhe após selecionar (com delay para feedback visual)
    setTimeout(() => {
      setIsExpanded(false);
    }, 300);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const languages = [
    { code: "pt", label: "PT", title: "Português" },
    { code: "en", label: "EN", title: "English" },
    { code: "es", label: "ES", title: "Español" },
  ];

  const currentLang = languages.find((lang) => lang.code === language);
  const otherLangs = languages.filter((lang) => lang.code !== language);

  return (
    <div
      className={`language-switcher ${
        isScrolled && !isExpanded ? "collapsed" : "expanded"
      }`}
      aria-label="Seletor de idioma"
    >
      {/* Botão do idioma atual - sempre visível */}
      <button
        className="lang-btn active"
        onClick={toggleExpanded}
        title={currentLang.title}
        aria-pressed="true"
        aria-expanded={isExpanded}
      >
        {currentLang.label}
      </button>

      {/* Outros idiomas - visíveis quando expandido */}
      <div className="lang-options">
        {otherLangs.map((lang) => (
          <button
            key={lang.code}
            className="lang-btn"
            onClick={() => handleLanguageChange(lang.code)}
            title={lang.title}
            aria-pressed="false"
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
