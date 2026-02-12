import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDefaultLanguage, translations } from '../i18n.js';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(getDefaultLanguage());

  useEffect(() => {
    // Salvar preferência em localStorage
    localStorage.setItem('language', language);
    // Atualizar html lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] ?? translations['en'][key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage deve ser usado dentro de LanguageProvider');
  }
  return context;
};
