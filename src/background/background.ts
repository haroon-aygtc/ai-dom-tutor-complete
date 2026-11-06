import type { Runtime } from 'chrome';


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


class BackgroundService {
  private config: Config = {
    activeProvider: 'openai',
    language: 'en',
    providers: {},
    languages: [],
  };


  constructor() {
    this.init().catch((error) => console.error('Background init error:', error));
  }


  private async init(): Promise<void> {
    await this.loadConfig();
    this.setupMessageHandlers();
  }


  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['config']);
      if (result.config) {
        this.config = { ...this.config, ...result.config as Config };
      } else {
        await this.setDefaultConfig();
      }
    } catch (error) {
      console.error('Load config error:', error);
      await this.setDefaultConfig();
    }
  }


  private async setDefaultConfig(): Promise<void> {
    this.config = {
      activeProvider: 'openai',
      language: 'en',
      providers: {
        openai: {
          name: 'OpenAI',
          endpoint: 'https://api.openai.com/v1/chat/completions',
          model: 'gpt-3.5-turbo',
          apiKey: '',
          supportedLanguages: ['en', 'ar', 'hi', 'ur'],
        },
        gemini: {
          name: 'Google Gemini',
          endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
          model: 'gemini-pro',
          apiKey: '',
          supportedLanguages: ['en', 'ar', 'hi', 'ur', 'es', 'fr', 'de', 'ja', 'ko'],
        },
        claude: {
          name: 'Anthropic Claude',
          endpoint: 'https://api.anthropic.com/v1/messages',
          model: 'claude-3-sonnet-20240229',
          apiKey: '',
          supportedLanguages: ['en', 'ar', 'hi', 'ur', 'es', 'fr', 'de'],
        },
        groq: {
          name: 'Groq',
          endpoint: 'https://api.groq.com/openai/v1/chat/completions',
          model: 'llama2-70b-4096',
          apiKey: '',
          supportedLanguages: ['en', 'ar', 'hi', 'ur', 'es', 'fr', 'de'],
        },
      },
      languages: [
        { code: 'en', label: 'English', ttsVoice: null, rtl: false },
        { code: 'ar', label: 'Arabic', ttsVoice: null, rtl: true },
        { code: 'hi', label: 'Hindi', ttsVoice: null, rtl: false },
        { code: 'ur', label: 'Urdu', ttsVoice: null, rtl: true },
      ],
    };
    await this.saveConfig();
  }


  private async saveConfig(): Promise<void> {
    try {
      await chrome.storage.sync.set({ config: this.config });
    } catch (error) {
      console.error('Save config error:', error);
    }
  }


  private setupMessageHandlers(): void {
    chrome.runtime.onMessage.addListener(
      (request: any, sender: Runtime.MessageSender, sendResponse: (response: any) => void) => {
        switch (request.action) {
          case 'getConfig':
            sendResponse(this.config);
            break;
          case 'updateConfig':
            this.config = { ...this.config, ...request.config };
            this.saveConfig()
              .then(() => sendResponse({ success: true }))
              .catch(() => sendResponse({ success: false }));
            return true;
          case 'getAIExplanation':
            this.getAIExplanation(request.elementData, request.language)
              .then((explanation) => sendResponse({ explanation }))
              .catch((error) => sendResponse({ error: error.message }));
            return true;
          default:
            sendResponse({ error: 'Unknown action' });
        }
      }
    );
  }


  private async getAIExplanation(elementData: any, language: string): Promise<string> {
    const provider = this.config.providers[this.config.activeProvider];
    if (!provider?.apiKey) {
      throw new Error('AI provider not configured');
    }


    const prompt = this.buildPrompt(elementData, language);


    try {
      const response = await fetch(provider.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.3,
        }),
      });


      if (!response.ok) {
        throw new Error(`AI API error: ${response.statusText}`);
      }


      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('AI explanation error:', error);
      throw error;
    }
  }


  private buildPrompt(elementData: any, language: string): string {
    const prompts: Record<string, string> = {
      en: `Explain this form element in simple terms: ${elementData.label}. Type: ${elementData.type}. Provide brief, helpful instructions.`,
      ar: `اشرح عنصر النموذج هذا بعبارات بسيطة: ${elementData.label}. النوع: ${elementData.type}. قدم تعليمات موجزة ومفيدة.`,
      hi: `इस फॉर्म एलिमेंट को सरल शब्दों में समझाएं: ${elementData.label}. प्रकार: ${elementData.type}. संक्षिप्त, उपयोगी निर्देश प्रदान करें।`,
      ur: `اس فارم کے عنصر کو آسان الفاظ میں سمجھائیں: ${elementData.label}. قسم: ${elementData.type}. مختصر، مفید ہدایات فراہم کریں۔`,
    };
    return prompts[language] || prompts.en;
  }
}


new BackgroundService();
