import { useLanguage } from '../contexts/LanguageContext.jsx';
import './LanguageSwitcher.css';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="language-switcher" aria-label="Seletor de idioma">
      <button
        className={`lang-btn ${language === 'pt' ? 'active' : ''}`}
        onClick={() => setLanguage('pt')}
        title="Português"
        aria-pressed={language === 'pt'}
      >
        PT
      </button>
      <button
        className={`lang-btn ${language === 'en' ? 'active' : ''}`}
        onClick={() => setLanguage('en')}
        title="English"
        aria-pressed={language === 'en'}
      >
        EN
      </button>
      <button
        className={`lang-btn ${language === 'es' ? 'active' : ''}`}
        onClick={() => setLanguage('es')}
        title="Español"
        aria-pressed={language === 'es'}
      >
        ES
      </button>
    </div>
  );
}
