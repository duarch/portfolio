import { useCallback, useEffect, useRef, useState } from 'react';

let loadingScript;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loadingScript) {
    loadingScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.turnstile) resolve(window.turnstile);
        else reject(new Error('errors.turnstile'));
      };
      script.onerror = () => {
        script.remove();
        reject(new Error('errors.turnstile'));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      loadingScript = undefined;
      throw error;
    });
  }
  return loadingScript;
}

// Every protected POST consumes its own token. Reset only after the POST so a
// fresh challenge can run while files upload, without reusing a single-use token.
export function useTurnstile(config, locale) {
  const elementRef = useRef(null);
  const tokenRef = useRef(null);
  const widgetRef = useRef(null);
  const waiterRef = useRef(null);
  const localeRef = useRef(locale);
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState('loading');
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 370px)').matches);
  localeRef.current = locale;

  useEffect(() => {
    const query = window.matchMedia('(max-width: 370px)');
    const update = () => setCompact(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const rejectWaiter = useCallback(() => {
    if (waiterRef.current) {
      clearTimeout(waiterRef.current.timeout);
      waiterRef.current.reject(new Error('errors.turnstile'));
      waiterRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!config) return undefined;
    tokenRef.current = null;
    if (config.mockServices) {
      setState('ready');
      return undefined;
    }
    if (!config.turnstileSiteKey) {
      setState('error');
      return undefined;
    }
    let active = true;
    setState('loading');
    loadTurnstile().then((turnstile) => {
      if (!active || !elementRef.current) return;
      widgetRef.current = turnstile.render(elementRef.current, {
        sitekey: config.turnstileSiteKey,
        language: localeRef.current === 'pt-BR' ? 'pt-br' : localeRef.current,
        theme: 'light',
        // Flexible widgets require 300px; the form's inner width is smaller on
        // narrow phones. Compact mode preserves keyboard access without overflow.
        size: compact ? 'compact' : 'flexible',
        callback: (token) => {
          if (!active) return;
          tokenRef.current = token;
          setState('ready');
          if (waiterRef.current) {
            clearTimeout(waiterRef.current.timeout);
            waiterRef.current.resolve(token);
            waiterRef.current = null;
          }
        },
        'expired-callback': () => {
          tokenRef.current = null;
          if (active) setState('loading');
        },
        'error-callback': () => {
          tokenRef.current = null;
          if (active) setState('error');
          rejectWaiter();
        },
      });
    }).catch(() => {
      if (active) setState('error');
      rejectWaiter();
    });
    return () => {
      active = false;
      tokenRef.current = null;
      rejectWaiter();
      if (widgetRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, [config, locale, compact, generation, rejectWaiter]);

  const consume = useCallback(async () => {
    if (config?.mockServices) return 'local-mock-token';
    if (state === 'error') throw new Error('errors.turnstile');
    let token = tokenRef.current;
    if (!token) {
      token = await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          waiterRef.current = null;
          setState('error');
          reject(new Error('errors.turnstile'));
        }, 120_000);
        waiterRef.current = { resolve, reject, timeout };
      });
    }
    tokenRef.current = null;
    return token;
  }, [config, state]);

  const reset = useCallback(() => {
    if (config?.mockServices) return;
    tokenRef.current = null;
    setState('loading');
    if (widgetRef.current !== null && window.turnstile) {
      window.turnstile.reset(widgetRef.current);
    }
  }, [config]);

  return {
    elementRef,
    state,
    consume,
    reset,
    retry: () => setGeneration((value) => value + 1),
  };
}
