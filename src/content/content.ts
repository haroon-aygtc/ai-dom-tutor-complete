interface Config {
  activeProvider: string;
  language: string;
  providers: Record<string, Provider>;
  languages: Language[];
}


interface Provider {
  name: string;
  endpoint: string;
  model: string;
  apiKey: string;
  supportedLanguages: string[];
}


interface Language {
  code: string;
  label: string;
  ttsVoice: string | null;
  rtl: boolean;
}


class DOMTutorEngine {
  private config: Config | null = null;
  private isActive: boolean = false;
  private currentTooltip: HTMLElement | null = null;


  constructor() {
    this.init().catch((error) => console.error('Content init error:', error));
  }


  private async init(): Promise<void> {
    await this.loadConfig();
    this.injectFloatingButton();
    this.setupEventListeners();
  }


  private async loadConfig(): Promise<void> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getConfig' }, (response: Config) => {
        this.config = response;
        resolve();
      });
    });
  }


  private injectFloatingButton(): void {
    if (!this.config) return;


    const buttonHTML = `
      <div id="ai-tutor-launcher" class="ai-tutor-launcher">
        <button class="tutor-btn">
          <svg class="tutor-icon" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
        </button>
        <div class="language-dropdown hidden">
          ${this.config.languages.map((lang) => `
            <div class="language-option" data-lang="${lang.code}" ${lang.rtl ? 'dir="rtl"' : ''}>
              ${lang.label}
            </div>
          `).join('')}
        </div>
      </div>
    `;


    const container = document.createElement('div');
    container.innerHTML = buttonHTML;
    document.body.appendChild(container.firstElementChild as HTMLElement);
    this.setupButtonEvents();
  }


  private setupButtonEvents(): void {
    const launcher = document.getElementById('ai-tutor-launcher');
    if (!launcher) return;


    const button = launcher.querySelector('.tutor-btn');
    const dropdown = launcher.querySelector('.language-dropdown');


    button?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      dropdown?.classList.toggle('hidden');
    });


    dropdown?.querySelectorAll('.language-option').forEach((option) => {
      option.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        if (this.config) this.config.language = option.getAttribute('data-lang') || 'en';
        this.toggleTutor(true);
        dropdown.classList.add('hidden');
      });
    });


    document.addEventListener('click', () => {
      dropdown?.classList.add('hidden');
    });
  }


  private setupEventListeners(): void {
    document.addEventListener('focus', this.handleElementFocus.bind(this), true);
    document.addEventListener('blur', this.handleElementBlur.bind(this), true);
  }


  private handleElementFocus(event: FocusEvent): void {
    if (!this.isActive) return;
    const element = event.target as HTMLElement;
    if (this.isInteractiveElement(element)) {
      this.highlightAndExplain(element).catch((error) => console.error('Focus error:', error));
    }
  }


  private handleElementBlur(): void {
    this.removeHighlight();
    this.hideTooltip();
  }


  private isInteractiveElement(element: HTMLElement): boolean {
    const interactiveTags = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'];
    return interactiveTags.includes(element.tagName) || 
          element.getAttribute('role') === 'button' ||
          element.tabIndex >= 0;
  }


  private async highlightAndExplain(element: HTMLElement): Promise<void> {
    this.highlightElement(element);


    const elementData = this.extractElementData(element);
    const explanation = await this.getAIExplanation(elementData);


    this.showTooltip(element, explanation);
    this.speakExplanation(explanation);
  }


  private highlightElement(element: HTMLElement): void {
    this.removeHighlight();
    element.classList.add('ai-tutor-highlight');
    element.style.setProperty('--highlight-color', '#3b82f6', 'important');
  }


  private removeHighlight(): void {
    const highlighted = document.querySelector('.ai-tutor-highlight');
    if (highlighted) {
      highlighted.classList.remove('ai-tutor-highlight');
      (highlighted as HTMLElement).style.removeProperty('--highlight-color');
    }
  }


  private extractElementData(element: HTMLElement): any {
    return {
      tagName: element.tagName,
      type: (element as HTMLInputElement).type || 'unknown',
      label: this.getElementLabel(element),
      placeholder: (element as HTMLInputElement).placeholder || '',
      name: element.name || '',
      id: element.id || '',
      value: (element as HTMLInputElement).value || '',
    };
  }


  private getElementLabel(element: HTMLElement): string {
    const input = element as HTMLInputElement;
    if (input.labels && input.labels.length > 0) {
      return input.labels[0].textContent || '';
    }


    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.textContent || '';


    return input.placeholder || element.name || input.type || 'Form element';
  }


  private async getAIExplanation(elementData: any): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'getAIExplanation',
        elementData,
        language: this.config?.language || 'en',
      }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.explanation);
        }
      });
    });
  }


  private showTooltip(element: HTMLElement, explanation: string): void {
    this.hideTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'ai-tutor-tooltip';
    tooltip.textContent = explanation;
    const rect = element.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 5}px`;
    document.body.appendChild(tooltip);
    this.currentTooltip = tooltip;
  }


  private hideTooltip(): void {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  }


  private speakExplanation(explanation: string): void {
    if ('speechSynthesis' in window && this.config) {
      const utterance = new SpeechSynthesisUtterance(explanation);
      utterance.lang = this.config.language;
      utterance.rate = 0.8;
      speechSynthesis.speak(utterance);
    }
  }


  private toggleTutor(active: boolean): void {
    this.isActive = active;
    const launcher = document.getElementById('ai-tutor-launcher');
    launcher?.classList.toggle('active', active);


    if (!active) {
      this.removeHighlight();
      this.hideTooltip();
      speechSynthesis.cancel();
    }
  }
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new DOMTutorEngine());
} else {
  new DOMTutorEngine();
}
