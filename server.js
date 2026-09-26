const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const ADMIN_PWD = process.env.ADMIN_PWD || 'levieux2026';

const GROQ_MODEL = 'openai/gpt-oss-20b';
const DB_FILE = path.join(__dirname, 'subscribers.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {}
  return { subscribers: {}, freeUsers: {} };
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Erreur sauvegarde DB :', e.message);
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'La Voix des Anciens Backend',
    version: '3.0.0',
    ai_provider: 'Groq',
    ai_model: GROQ_MODEL,
    groq_key_set: !!GROQ_API_KEY && GROQ_API_KEY.length > 10
  });
});

function convertHistoryForAI(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(msg => msg && msg.content)
    .map(msg => {
      let role = 'user';
      const msgRole = (msg.role || '').toLowerCase();
      if (msgRole === 'user') role = 'user';
      else if (msgRole === 'elder' || msgRole === 'assistant' || msgRole === 'system') role = 'assistant';
      return { role, content: String(msg.content).trim() };
    })
    .filter(msg => msg.content.length > 0);
}

async function callGroq(messages, maxTokens = 400, temperature = 0.85) {
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + GROQ_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens
      })
    });

    if (response.status === 429) {
      attempt++;
      if (attempt < maxAttempts) {
        const wait = attempt * 1500;
        console.log('⏳ Rate limit Groq, attente ' + wait + 'ms');
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
    }

    return response;
  }
  return null;
}

app.post('/check-access', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];

  if (!sub) {
    return res.json({ active: false, reason: 'not_subscribed' });
  }

  const now = Date.now();
  if (now > sub.expiryDate) {
    return res.json({ active: false, reason: 'expired', expiryDate: sub.expiryDate });
  }

  const daysLeft = Math.ceil((sub.expiryDate - now) / 86400000);
  return res.json({
    active: true,
    email: key,
    expiryDate: sub.expiryDate,
    daysLeft: daysLeft,
    plan: sub.plan || 'monthly'
  });
});

app.post('/webhook/chariow', (req, res) => {
  const event = req.body;
  console.log('📩 Webhook Chariow :', JSON.stringify(event));

  if (!event || typeof event !== 'object') {
    return res.status(400).json({ error: 'JSON invalide' });
  }

  const eventType = event.event || event.type || event.event_type || '';
  const customerEmail = (
    (event.customer && event.customer.email) ||
    (event.data && event.data.customer && event.data.customer.email) ||
    event.email ||
    (event.data && event.data.email) ||
    ''
  ).toLowerCase().trim();

  if (!customerEmail) {
    return res.json({ received: true, warning: 'no_email' });
  }

  const db = loadDB();

  if (eventType.includes('sale') || eventType.includes('purchase') || eventType.includes('successful') || !eventType) {
    const now = Date.now();
    const currentExpiry = (db.subscribers[customerEmail] && db.subscribers[customerEmail].expiryDate) || 0;
    const baseDate = Math.max(currentExpiry, now);
    const newExpiry = baseDate + (30 * 24 * 60 * 60 * 1000);

    db.subscribers[customerEmail] = {
      email: customerEmail,
      startDate: now,
      expiryDate: newExpiry,
      plan: 'monthly',
      updatedAt: now
    };
    saveDB(db);
    console.log('✅ Abonnement activé : ' + customerEmail);
    return res.json({ received: true, action: 'activated', email: customerEmail, expiryDate: newExpiry });
  }

  if (eventType.includes('expired')) {
    if (db.subscribers[customerEmail]) {
      db.subscribers[customerEmail].lastEvent = 'expired';
      saveDB(db);
    }
    return res.json({ received: true, action: 'expired' });
  }

  return res.json({ received: true, action: 'ignored' });
});

app.post('/ask', async (req, res) => {
  const { email, question, history } = req.body || {};

  if (!email || !question) {
    return res.status(400).json({ error: 'Email et question requis' });
  }

  if (!GROQ_API_KEY || GROQ_API_KEY.length < 10) {
    console.error('❌ Clé Groq manquante');
    return res.status(500).json({ error: 'config_error', message: 'Clé API manquante.' });
  }

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];
  const now = Date.now();
  const FREE_LIMIT = 3;

  let isFree = false;
  if (!sub || now > sub.expiryDate) {
    if (!db.freeUsers[key]) db.freeUsers[key] = { count: 0 };
    if (db.freeUsers[key].count >= FREE_LIMIT) {
      return res.status(402).json({
        error: 'quota_exceeded',
        message: 'Vos 3 questions gratuites sont épuisées.',
        freeUsed: db.freeUsers[key].count,
        freeLimit: FREE_LIMIT
      });
    }
    db.freeUsers[key].count++;
    saveDB(db);
    isFree = true;
  }

  try {
    const systemPrompt = `Tu es "Le Vieux", un sage africain de 70 ans, assis sous un arbre géant.
Tu réponds avec bienveillance, sagesse, et un ton direct et chaleureux.
Tu tutoies toujours ton interlocuteur.
Tu puises dans la sagesse ancestrale africaine, la spiritualité universelle, la philosophie et l'expérience de la vie.
Tu ne donnes jamais de conseils médicaux, juridiques ou dangereux.
Tu réponds en français simple, compréhensible par tous, en 3 à 6 phrases maximum, avec une image ou une métaphore.
Tu ne mentionnes jamais que tu es une IA. Tu es Le Vieux, point.`;

    const convertedHistory = convertHistoryForAI(history || []).slice(-6);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...convertedHistory,
      { role: 'user', content: String(question).trim() }
    ];

    console.log('📤 Envoi à Groq (' + messages.length + ' messages)');

    const response = await callGroq(messages, 400, 0.85);

    if (!response || !response.ok) {
      const errText = response ? await response.text() : 'No response';
      console.error('❌ Erreur Groq :', errText);
      return res.status(500).json({ error: 'ai_error', message: 'Le Vieux est fatigué.' });
    }

    const data = await response.json();
    const answer = data.choices && data.choices[0] && data.choices[0].message.content;

    if (!answer) {
      return res.status(500).json({ error: 'no_answer' });
    }

    console.log('✅ Réponse Groq (' + answer.length + ' caractères)');

    return res.json({
      answer: answer.trim(),
      isFree: isFree,
      freeRemaining: isFree ? Math.max(0, FREE_LIMIT - db.freeUsers[key].count) : null
    });

  } catch (e) {
    console.error('❌ Erreur serveur :', e.message);
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
});

app.post('/daily', async (req, res) => {
  const { email, type } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];
  if (!sub || Date.now() > sub.expiryDate) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

  const prompt = type === 'evening'
    ? `Tu es Le Vieux. Donne un rituel du soir pour aujourd'hui (jour ${dayOfYear}). Format : une pensée courte (2 phrases), une question à méditer (1 phrase), un exercice simple (1 phrase). Français simple, ton sage, tutoiement.`
    : `Tu es Le Vieux. Donne le proverbe du matin (jour ${dayOfYear}). Format : un proverbe africain authentique, son explication (2 phrases), son application moderne (2 phrases). Français simple, ton sage.`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], 300, 0.9);
    if (!response || !response.ok) return res.status(500).json({ error: 'ai_error' });
    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message.content;
    return res.json({ content: content ? content.trim() : '' });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

app.post('/teaching', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];
  if (!sub || Date.now() > sub.expiryDate) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const prompt = `Tu es Le Vieux. Enseignement de la semaine (semaine ${weekNumber}). Format : titre (une vertu), introduction (3 phrases), 3 leçons numérotées, conclusion (2 phrases). Français simple, ton sage, tutoiement.`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], 500, 0.9);
    if (!response || !response.ok) return res.status(500).json({ error: 'ai_error' });
    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message.content;
    return res.json({ content: content ? content.trim() : '' });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

app.post('/challenge', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];
  if (!sub || Date.now() > sub.expiryDate) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const cycleNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const prompt = `Tu es Le Vieux. Défi de 7 jours (cycle ${cycleNumber}). Format : titre, introduction (1 phrase), Jour 1 à Jour 7 (une action concrète chacun, 1 phrase). Français simple, ton sage, tutoiement.`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], 400, 0.9);
    if (!response || !response.ok) return res.status(500).json({ error: 'ai_error' });
    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message.content;
    return res.json({ content: content ? content.trim() : '' });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

app.post('/library', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];
  if (!sub || Date.now() > sub.expiryDate) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const dayNumber = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const prompt = `Tu es Le Vieux. Conte africain authentique pour aujourd'hui (jour ${dayNumber}). Format : titre, conte (8-12 phrases), morale (2 phrases). Français simple, ton chaleureux de conteur.`;

  try {
    const response = await callGroq([{ role: 'user', content: prompt }], 600, 0.95);
    if (!response || !response.ok) return res.status(500).json({ error: 'ai_error' });
    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message.content;
    return res.json({ content: content ? content.trim() : '' });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

app.get('/admin/stats', (req, res) => {
  const pwd = req.query.pwd;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'unauthorized' });

  const db = loadDB();
  const now = Date.now();
  const actives = [];
  const expired = [];

  Object.values(db.subscribers).forEach(s => {
    if (!s.email) return;
    if (s.expiryDate > now) {
      actives.push({
        email: s.email,
        expiry: new Date(s.expiryDate).toLocaleDateString('fr-FR'),
        daysLeft: Math.ceil((s.expiryDate - now) / 86400000)
      });
    } else {
      expired.push({
        email: s.email,
        expiredSince: new Date(s.expiryDate).toLocaleDateString('fr-FR')
      });
    }
  });

  res.json({
    totalActive: actives.length,
    totalExpired: expired.length,
    totalFreeUsers: Object.keys(db.freeUsers).length,
    actives,
    expired
  });
});

app.listen(PORT, () => {
  console.log('🌳 La Voix des Anciens backend (Groq) sur port ' + PORT);
  console.log('📊 Admin : /admin/stats?pwd=' + ADMIN_PWD);
  console.log('🔑 Clé Groq : ' + (GROQ_API_KEY ? '✓ configurée' : '❌ MANQUANTE'));
  console.log('🤖 Modèle : ' + GROQ_MODEL);
});
