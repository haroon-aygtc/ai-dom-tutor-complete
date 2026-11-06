import { Config, Language, AIProvider, Message, MessageResponse } from './types';

class AdminPanel {
  private config: Config | null = null;

  constructor() {
    console.log('[Admin Panel] Initializing...');
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadConfig();
    this.setupTabs();
    this.renderLanguages();
    this.renderProviders();
    this.setupEventListeners();
    this.updateStatus();
    console.log('[Admin Panel] Ready!');
  }

  private async loadConfig(): Promise<void> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getConfig' } as Message, (response: MessageResponse) => {
        if (response && response.config) {
          this.config = response.config;
          console.log('[Admin Panel] Configuration loaded');
        } else {
          console.warn('[Admin Panel] No configuration received');
        }
        resolve();
      });
    });
  }

  private async saveConfig(): Promise<void> {
    if (!this.config) return;
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'updateConfig',
        config: this.config
      } as Message, (response: MessageResponse) => {
        if (response && response.success) {
          this.showStatus('Configuration saved successfully! 🎉', 'success');
          this.updateStatus();
        } else {
          this.showStatus('Failed to save configuration ❌', 'error');
        }
        resolve();
      });
    });
  }

  private setupTabs(): void {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab;
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Show corresponding content
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.add('hidden');
        });
        
        const targetTab = document.getElementById(`${tabName}-tab`);
        if (targetTab) {
          targetTab.classList.remove('hidden');
        }
      });
    });
  }

  private renderLanguages(): void {
    if (!this.config) return;
    
    const container = document.getElementById('languages-list');
    if (!container) return;

    container.innerHTML = this.config.languages.map(lang => `
      <div class="language-item" data-lang="${lang.code}">
        <div class="language-info">
          <span class="language-flag">${this.getLanguageFlag(lang.code)}</span>
          <div class="language-details">
            <span class="language-code">${lang.code.toUpperCase()}</span>
            <span class="language-label">${lang.label}</span>
            ${lang.rtl ? '<span class="rtl-badge">RTL</span>' : ''}
          </div>
        </div>
        <div class="actions">
          <button class="icon-btn" data-action="set-default" data-lang="${lang.code}" title="Set as default">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
          </button>
          <button class="icon-btn delete-btn" data-action="remove" data-lang="${lang.code}" title="Remove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('.icon-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const action = target.dataset.action;
        const lang = target.dataset.lang;
        
        if (action === 'set-default' && lang) {
          this.setDefaultLanguage(lang);
        } else if (action === 'remove' && lang) {
          this.removeLanguage(lang);
        }
      });
    });
  }

  private renderProviders(): void {
    if (!this.config) return;
    
    const activeSelect = document.getElementById('active-provider') as HTMLSelectElement;
    if (activeSelect) {
      activeSelect.value = this.config.activeProvider;
    }

    const container = document.getElementById('providers-list');
    if (!container) return;

    container.innerHTML = Object.entries(this.config.providers).map(([key, provider]) => `
      <div class="provider-item" data-provider="${key}">
        <div class="provider-info">
          <div class="provider-header">
            <span class="provider-name">${provider.name}</span>
            <span class="provider-status ${provider.apiKey ? 'configured' : 'not-configured'}">
              ${provider.apiKey ? '✅ Configured' : '⚠️ API Key Required'}
            </span>
          </div>
          <div class="provider-details">
            <span class="provider-model">Model: ${provider.model}</span>
            <span class="provider-languages">${provider.supportedLanguages.length} languages</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn-small btn-primary" data-action="configure" data-provider="${key}">
            Configure
          </button>
          <button class="btn-small btn-success" data-action="test" data-provider="${key}">
            Test
          </button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const action = target.dataset.action;
        const provider = target.dataset.provider;
        
        if (action === 'configure' && provider) {
          this.showProviderConfig(provider);
        } else if (action === 'test' && provider) {
          this.testProvider(provider);
        }
      });
    });
  }

  private setupEventListeners(): void {
    // Active provider change
    const activeProvider = document.getElementById('active-provider');
    if (activeProvider) {
      activeProvider.addEventListener('change', (e) => {
        if (this.config) {
          this.config.activeProvider = (e.target as HTMLSelectElement).value;
          this.saveConfig();
        }
      });
    }

    // Add language button
    const addLangBtn = document.getElementById('add-language-btn');
    if (addLangBtn) {
      addLangBtn.addEventListener('click', () => this.addLanguage());
    }

    // Test provider button
    const testBtn = document.getElementById('test-provider-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.testCurrentProvider());
    }

    // Settings toggles
    const voiceToggle = document.getElementById('voice-enabled') as HTMLInputElement;
    const tooltipToggle = document.getElementById('tooltip-enabled') as HTMLInputElement;
    
    if (voiceToggle && this.config) {
      voiceToggle.checked = this.config.voiceEnabled;
      voiceToggle.addEventListener('change', (e) => {
        if (this.config) {
          this.config.voiceEnabled = (e.target as HTMLInputElement).checked;
          this.saveConfig();
        }
      });
    }
    
    if (tooltipToggle && this.config) {
      tooltipToggle.checked = this.config.tooltipEnabled;
      tooltipToggle.addEventListener('change', (e) => {
        if (this.config) {
          this.config.tooltipEnabled = (e.target as HTMLInputElement).checked;
          this.saveConfig();
        }
      });
    }
  }

  private getLanguageFlag(code: string): string {
    const flags: Record<string, string> = {
      en: '🇺🇸',
      ar: '🇸🇦',
      hi: '🇮🇳',
      ur: '🇵🇰',
      es: '🇪🇸',
      fr: '🇫🇷',
      de: '🇩🇪'
    };
    return flags[code] || '🌐';
  }

  private async addLanguage(): Promise<void> {
    const codeInput = document.getElementById('new-lang-code') as HTMLInputElement;
    const labelInput = document.getElementById('new-lang-label') as HTMLInputElement;

    if (!codeInput || !labelInput || !this.config) return;

    const code = codeInput.value.trim().toLowerCase();
    const label = labelInput.value.trim();

    if (!code || !label) {
      this.showStatus('Please enter both language code and label', 'error');
      return;
    }

    if (this.config.languages.find(lang => lang.code === code)) {
      this.showStatus('Language code already exists', 'error');
      return;
    }

    const rtlLanguages = ['ar', 'ur', 'he', 'fa', 'yi'];
    this.config.languages.push({
      code,
      label,
      ttsVoice: `${code}-${code.toUpperCase()}`,
      rtl: rtlLanguages.includes(code)
    });

    await this.saveConfig();
    this.renderLanguages();
    
    // Clear inputs
    codeInput.value = '';
    labelInput.value = '';
  }

  private async removeLanguage(code: string): Promise<void> {
    if (!this.config) return;

    if (this.config.languages.length <= 1) {
      this.showStatus('Cannot remove the last language', 'error');
      return;
    }

    this.config.languages = this.config.languages.filter(lang => lang.code !== code);
    
    // If removing current language, switch to first available
    if (this.config.language === code) {
      this.config.language = this.config.languages[0].code;
    }
    
    await this.saveConfig();
    this.renderLanguages();
  }

  private async setDefaultLanguage(code: string): Promise<void> {
    if (!this.config) return;

    this.config.language = code;
    await this.saveConfig();
    this.showStatus(`Default language set to ${code.toUpperCase()}`, 'success');
  }

  private showProviderConfig(providerKey: string): void {
    if (!this.config) return;

    const provider = this.config.providers[providerKey];
    if (!provider) return;

    const apiKey = prompt(`Enter API Key for ${provider.name}:\n\nGet your key from:\n• OpenAI: platform.openai.com/api-keys\n• Groq: console.groq.com/keys\n• Gemini: makersuite.google.com/app/apikey`, provider.apiKey);
    
    if (apiKey !== null) {
      provider.apiKey = apiKey.trim();
      this.saveConfig().then(() => {
        this.renderProviders();
      });
    }
  }

  private async testProvider(providerKey?: string): Promise<void> {
    if (!this.config) return;
    
    const provider = providerKey || this.config.activeProvider;
    const resultElement = document.getElementById('test-result');
    
    if (!resultElement) return;

    resultElement.classList.remove('hidden');
    resultElement.textContent = `Testing ${this.config.providers[provider]?.name || provider}...`;
    resultElement.className = 'status testing';

    try {
      const elementData = {
        tagName: 'INPUT',
        type: 'email',
        label: 'Email address field',
        placeholder: 'Enter your email'
      };

      const response = await new Promise<MessageResponse>((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'getAIExplanation',
          elementData,
          language: this.config?.language || 'en'
        } as Message, (response: MessageResponse) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      resultElement.textContent = `✅ Success! Response: "${response.explanation}"`;
      resultElement.className = 'status success';
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      resultElement.textContent = `❌ Test failed: ${errorMsg}`;
      resultElement.className = 'status error';
    }
  }

  private async testCurrentProvider(): Promise<void> {
    await this.testProvider();
  }

  private updateStatus(): void {
    if (!this.config) return;
    
    const statusElement = document.getElementById('extension-status');
    if (!statusElement) return;
    
    const provider = this.config.providers[this.config.activeProvider];
    const hasApiKey = provider?.apiKey && provider.apiKey.length > 0;
    
    statusElement.innerHTML = `
      <div class="status-item">
        <span class="status-label">Active Provider:</span>
        <span class="status-value">${provider?.name || 'None'}</span>
      </div>
      <div class="status-item">
        <span class="status-label">API Key:</span>
        <span class="status-value ${hasApiKey ? 'configured' : 'not-configured'}">
          ${hasApiKey ? '✅ Configured' : '❌ Not Set'}
        </span>
      </div>
      <div class="status-item">
        <span class="status-label">Default Language:</span>
        <span class="status-value">${this.config.language.toUpperCase()}</span>
      </div>
      <div class="status-item">
        <span class="status-label">Voice Enabled:</span>
        <span class="status-value">${this.config.voiceEnabled ? '🔊 Yes' : '🔇 No'}</span>
      </div>
    `;
  }

  private showStatus(message: string, type: 'success' | 'error' | 'info'): void {
    let status = document.getElementById('status-toast');
    if (!status) {
      status = document.createElement('div');
      status.id = 'status-toast';
      status.className = 'status-toast';
      document.body.appendChild(status);
    }

    status.textContent = message;
    status.className = `status-toast ${type} show`;

    setTimeout(() => {
      status?.classList.remove('show');
    }, 3000);
  }
}

// Initialize admin panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AdminPanel();
});