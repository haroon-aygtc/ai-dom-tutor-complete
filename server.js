const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const ReqSchema = {
  messages: [],
  lang: 'en',
  model: 'gpt-5-mini'
};

const SAFE_MODE = process.env.SAFE_MODE === '1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

function langPreamble(lang){
  const map = {
    en: 'Respond only in English.',
    ur: 'براہ کرم صرف اردو میں جواب دیں۔',
    hi: 'कृपया केवल हिंदी में उत्तर दें।',
    fil: 'Mangyaring sumagot lamang sa Filipino.'
  };
  return map[lang] || map.en;
}

app.post('/api/chat', async (req, res) => {
  const { messages, lang, model } = req.body;

  if (SAFE_MODE && !OPENAI_API_KEY) {
    const last = messages.filter(m => m.role === 'user').pop().content || '';
    return res.json({ text: `[${lang}] ${last}` });
  }
  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'provider_not_configured', message: 'Missing OPENAI_API_KEY' });

  try {
    const sys = { role: 'system', content: `${langPreamble(lang)} Be concise and helpful.` };
    const payload = { model: model || OPENAI_MODEL, messages: [sys, ...messages.map(m => ({ role: m.role, content: m.content }))] };
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const err = await r.json().catch(()=>({}));
      return res.status(502).json({ error: 'openai_error', details: err });
    }
    const data = await r.json();
    const text = data.choices[0].message.content;
    if (!text) return res.status(502).json({ error: 'openai_empty' });
    return res.json({ text });
  } catch (e) {
    return res.status(500).json({ error: 'provider_error', message: e.message || String(e) });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
