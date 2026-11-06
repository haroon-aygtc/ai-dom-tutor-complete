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


class AdminPanel {
  private config: Config | null = null;


  constructor() {
    this.init().catch((error) => console.error('Popup init error:', error));
  }


  private async init(): Promise<void> {
    await this.loadConfig();
    this.setupTabs();
    this.renderLanguages();
    this.renderProviders();
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


  private async saveConfig(): Promise<void> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'updateConfig',
        config: this.config
      }, (response: any) => {
        if (response.success) {
          this.showStatus('Configuration saved successfully', 'success');
        }
        resolve();
      });
    });
  }


  private setupTabs(): void {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.add('hidden');
        });
        const content = document.getElementById(`${tabName}-tab`);
        if (content) content.classList.remove('hidden');
      });
    });
  }


  private renderLanguages(): void {
    const container = document.getElementById('languages-list');
    if (!container || !this.config) return;
    container.innerHTML = this.config.languages.map(lang => `
      <div class="language-item">
        <div class="language-info">
          <span class="language-code">${lang.code}</span>
          <span>${lang.label}</span>
          ${lang.rtl ? '<span style="color: var(--accent); font-size: 12px;">RTL</span>' : ''}
        </div>
        <div class="actions">
          <button class="icon-btn" onclick="adminPanel.setDefaultLanguage('${lang.code}')" title="Set as default">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"/>
            </svg>
          </button>
          <button class="icon-btn" onclick="adminPanel.removeLanguage('${lang.code}')" title="Remove language">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  }


  private renderProviders(): void {
    const activeSelect = document.getElementById('active-provider') as HTMLSelectElement;
    if (this.config) activeSelect.value = this.config.activeProvider;
    const container = document.getElementById('providers-list');
    if (!container || !this.config) return;
    container.innerHTML = Object.entries(this.config.providers).map(([key, provider]) => `
      <div class="provider-item">
        <div class="provider-info">
          <strong>${provider.name}</strong>
          <span style="color: var(--text-secondary); font-size: 12px;">
            ${provider.model}
          </span>
        </div>
        <div class="actions">
          <button class="test-btn" onclick="adminPanel.testProvider('${key}')">
            Test
          </button>
        </div>
      </div>
    `).join('');
  }


  private setupEventListeners(): void {
    const activeSelect = document.getElementById('active-provider') as HTMLSelectElement;
    activeSelect.addEventListener('change', (e: Event) => {
      if (this.config) this.config.activeProvider = (e.target as HTMLSelectElement).value;
      this.saveConfig().catch(console.error);
    });
  }


  public async addLanguage(): Promise<void> {
    const codeInput = document.getElementById('new-lang-code') as HTMLInputElement;
    const labelInput = document.getElementById('new-lang-label') as HTMLInputElement;
    const code = codeInput.value.trim();
    const label = labelInput.value.trim();
    if (!code || !label) {
      this.showStatus('Please enter both code and label', 'error');
      return;
    }


    if (this.config && this.config.languages.find(lang => lang.code === code)) {
      this.showStatus('Language code already exists', 'error');
      return;
    }


    if (this.config) {
      this.config.languages.push({
        code,
        label,
        ttsVoice: null,
        rtl: ['ar', 'ur', 'he', 'fa'].includes(code)
      });
      await this.saveConfig();
      this.renderLanguages();
    }


    codeInput.value = '';
    labelInput.value = '';
  }


  public async removeLanguage(code: string): Promise<void> {
    if (this.config && this.config.languages.length <= 1) {
      this.showStatus('Cannot remove the last language', 'error');
      return;
    }


    if (this.config) {
      this.config.languages = this.config.languages.filter(lang => lang.code !== code);
      await this.saveConfig();
      this.renderLanguages();
    }
  }


  public async setDefaultLanguage(code: string): Promise<void> {
    if (this.config) {
      this.config.language = code;
      await this.saveConfig();
      this.showStatus(`Default language set to ${code}`, 'success');
    }
  }


  public async testProvider(providerKey: string | null = null): Promise<void> {
    const testInput = document.getElementById('test-input') as HTMLInputElement;
    const inputValue = testInput.value.trim();
    if (!inputValue) {
      this.showStatus('Please enter a test description', 'error');
      return;
    }


    const provider = providerKey || (this.config ? this.config.activeProvider : 'openai');
    const resultElement = document.getElementById('test-result');
    if (!resultElement) return;


    resultElement.classList.remove('hidden');
    resultElement.textContent = 'Testing provider...';
    resultElement.className = 'status';


    try {
      const elementData = {
        label: inputValue,
        type: 'text',
        placeholder: 'Test placeholder'
      };
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'getAIExplanation',
          elementData,
          language: this.config ? this.config.language : 'en'
        }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });


      resultElement.textContent = `✅ Success: ${(response as any).explanation}`;
      resultElement.className = 'status success';
    } catch (error: any) {
      resultElement.textContent = `❌ Error: ${error.message}`;
      resultElement.className = 'status error';
    }
  }


  private showStatus(message: string, type: 'success' | 'error'): void {
    let status = document.getElementById('status-message');
    if (!status) {
      status = document.createElement('div');
      status.id = 'status-message';
      status.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        max-width: 300px;
      `;
      document.body.appendChild(status);
    }


    status.textContent = message;
    status.style.background = type === 'success' ? 'var(--success)' : 'var(--danger)';
    status.style.color = 'white';


    setTimeout(() => {
      if (status) status.remove();
    }, 3000);
  }
}


const adminPanel = new AdminPanel();


function addLanguage() {
  adminPanel.addLanguage().catch(console.error);
}


function testProvider() {
  adminPanel.testProvider().catch(console.error);
}
