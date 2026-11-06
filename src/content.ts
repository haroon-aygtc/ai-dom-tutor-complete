// ai-tutor/content.ts — Speech language FIX (provider-first, locale-correct), production-ready

import { Config, ElementData, Message, MessageResponse, TutorState } from './types';

/* =========================================
   VoiceManager (Web Speech, locale-correct)
   - Waits for voices to load
   - Picks real locale voices (incl. tl/fil aliases)
   - Refuses to speak non-English with an English voice
   - Treats 'interrupted'/'canceled' as normal
   ========================================= */
class VoiceManager {
  private synthesis: SpeechSynthesis | null = null;
  private voicesReady: Promise<void> | null = null;
  private currentLanguage: string = 'en';

  constructor() {
    this.initializeSpeechSynthesis();
  }

  private initializeSpeechSynthesis(): void {
    if (!('speechSynthesis' in window)) {
      console.warn('[AI Tutor] Speech synthesis not supported');
      return;
    }
    this.synthesis = window.speechSynthesis;

    if (this.synthesis.getVoices().length === 0) {
      this.voicesReady = new Promise<void>((resolve) => {
        const onVoices = () => {
          if (!this.synthesis) return;
          this.synthesis.removeEventListener('voiceschanged', onVoices as any);
          console.log('[AI Tutor] Voices loaded:', this.synthesis.getVoices().length);
          resolve();
        };
        this.synthesis.addEventListener('voiceschanged', onVoices as any);
      });
    } else {
      this.voicesReady = Promise.resolve();
    }
  }

  updateLanguage(language: string): void {
    this.currentLanguage = language;
    console.log('[AI Tutor] Voice language updated to:', language);
  }

  private selectBestVoice(targetLang: string): SpeechSynthesisVoice | null {
    if (!this.synthesis) return null;
    const voices = this.synthesis.getVoices();
    const L = (s: string) => s.toLowerCase();

    // Alias map (covers Tagalog/Filipino & common spellings)
    const aliases: Record<string, string[]> = {
      en: ['en', 'en-US', 'en-GB', 'en-AU', 'en-CA'],
      ur: ['ur', 'ur-PK', 'ur-IN', 'urdu', 'اردو'],
      hi: ['hi', 'hi-IN', 'hindi', 'हिंदी'],
      ar: ['ar', 'ar-SA', 'ar-EG', 'arabic', 'العربية'],
      es: ['es', 'es-ES', 'es-MX', 'spanish', 'español'],
      fr: ['fr', 'fr-FR', 'fr-CA', 'french', 'français'],
      de: ['de', 'de-DE', 'de-AT', 'german', 'deutsch'],
      fil: ['fil', 'fil-PH', 'tl', 'tl-PH', 'tagalog', 'filipino'],
      tl: ['tl', 'tl-PH', 'tagalog']
    };

    const base = targetLang.split('-')[0];
    const wanted = (aliases[targetLang] || aliases[base] || [targetLang]).map(L);

    // 1) exact lang tag match
    let voice =
      voices.find(v => wanted.includes(L(v.lang))) ||
      // 2) prefix match (hi → hi-*)
      voices.find(v => wanted.some(w => L(v.lang).startsWith(w.split('-')[0] + '-'))) ||
      // 3) name contains language words
      voices.find(v =>
        /urdu|اردو|hindi|हिंदी|arabic|العربية|spanish|español|french|français|german|deutsch|tagalog|filipino/i.test(v.name)
      );

    // Fallbacks
    if (!voice) voice = (voices as any).find((v: any) => v.default) || voices[0] || null;
    // Avoid accidental German for non-German
    if (voice && L(voice.lang).startsWith('de') && !targetLang.startsWith('de')) {
      voice = voices.find(v => !L(v.lang).startsWith('de')) || voice;
    }
    return voice || null;
  }

  async speak(text: string, language?: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      try {
        await this.voicesReady;
      } catch {
        console.warn('[AI Tutor] Voice loading failed, continuing anyway');
      }

      if (this.synthesis.speaking) {
        // Normal: cancel previous speech before speaking a new one
        this.synthesis.cancel();
      }

      const targetLang = (language || this.currentLanguage || 'en').toLowerCase();
      const voice = this.selectBestVoice(targetLang);

      if (!voice) {
        console.warn('[AI Tutor] No voices available for language:', targetLang);
        reject(new Error('No voices available'));
        return;
      }

      // Block wrong-language fallback (e.g., English voice reading Urdu)
      const isNonEnglish = !targetLang.startsWith('en');
      const isEnglishVoice = voice.lang.toLowerCase().startsWith('en');
      if (isNonEnglish && isEnglishVoice) {
        console.warn('[AI Tutor] No matching local voice for', targetLang, '(selected voice is English).');
        reject(new Error('no_matching_local_voice'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      // Prefer the voice's own tag; Chrome respects that better than setting targetLang directly.
      utterance.voice = voice;
      utterance.lang = voice.lang || targetLang;
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 0.95;

      utterance.onstart = () => {
        console.log('[AI Tutor] 🎵 Speech started:', voice.name, voice.lang);
      };
      utterance.onend = () => {
        console.log('[AI Tutor] 🎵 Speech completed');
        resolve();
      };
      utterance.onerror = (event) => {
        const err = (event as any).error;
        if (err === 'interrupted' || err === 'canceled') {
          console.log('[AI Tutor] Speech canceled (normal)');
          resolve();
          return;
        }
        console.error('[AI Tutor] Speech error:', err);
        reject(new Error(err));
      };

      this.synthesis.speak(utterance);
    });
  }
}

/* ==========================================================
   TTSProvider (Provider-first with robust fallbacks)
   Order:
     1) Background proxy → /api/tts (backend, OpenAI or your engine)
     2) Direct backend fetch if background not available
     3) Google Translate TTS URL (last resort)
   Language mapping covers 'fil' → 'tl' and normalizes region tags
   ========================================================== */
class TTSProvider {
  private audioCache = new Map<string, string>(); // text/lang → objectURL
  private readonly backendBase = (localStorage.getItem('bff_url') || '').trim(); // configurable in Options

  async speakViaProvider(text: string, language: string): Promise<void> {
    const baseLang = (language || 'en').toLowerCase().split('-')[0];

    // Cache hit?
    const cacheKey = `${baseLang}::${text}`;
    if (this.audioCache.has(cacheKey)) {
      await this.playObjectUrl(this.audioCache.get(cacheKey)!);
      return;
    }

    // 1) Try background proxy (avoids CORS/host_permissions pain)
    try {
      const blobUrl = await this.requestViaBackground(text, baseLang);
      if (blobUrl) {
        this.audioCache.set(cacheKey, blobUrl);
        await this.playObjectUrl(blobUrl);
        return;
      }
    } catch (e) {
      console.warn('[AI Tutor] Background TTS proxy failed:', e);
    }

    // 2) Try direct backend if configured
    if (this.backendBase) {
      try {
        const blobUrl = await this.requestViaBackend(text, baseLang);
        this.audioCache.set(cacheKey, blobUrl);
        await this.playObjectUrl(blobUrl);
        return;
      } catch (e) {
        console.warn('[AI Tutor] Direct TTS backend failed:', e);
      }
    }

    // 3) Last resort: Google Translate TTS public endpoint (may be rate-limited)
    const url = this.googleTranslateTtsUrl(text, baseLang);
    this.audioCache.set(cacheKey, url);
    await this.playObjectUrl(url);
  }

  private requestViaBackground(text: string, lang: string): Promise<string | null> {
    return new Promise((resolve) => {
      // Optional: your background service worker should implement this message.
      chrome.runtime.sendMessage(
        { action: 'tts', text, lang },
        (resp: { ok: boolean; blobUrl?: string; error?: string } | undefined) => {
          if (!resp || !resp.ok || !resp.blobUrl) return resolve(null);
          resolve(resp.blobUrl);
        }
      );
    });
  }

  private async requestViaBackend(text: string, lang: string): Promise<string> {
    const res = await fetch(`${this.backendBase}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang })
    });
    if (!res.ok) {
      let err: any = null;
      try { err = await res.json(); } catch {}
      throw new Error(err?.error || `status_${res.status}`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  private googleTranslateTtsUrl(text: string, language: string): string {
    // Normalize regional tags to base
    const base = language.toLowerCase().split('-')[0];
    // Map our codes to Translate TTS codes
    const map: Record<string, string> = {
      ur: 'ur',
      hi: 'hi',
      ar: 'ar',
      es: 'es',
      fr: 'fr',
      de: 'de',
      en: 'en',
      fil: 'tl',
      tl: 'tl'
    };
    const tl = map[base] || 'en';
    const encoded = encodeURIComponent(text);
    return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encoded}`;
  }

  private playObjectUrl(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.volume = 0.95;
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Audio playback failed'));
      audio.play().catch(reject);
    });
  }
}

/* =========================
   DOMTutorEngine (Content)
   ========================= */
class DOMTutorEngine {
  private config: Config | null = null;
  private state: TutorState = {
    isActive: false,
    currentLanguage: 'en',
    currentElement: null,
    tooltip: null
  };
  private launcher: HTMLElement | null = null;
  private voiceManager: VoiceManager;
  private ttsProvider: TTSProvider;
  private focusHighlightEl: HTMLDivElement | null = null;

  constructor() {
    console.log('[AI Tutor] Content script initializing...');
    this.voiceManager = new VoiceManager();
    this.ttsProvider = new TTSProvider();
    this.init();
  }

  private async init(): Promise<void> {
    console.log('[AI Tutor] Starting initialization...');
    this.injectFloatingButton();
    await this.loadConfig();
    this.updateButtonLanguages();
    this.setupEventListeners();
    console.log('[AI Tutor] ✅ Initialization complete! Ready to assist.');
  }

  private async loadConfig(): Promise<void> {
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ action: 'getConfig' } as Message, (response: MessageResponse) => {
        if (response && response.config) {
          this.config = response.config;
          this.state.isActive = !!response.config.isActive;
          this.state.currentLanguage = response.config.language || 'en';
          this.voiceManager.updateLanguage(this.state.currentLanguage);
          console.log('[AI Tutor] Configuration loaded:', {
            provider: this.config.activeProvider,
            language: this.config.language,
            languages: this.config.languages.length
          });
        } else {
          console.warn('[AI Tutor] No configuration received, using defaults');
          this.config = {
            activeProvider: 'groq',
            language: 'en',
            isActive: false,
            voiceEnabled: true,
            tooltipEnabled: true,
            providers: {},
            languages: [
              { code: 'en', label: 'English', ttsVoice: 'en-US', rtl: false },
              { code: 'ar', label: 'العربية', ttsVoice: 'ar-SA', rtl: true },
              { code: 'hi', label: 'हिन्दी', ttsVoice: 'hi-IN', rtl: false },
              { code: 'ur', label: 'اردو', ttsVoice: 'ur-PK', rtl: true },
              { code: 'fil', label: 'Filipino', ttsVoice: 'tl-PH', rtl: false }
            ]
          };
        }
        resolve();
      });
    });
  }

  private injectFloatingButton(): void {
    if (document.getElementById('ai-tutor-launcher')) return;

    const launcher = document.createElement('div');
    launcher.id = 'ai-tutor-launcher';
    launcher.className = 'ai-tutor-launcher';

    const button = document.createElement('button');
    button.className = 'tutor-btn';
    button.setAttribute('aria-label', 'AI DOM Tutor');
    button.innerHTML = `
      <svg class="tutor-icon" viewBox="0 0 24 24" fill="white" aria-hidden="true">
        <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/>
      </svg>
    `;

    const dropdown = document.createElement('div');
    dropdown.className = 'language-dropdown hidden';
    dropdown.id = 'ai-tutor-dropdown';
    dropdown.setAttribute('role', 'menu');

    launcher.appendChild(button);
    launcher.appendChild(dropdown);
    document.body.appendChild(launcher);

    this.launcher = launcher;
    this.setupButtonEvents();
  }

  private updateButtonLanguages(): void {
    if (!this.config || !this.launcher) return;
    const dropdown = this.launcher.querySelector('.language-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = this.config.languages
      .map(
        (lang) => `
      <div class="language-option" 
           data-lang="${lang.code}" 
           role="menuitem"
           tabindex="0"
           ${lang.rtl ? 'dir="rtl"' : ''}>
        <span class="lang-flag">${this.getLanguageFlag(lang.code)}</span>
        <span class="lang-label">${lang.label}</span>
      </div>
    `
      )
      .join('');

    dropdown.querySelectorAll('.language-option').forEach((option) => {
      const select = (e: Event) => {
        e.stopPropagation();
        const lang = (option as HTMLElement).dataset.lang;
        if (lang && this.config) {
          this.config.language = lang;
          this.state.currentLanguage = lang;
          this.voiceManager.updateLanguage(lang);
          this.toggleTutor(true);
          dropdown.classList.add('hidden');
          this.updateConfig({ language: lang, isActive: true });
        }
      };
      option.addEventListener('click', select);
      option.addEventListener('keydown', (e) => {
        const k = e as KeyboardEvent;
        if (k.key === 'Enter' || k.key === ' ') {
          e.preventDefault();
          select(e);
        }
      });
    });
  }

  private getLanguageFlag(code: string): string {
    const flags: Record<string, string> = {
      en: '🇺🇸',
      ar: '🇸🇦',
      hi: '🇮🇳',
      ur: '🇵🇰',
      es: '🇪🇸',
      fr: '🇫🇷',
      de: '🇩🇪',
      fil: '🇵🇭'
    };
    return flags[code] || '🌐';
  }

  private setupButtonEvents(): void {
    if (!this.launcher) return;

    const button = this.launcher.querySelector('.tutor-btn') as HTMLElement;
    const dropdown = this.launcher.querySelector('.language-dropdown') as HTMLElement;

    const toggleDropdown = (e: Event) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
      if (!dropdown.classList.contains('hidden')) {
        (dropdown.querySelector('.language-option') as HTMLElement)?.focus();
      }
    };

    button.addEventListener('click', toggleDropdown);
    button.addEventListener('keydown', (e) => {
      const k = e as KeyboardEvent;
      if (k.key === 'Enter' || k.key === ' ') {
        e.preventDefault();
        toggleDropdown(e);
      }
    });

    document.addEventListener('click', () => dropdown.classList.add('hidden'));
    document.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') {
        dropdown.classList.add('hidden');
        button.focus();
      }
    });
  }

  private setupEventListeners(): void {
    document.addEventListener('focus', this.handleElementFocus.bind(this), true);
    document.addEventListener('blur', this.handleElementBlur.bind(this), true);

    // Re-inject launcher if removed
    const observer = new MutationObserver(() => {
      if (!document.getElementById('ai-tutor-launcher')) {
        this.injectFloatingButton();
        this.updateButtonLanguages();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  private async handleElementFocus(event: FocusEvent): Promise<void> {
    if (!this.state.isActive || !this.config) return;

    const element = event.target as HTMLElement;
    if (this.isInteractiveElement(element)) {
      this.state.currentElement = element;
      await this.highlightAndExplain(element);
    }
  }

  private handleElementBlur(): void {
    this.removeHighlight();
    this.hideTooltip();
    if ('speechSynthesis' in window && !this.state.isActive) {
      speechSynthesis.cancel();
    }
    this.state.currentElement = null;
  }

  private isInteractiveElement(element: HTMLElement): boolean {
    const interactiveTags = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'];
    const interactiveRoles = ['button', 'link', 'textbox', 'combobox', 'listbox'];
    return (
      interactiveTags.includes(element.tagName) ||
      interactiveRoles.includes(element.getAttribute('role') || '') ||
      element.tabIndex >= 0 ||
      element.hasAttribute('contenteditable')
    );
  }

  private async highlightAndExplain(element: HTMLElement): Promise<void> {
    this.highlightElement(element);

    const elementData = this.extractElementData(element);

    try {
      const explanation = await this.getAIExplanation(elementData);

      if (this.config?.tooltipEnabled) {
        this.showTooltip(element, explanation);
      }

      if (this.config?.voiceEnabled) {
        // Provider-first (native language), then local only if a matching locale exists
        await this.speakWithFallback(explanation, this.state.currentLanguage);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      if (this.config?.tooltipEnabled) {
        this.showTooltip(
          element,
          `⚠️ ${errorMsg}\n\nPlease check:\n• API key is configured\n• Internet connection\n• Extension settings`
        );
      }
    }
  }

  /* ---------- Visual highlight & tooltip ---------- */

  private highlightElement(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    if (!this.focusHighlightEl) {
      this.focusHighlightEl = document.createElement('div');
      this.focusHighlightEl.style.position = 'absolute';
      this.focusHighlightEl.style.pointerEvents = 'none';
      this.focusHighlightEl.style.border = '2px solid #2563eb';
      this.focusHighlightEl.style.borderRadius = '6px';
      this.focusHighlightEl.style.boxShadow = '0 0 0 2px rgba(37,99,235,.2),0 8px 24px rgba(0,0,0,.2)';
      this.focusHighlightEl.style.zIndex = '2147483646';
      document.documentElement.appendChild(this.focusHighlightEl);
    }
    const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    Object.assign(this.focusHighlightEl.style, {
      left: `${Math.round(rect.left + scrollX) - 2}px`,
      top: `${Math.round(rect.top + scrollY) - 2}px`,
      width: `${Math.round(rect.width) + 4}px`,
      height: `${Math.round(rect.height) + 4}px`,
      display: 'block'
    });
  }

  private removeHighlight(): void {
    if (this.focusHighlightEl) {
      this.focusHighlightEl.remove();
      this.focusHighlightEl = null;
    }
  }

  private showTooltip(element: HTMLElement, explanation: string): void {
    this.hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'ai-tutor-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.textContent = explanation;

    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft || 0;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;

    tooltip.style.position = 'fixed';
    tooltip.style.maxWidth = '360px';
    tooltip.style.background = '#0b1120';
    tooltip.style.color = '#e2e8f0';
    tooltip.style.border = '1px solid rgba(148,163,184,.25)';
    tooltip.style.borderRadius = '10px';
    tooltip.style.padding = '10px 12px';
    tooltip.style.font = '13px/1.45 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial';
    tooltip.style.zIndex = '2147483647';

    const left = rect.left + scrollX;
    const top = rect.bottom + scrollY + 8;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    document.body.appendChild(tooltip);
    this.state.tooltip = tooltip;

    setTimeout(() => {
      const t = tooltip.getBoundingClientRect();
      if (t.right > window.innerWidth) {
        tooltip.style.left = `${Math.max(8, window.innerWidth - t.width - 8)}px`;
      }
      if (t.bottom > window.innerHeight) {
        tooltip.style.top = `${Math.max(8, rect.top + scrollY - t.height - 8)}px`;
      }
    }, 0);

    setTimeout(() => this.hideTooltip(), 10000);
  }

  private hideTooltip(): void {
    if (this.state.tooltip) {
      this.state.tooltip.remove();
      this.state.tooltip = null;
    }
  }

  /* ---------- Data extraction & AI ---------- */

  private extractElementData(element: HTMLElement): ElementData {
    const input = element as HTMLInputElement;
    return {
      tagName: element.tagName,
      type: input.type || element.getAttribute('type') || 'unknown',
      label: this.getElementLabel(element),
      placeholder: input.placeholder,
      name: input.name,
      id: element.id,
      value: input.value,
      ariaLabel: element.getAttribute('aria-label') || undefined
    };
  }

  private getElementLabel(element: HTMLElement): string {
    const input = element as HTMLInputElement;

    if (element.id) {
      const lab = document.querySelector(`label[for="${element.id}"]`);
      if (lab) return lab.textContent?.trim() || '';
    }
    if (input.labels && input.labels.length > 0) {
      return input.labels[0].textContent?.trim() || '';
    }
    const aria = element.getAttribute('aria-label');
    if (aria) return aria;
    if (input.placeholder) return input.placeholder;

    const parent = element.parentElement;
    if (parent) {
      const txt = Array.from(parent.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent?.trim())
        .find((t) => t && t.length > 2);
      if (txt) return txt;
    }
    return input.name || element.className || element.tagName;
  }

  private async getAIExplanation(elementData: ElementData): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: 'getAIExplanation',
          elementData,
          language: this.state.currentLanguage
        } as Message,
        (response: MessageResponse) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.error) {
            reject(new Error(response.error));
          } else if (response?.explanation) {
            resolve(response.explanation);
          } else {
            reject(new Error('No explanation received from AI service'));
          }
        }
      );
    });
  }

  /* ---------- Speech orchestration ---------- */

  private async speakWithFallback(text: string, language: string): Promise<void> {
    // 1) Provider first (guarantees correct language if reachable)
    try {
      await this.ttsProvider.speakViaProvider(text, language);
      console.log('[AI Tutor] 🔊 Provider TTS completed');
      return;
    } catch (e) {
      console.warn('[AI Tutor] Provider TTS failed; checking local voices:', e);
    }

    // 2) Local Web Speech ONLY if a matching locale voice exists
    try {
      await this.voiceManager.speak(text, language);
      console.log('[AI Tutor] 🔊 Local speech completed');
    } catch (localErr) {
      console.error('[AI Tutor] Local speech failed or no matching voice:', localErr);
      // Final: do nothing rather than speaking in the wrong language.
    }
  }

  /* ---------- State & config ---------- */

  private toggleTutor(active: boolean): void {
    this.state.isActive = active;
    if (this.launcher) this.launcher.classList.toggle('active', active);
    if (!active) {
      this.removeHighlight();
      this.hideTooltip();
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    }
  }

  private updateConfig(updates: Partial<Config>): void {
    chrome.runtime.sendMessage({
      action: 'updateConfig',
      config: updates
    } as Message);
  }
}

/* ---------- Boot ---------- */
function initializeTutor(): void {
  try {
    new DOMTutorEngine();
  } catch (error) {
    console.error('[AI Tutor] ❌ Initialization failed:', error);
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeTutor);
} else {
  initializeTutor();
}
