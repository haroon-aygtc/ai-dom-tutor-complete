import { Config, ElementData, Message, MessageResponse, AIProvider } from './types';

class BackgroundService {
  private config: Config = {
    activeProvider: 'groq',
    language: 'en',
    isActive: false,
    voiceEnabled: true,
    tooltipEnabled: true,
    providers: {},
    languages: []
  };

  constructor() {
    console.log('[Background] AI DOM Tutor service starting...');
    this.init();
  }

  private async init(): Promise<void> {
    console.log('[Background] Initializing service...');
    await this.loadConfig();
    this.setupMessageHandlers();
    console.log('[Background] Service ready! Active provider:', this.config.activeProvider);
  }

  private async loadConfig(): Promise<void> {
    console.log('[Background] Loading configuration...');
    const result = await chrome.storage.sync.get(['config']);
    
    if (result.config) {
      this.config = { ...this.config, ...result.config };
      console.log('[Background] Configuration loaded from storage');
    } else {
      console.log('[Background] No configuration found, creating defaults...');
      await this.setDefaultConfig();
    }
  }

  private async setDefaultConfig(): Promise<void> {
    this.config = {
      activeProvider: 'groq',
      language: 'en',
      isActive: false,
      voiceEnabled: true,
      tooltipEnabled: true,
      providers: {
        openai: {
          name: 'OpenAI',
          endpoint: 'https://api.openai.com/v1/chat/completions',
          model: 'gpt-4o-mini',
          apiKey: '',
          supportedLanguages: ['en', 'ar', 'hi', 'ur', 'es', 'fr', 'de']
        },
        groq: {
          name: 'Groq',
          endpoint: 'https://api.groq.com/openai/v1/chat/completions',
          model: 'llama-3.1-8b-instant',
          apiKey: '',
          supportedLanguages: ['en', 'ar', 'hi', 'ur', 'es', 'fr', 'de']
        },
        gemini: {
          name: 'Google Gemini',
          endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
          model: 'gemini-1.5-flash',
          apiKey: '',
          supportedLanguages: ['en', 'ar', 'hi', 'ur', 'es', 'fr', 'de', 'ja', 'ko']
        }
      },
      languages: [
        { code: 'en', label: 'English', ttsVoice: 'en-US', rtl: false },
        { code: 'ar', label: 'العربية', ttsVoice: 'ar-SA', rtl: true },
        { code: 'hi', label: 'हिन्दी', ttsVoice: 'hi-IN', rtl: false },
        { code: 'ur', label: 'اردو', ttsVoice: 'ur-PK', rtl: true },
        { code: 'es', label: 'Español', ttsVoice: 'es-ES', rtl: false },
        { code: 'fr', label: 'Français', ttsVoice: 'fr-FR', rtl: false },
        { code: 'de', label: 'Deutsch', ttsVoice: 'de-DE', rtl: false }
      ]
    };
    await this.saveConfig();
  }

  private async saveConfig(): Promise<void> {
    await chrome.storage.sync.set({ config: this.config });
    console.log('[Background] Configuration saved');
  }

  private setupMessageHandlers(): void {
    console.log('[Background] Setting up message handlers...');
    
    chrome.runtime.onMessage.addListener(
      (request: Message, sender, sendResponse: (response: MessageResponse) => void) => {
        console.log('[Background] Message received:', request.action);
        
        switch (request.action) {
          case 'getConfig':
            console.log('[Background] Sending config to content script');
            sendResponse({ config: this.config });
            break;
            
          case 'updateConfig':
            console.log('[Background] Updating configuration...');
            this.config = { ...this.config, ...request.config };
            this.saveConfig().then(() => {
              console.log('[Background] Configuration updated successfully');
              sendResponse({ success: true });
            });
            return true;
            
          case 'getAIExplanation':
            if (request.elementData && request.language) {
              console.log('[Background] Processing AI explanation request...');
              this.getAIExplanation(request.elementData, request.language)
                .then(explanation => {
                  console.log('[Background] AI explanation generated successfully');
                  sendResponse({ explanation });
                })
                .catch(error => {
                  console.error('[Background] AI explanation failed:', error);
                  sendResponse({ error: error.message });
                });
              return true;
            }
            break;
            
          default:
            console.warn('[Background] Unknown action:', request.action);
        }
        return false;
      }
    );
  }

  private async getAIExplanation(elementData: ElementData, language: string): Promise<string> {
    const provider = this.config.providers[this.config.activeProvider];
    
    if (!provider?.apiKey) {
      throw new Error('AI provider not configured. Please add API key in extension settings.');
    }

    console.log('[Background] Using provider:', provider.name, 'for language:', language);
    
    const prompt = this.buildPrompt(elementData, language);
    console.log('[Background] Generated prompt preview:', prompt.substring(0, 100) + '...');
    
    if (provider.name === 'Google Gemini') {
      return await this.callGemini(prompt, provider, language);
    } else {
      return await this.callOpenAIFormat(prompt, provider, language);
    }
  }

  private async callOpenAIFormat(prompt: string, provider: AIProvider, language: string): Promise<string> {
    console.log('[Background] Making API call to:', provider.name);
    
    const languageInstructions: Record<string, string> = {
      en: 'You are a helpful web form assistant. Respond ONLY in English with clear, brief explanations.',
      ar: 'أنت مساعد نماذج ويب مفيد. يجب أن ترد فقط باللغة العربية. قدم شرحاً واضحاً وموجزاً.',
      hi: 'आप एक सहायक वेब फॉर्म सहायक हैं। केवल हिंदी में स्पष्ट, संक्षिप्त उत्तर दें।',
      ur: 'آپ ایک مددگار ویب فارم اسسٹنٹ ہیں۔ صرف اردو میں واضح، مختصر جواب دیں۔',
      es: 'Eres un asistente útil de formularios web. Responde SOLO en español con explicaciones claras y breves.',
      fr: 'Vous êtes un assistant utile pour les formulaires web. Répondez UNIQUEMENT en français avec des explications claires et brèves.',
      de: 'Sie sind ein hilfreicher Web-Formular-Assistent. Antworten Sie NUR auf Deutsch mit klaren, kurzen Erklärungen.'
    };

    const requestBody = {
      model: provider.model,
      messages: [
        {
          role: 'system',
          content: languageInstructions[language] || languageInstructions.en
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    };

    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey.trim()}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Background] API Error:', response.status, errorText);
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    console.log('[Background] ✅ API Success - Response length:', content.length);
    return content;
  }

  private async callGemini(prompt: string, provider: AIProvider, language: string): Promise<string> {
    console.log('[Background] Making Gemini API call...');
    
    const response = await fetch(`${provider.endpoint}?key=${provider.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
  }

  private buildPrompt(elementData: ElementData, language: string): string {
    const prompts: Record<string, string> = {
      en: `Explain this form element: "${elementData.label}" (Type: ${elementData.type}). Give clear, helpful instructions in 1-2 sentences in English only.`,
      ar: `اشرح عنصر النموذج هذا: "${elementData.label}" (النوع: ${elementData.type}). قدم تعليمات واضحة ومفيدة في جملة أو جملتين بالعربية فقط.`,
      hi: `इस फॉर्म एलिमेंट को समझाएं: "${elementData.label}" (प्रकार: ${elementData.type}). केवल हिंदी में 1-2 वाक्यों में स्पष्ट, उपयोगी निर्देश दें।`,
      ur: `اس فارم کے عنصر کو سمجھائیں: "${elementData.label}" (قسم: ${elementData.type}). صرف اردو میں 1-2 جملوں میں واضح، مفید ہدایات دیں۔`,
      es: `Explica este elemento de formulario: "${elementData.label}" (Tipo: ${elementData.type}). Da instrucciones claras y útiles en 1-2 oraciones solo en español.`,
      fr: `Expliquez cet élément de formulaire: "${elementData.label}" (Type: ${elementData.type}). Donnez des instructions claires et utiles en 1-2 phrases en français uniquement.`,
      de: `Erklären Sie dieses Formularelement: "${elementData.label}" (Typ: ${elementData.type}). Geben Sie klare, hilfreiche Anweisungen in 1-2 Sätzen nur auf Deutsch.`
    };

    return prompts[language] || prompts.en;
  }
}

// Initialize the background service
new BackgroundService();