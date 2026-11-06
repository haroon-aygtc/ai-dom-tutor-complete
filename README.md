# AI DOM Tutor - Complete Edition

A production-ready, multilingual AI-powered browser extension that provides intelligent tutoring for webpage elements with real-time guidance, voice assistance, and visual feedback.

## 🚀 Features

- **🤖 AI-Powered Explanations**: Supports OpenAI, Groq, and Google Gemini
- **🌍 Multilingual Support**: English, Arabic, Hindi, Urdu, Spanish, French, German
- **🔊 Voice Guidance**: Text-to-speech in multiple languages
- **💬 Visual Tooltips**: Contextual explanations with smart positioning
- **✨ Beautiful UI**: Modern dark theme with smooth animations
- **⚡ Real-time Detection**: Automatically detects interactive elements
- **🎯 Smart Highlighting**: Visual feedback with pulsing animations
- **⚙️ Easy Configuration**: Intuitive admin panel

## 📦 Installation

### Prerequisites
- Node.js 16+ and npm
- Chrome/Edge browser (Manifest V3 support)

### Setup Commands

```bash
# Clone or navigate to project directory
cd ai-dom-tutor-complete

# Install dependencies (already done)
npm install

# Build the extension
npm run build

# For development with auto-rebuild
npm run dev
```

### Load in Browser

1. Open Chrome/Edge
2. Navigate to `chrome://extensions/` (or `edge://extensions/`)
3. Enable **"Developer mode"** (toggle in top-right)
4. Click **"Load unpacked"**
5. Select the `dist` folder from this project
6. Extension is now installed! 🎉

## ⚙️ Configuration

### 1. Get API Keys

Choose one of these AI providers:

- **Groq** (Recommended - Free & Fast): [console.groq.com/keys](https://console.groq.com/keys)
- **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Google Gemini**: [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)

### 2. Configure Extension

1. Click the extension icon in Chrome toolbar
2. Go to **"🤖 AI Providers"** tab
3. Select your preferred provider
4. Click **"Configure"** and enter your API key
5. Click **"🧪 Run Test"** to verify it works

### 3. Customize Settings

- **Languages**: Add/remove languages in the Languages tab
- **Voice**: Toggle text-to-speech on/off
- **Tooltips**: Enable/disable visual explanations

## 🎯 How to Use

### Activate the Tutor

1. Visit any website with forms (e.g., login pages, contact forms)
2. Look for the **purple floating button** in the bottom-right corner
3. Click the button to see language options
4. Select your preferred language (button turns green when active)

### Get AI Guidance

1. Focus on any form element (input, button, select, textarea)
2. You'll receive:
   - 🔵 **Visual highlight** with pulsing animation
   - 💬 **Tooltip explanation** positioned smartly
   - 🔊 **Voice guidance** in your selected language

### Supported Elements

- Text inputs (email, password, search, etc.)
- Buttons and links
- Select dropdowns
- Textareas
- Any element with `tabindex` or interactive roles

## 🏗️ Technical Architecture

### Project Structure

```
ai-dom-tutor-complete/
├── src/
│   ├── background.ts      # Service worker for AI API calls
│   ├── content.ts         # DOM interaction and UI injection
│   ├── popup.ts          # Admin panel logic
│   └── types.ts          # TypeScript interfaces
├── public/
│   ├── manifest.json     # Extension manifest
│   ├── popup.html        # Admin panel UI
│   ├── popup.css         # Admin panel styles
│   ├── content.css       # Injected page styles
│   └── icons/            # Extension icons
├── dist/                 # Built extension (generated)
├── webpack.config.js     # Build configuration
└── tsconfig.json         # TypeScript configuration
```

### Key Technologies

- **TypeScript**: Type-safe development
- **Webpack**: Module bundling and optimization
- **Manifest V3**: Modern Chrome extension API
- **Web Speech API**: Text-to-speech functionality
- **Chrome Storage API**: Secure configuration storage

## 🌐 Supported Languages

| Language | Code | Voice Support | RTL Support |
|----------|------|---------------|-------------|
| English  | en   | ✅            | -           |
| Arabic   | ar   | ✅            | ✅          |
| Hindi    | hi   | ✅            | -           |
| Urdu     | ur   | ✅            | ✅          |
| Spanish  | es   | ✅            | -           |
| French   | fr   | ✅            | -           |
| German   | de   | ✅            | -           |

*Additional languages can be added through the admin panel*

## 🔧 Development

### Build Commands

```bash
# Production build
npm run build

# Development build with watch mode
npm run dev

# Clean build directory
npm run clean
```

### Adding New AI Providers

Edit `src/background.ts` and add provider configuration:

```typescript
providers: {
  newProvider: {
    name: 'New Provider',
    endpoint: 'https://api.example.com/v1/chat',
    model: 'model-name',
    apiKey: '',
    supportedLanguages: ['en', 'ar', 'hi', 'ur']
  }
}
```

### Adding New Languages

1. Open extension settings
2. Go to "🌍 Languages" tab
3. Enter language code and label
4. Click "Add"

## 🔒 Security & Privacy

- **API Keys**: Stored securely in Chrome's encrypted sync storage
- **No Data Collection**: Extension doesn't collect personal information
- **Local Processing**: Element analysis happens locally
- **HTTPS Only**: All API communications are encrypted
- **Minimal Permissions**: Only requests necessary browser permissions

## 🎨 Customization

### Styling

Modify `public/content.css` to customize:
- Button appearance and position
- Tooltip styling and animations
- Highlight colors and effects
- Language dropdown design

### Behavior

Edit `src/content.ts` to adjust:
- Element detection logic
- Tooltip positioning
- Voice settings
- Animation timing

## 🐛 Troubleshooting

### Extension Not Loading
- Ensure you selected the `dist` folder, not project root
- Check that build completed successfully (`npm run build`)
- Verify Developer mode is enabled in Chrome

### No Floating Button
- Refresh the webpage (F5)
- Check if page allows extensions (won't work on chrome:// pages)
- Try on a different website (e.g., google.com)

### API Errors
- Verify API key is correct and has sufficient credits
- Check internet connection
- Try a different AI provider
- Look at browser console (F12) for detailed errors

### Voice Not Working
- Ensure browser supports Web Speech API
- Check system volume and browser permissions
- Try different language or voice settings
- Some browsers require user interaction before speech

## 📊 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | 88+     | ✅ Fully supported |
| Edge    | 88+     | ✅ Fully supported |
| Brave   | Latest  | ✅ Fully supported |
| Opera   | Latest  | ✅ Fully supported |
| Firefox | -       | ❌ Manifest V3 required |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use and modify for your projects.

## 🆘 Support

For issues, questions, or feature requests:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Verify API provider status and quotas
4. Test with different websites and languages

---

**Built with ❤️ for accessible web experiences**