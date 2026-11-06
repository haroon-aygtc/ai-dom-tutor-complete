interface Provider {
  name: string;
  endpoint: string;
  model: string;
  apiKey: string;
  supportedLanguages: string[];
}


class AIProviderManager {
  private providers: Record<string, Provider> = {
    openai: {
      name: 'OpenAI',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo',
      apiKey: '',
      supportedLanguages: ['en', 'ar', 'hi', 'ur', 'es', 'fr', 'de'],
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
  };


  async getExplanation(elementData: any, language: string, providerConfig: Provider): Promise<string> {
    const prompt = this.buildPrompt(elementData, language);
    
    switch (providerConfig.name.toLowerCase()) {
      case 'openai':
      case 'groq':
        return await this.callOpenAIFormat(prompt, providerConfig);
      case 'google gemini':
        return await this.callGemini(prompt, providerConfig);
      case 'anthropic claude':
        return await this.callClaude(prompt, providerConfig);
      default:
        throw new Error(`Unsupported provider: ${providerConfig.name}`);
    }
  }


  private async callOpenAIFormat(prompt: string, provider: Provider): Promise<string> {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}` 
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.3
      })
    });


    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }


    const data = await response.json();
    return data.choices[0].message.content.trim();
  }


  private async callGemini(prompt: string, provider: Provider): Promise<string> {
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
          temperature: 0.3
        }
      })
    });


    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }


    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
  }


  private async callClaude(prompt: string, provider: Provider): Promise<string> {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 150,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }]
      })
    });


    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }


    const data = await response.json();
    return data.content[0].text.trim();
  }


  private buildPrompt(elementData: any, language: string): string {
    const basePrompts: Record<string, string> = {
      en: `Explain this web form element in simple, helpful terms: "${elementData.label}". 
          Type: ${elementData.type}. ${elementData.placeholder ? `Placeholder: "${elementData.placeholder}".` : ''}
          Provide a brief, clear explanation of what this field is for and how to fill it correctly.`,
      
      ar: `اشرح عنصر نموذج الويب هذا بعبارات بسيطة ومفيدة: "${elementData.label}".
          النوع: ${elementData.type}. ${elementData.placeholder ? `النص التوضيحي: "${elementData.placeholder}".` : ''}
          قدم شرحًا موجزًا وواضحًا عن الغرض من هذا الحقل وكيفية ملئه بشكل صحيح.`,
      
      hi: `इस वेब फॉर्म एलिमेंट को सरल, उपयोगी शब्दों में समझाएं: "${elementData.label}".
          प्रकार: ${elementData.type}. ${elementData.placeholder ? `प्लेसहोल्डर: "${elementData.placeholder}".` : ''}
          इस फ़ील्ड का उद्देश्य और इसे सही तरीके से कैसे भरना है, इसकी संक्षिप्त, स्पष्ट व्याख्या प्रदान करें।`,
      
      ur: `اس ویب فارم کے عنصر کو سادہ، مفید الفاظ میں سمجھائیں: "${elementData.label}".
          قسم: ${elementData.type}. ${elementData.placeholder ? `پلیس ہولڈر: "${elementData.placeholder}".` : ''}
          اس فیلڈ کا مقصد اور اسے صحیح طریقے سے کیسے بھرنا ہے, اس کی مختصر، واضح وضاحت فراہم کریں۔`
    };
    return basePrompts[language] || basePrompts.en;
  }
}
