const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ⚠️ CES VALEURS SERONT DANS RAILWAY (variables d'environnement)
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || 'TA_CLE_MISTRAL_ICI';
const CHARIOW_WEBHOOK_SECRET = process.env.CHARIOW_WEBHOOK_SECRET || 'whsec_TA_CLE_CHARIOW';
const ADMIN_PWD = process.env.ADMIN_PWD || 'levieux2026';

const DB_FILE = path.join(__dirname, 'subscribers.json');

// ══════════════════════════════════════════════════════════════════
// BASE DE DONNÉES SIMPLE (fichier JSON)
// ══════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════════════════════════════
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ══════════════════════════════════════════════════════════════════
// ROUTE DE TEST
// ══════════════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Le Vieux Backend', version: '1.0.0' });
});

// ══════════════════════════════════════════════════════════════════
// VÉRIFICATION D'ACCÈS
// ══════════════════════════════════════════════════════════════════
app.post('/check-access', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];

  if (!sub) {
    return res.json({
      active: false,
      reason: 'not_subscribed',
      message: 'Aucun abonnement trouvé'
    });
  }

  const now = Date.now();
  if (now > sub.expiryDate) {
    return res.json({
      active: false,
      reason: 'expired',
      message: 'Abonnement expiré',
      expiryDate: sub.expiryDate
    });
  }

  const daysLeft = Math.ceil((sub.expiryDate - now) / (1000 * 60 * 60 * 24));
  return res.json({
    active: true,
    email: key,
    expiryDate: sub.expiryDate,
    daysLeft: daysLeft,
    plan: sub.plan || 'monthly'
  });
});

// ══════════════════════════════════════════════════════════════════
// WEBHOOK CHARIOW
// ══════════════════════════════════════════════════════════════════
app.post('/webhook/chariow', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-chariow-signature'] || req.headers['x-signature'];
  const rawBody = req.body;

  // Vérification signature (si configurée)
  if (CHARIOW_WEBHOOK_SECRET && !CHARIOW_WEBHOOK_SECRET.includes('TA_CLE') && signature) {
    try {
      const expected = crypto
        .createHmac('sha256', CHARIOW_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
      const received = String(signature).replace('sha256=', '');
      if (expected !== received) {
        console.warn('⚠️ Signature invalide');
        return res.status(401).json({ error: 'Signature invalide' });
      }
    } catch (e) {
      console.warn('Erreur vérif signature :', e.message);
    }
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch (e) {
    return res.status(400).json({ error: 'JSON invalide' });
  }

  console.log('📩 Webhook Chariow :', JSON.stringify(event, null, 2));

  const eventType = event.event || event.type || event.event_type || '';
  const customerEmail = (
    (event.customer && event.customer.email) ||
    (event.data && event.data.customer && event.data.customer.email) ||
    event.email ||
    (event.data && event.data.email) ||
    ''
  ).toLowerCase().trim();

  if (!customerEmail) {
    console.warn('⚠️ Pas d\'email');
    return res.json({ received: true, warning: 'no_email' });
  }

  const db = loadDB();

  // VENTE RÉUSSIE → +30 JOURS
  if (eventType.includes('sale') || eventType.includes('purchase') || eventType.includes('successful')) {
    const now = Date.now();
    const currentExpiry = (db.subscribers[customerEmail] && db.subscribers[customerEmail].expiryDate) || 0;
    const baseDate = Math.max(currentExpiry, now);
    const newExpiry = baseDate + (30 * 24 * 60 * 60 * 1000);

    db.subscribers[customerEmail] = {
      email: customerEmail,
      startDate: now,
      expiryDate: newExpiry,
      plan: 'monthly',
      lastEvent: eventType,
      updatedAt: now
    };
    saveDB(db);
    console.log('✅ Abonnement activé : ' + customerEmail + ' jusqu\'au ' + new Date(newExpiry).toLocaleDateString('fr-FR'));
    return res.json({ received: true, action: 'activated', expiryDate: newExpiry });
  }

  // EXPIRATION
  if (eventType.includes('expired') || eventType.includes('expiry')) {
    if (db.subscribers[customerEmail]) {
      db.subscribers[customerEmail].lastEvent = 'expired';
      db.subscribers[customerEmail].updatedAt = Date.now();
      saveDB(db);
    }
    console.log('⏰ Expiré : ' + customerEmail);
    return res.json({ received: true, action: 'expired' });
  }

  return res.json({ received: true, action: 'ignored', eventType });
});

// ══════════════════════════════════════════════════════════════════
// CHAT AVEC LE VIEUX (API Mistral)
// ══════════════════════════════════════════════════════════════════
app.post('/ask', async (req, res) => {
  const { email, question, history } = req.body;

  if (!email || !question) {
    return res.status(400).json({ error: 'Email et question requis' });
  }

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];
  const now = Date.now();
  const FREE_LIMIT = 3;

  // Vérifier accès
  let isFree = false;
  if (!sub || now > sub.expiryDate) {
    // Utilisateur gratuit
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

  // Appel Mistral
  try {
    const systemPrompt = `Tu es "Le Vieux", un sage africain de 70 ans, assis sous un arbre géant.
Tu réponds avec bienveillance, sagesse, et un ton direct et chaleureux.
Tu tutoies toujours ton interlocuteur.
Tu puises dans la sagesse ancestrale africaine, la spiritualité universelle, la philosophie et l'expérience de la vie.
Tu ne donnes jamais de conseils médicaux, juridiques ou dangereux.
Tu réponds en français, en 3 à 6 phrases maximum, avec une image ou une métaphore.
Tu ne mentionnes jamais que tu es une IA. Tu es Le Vieux, point.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...((history || []).slice(-6)),
      { role: 'user', content: question }
    ];

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MISTRAL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: messages,
        temperature: 0.85,
        max_tokens: 400
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Erreur Mistral :', err);
      return res.status(500).json({ error: 'ai_error', message: 'Le Vieux est fatigué, réessaie.' });
    }

    const data = await response.json();
    const answer = data.choices && data.choices[0] && data.choices[0].message.content;

    if (!answer) return res.status(500).json({ error: 'no_answer' });

    return res.json({
      answer: answer.trim(),
      isFree: isFree,
      freeRemaining: isFree ? (FREE_LIMIT - db.freeUsers[key].count) : null
    });

  } catch (e) {
    console.error('Erreur serveur :', e.message);
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// CONTENU QUOTIDIEN (proverbe + rituel)
// ══════════════════════════════════════════════════════════════════
app.post('/daily', async (req, res) => {
  const { email, type } = req.body; // type: 'morning' | 'evening'
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];
  const isActive = sub && Date.now() < sub.expiryDate;

  if (!isActive) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

  const prompt = type === 'evening'
    ? `Tu es Le Vieux. Donne un rituel du soir pour aujourd'hui (jour ${dayOfYear} de l'année). Format : une pensée courte (2 phrases), une question à méditer (1 phrase), un exercice simple (1 phrase). Réponds en français, ton sage et tutoiement.`
    : `Tu es Le Vieux. Donne le proverbe du matin pour aujourd'hui (jour ${dayOfYear}). Format : un proverbe africain authentique, son explication (2 phrases), son application dans la vie moderne (2 phrases). Réponds en français, ton sage.`;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MISTRAL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 300
      })
    });

    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message.content;
    return res.json({ content: content ? content.trim() : '' });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// ENSEIGNEMENT HEBDO
// ══════════════════════════════════════════════════════════════════
app.post('/teaching', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];
  if (!sub || Date.now() > sub.expiryDate) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));

  const prompt = `Tu es Le Vieux. Donne l'enseignement de la semaine (semaine ${weekNumber}).
Format :
- Titre de l'enseignement (une vertu ou un thème : patience, courage, pardon, humilité, etc.)
- Une introduction (3 phrases)
- 3 leçons pratiques numérotées
- Une conclusion inspirante (2 phrases)
Réponds en français, ton sage et bienveillant, tutoiement.`;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MISTRAL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 500
      })
    });
    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message.content;
    return res.json({ content: content ? content.trim() : '' });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// DÉFI DE 7 JOURS
// ══════════════════════════════════════════════════════════════════
app.post('/challenge', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];
  if (!sub || Date.now() > sub.expiryDate) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const cycleNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));

  const prompt = `Tu es Le Vieux. Crée un défi de 7 jours (cycle ${cycleNumber}).
Format :
- Titre du défi (ex: "7 jours de gratitude")
- Une phrase d'introduction
- Jour 1 à Jour 7 : une action concrète par jour (1 phrase chacun)
Réponds en français, ton sage et motivant, tutoiement.`;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MISTRAL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 400
      })
    });
    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message.content;
    return res.json({ content: content ? content.trim() : '' });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// BIBLIOTHÈQUE (conte audio/PDF)
// ══════════════════════════════════════════════════════════════════
app.post('/library', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const db = loadDB();
  const key = email.toLowerCase().trim();
  const sub = db.subscribers[key];
  if (!sub || Date.now() > sub.expiryDate) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const dayNumber = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

  const prompt = `Tu es Le Vieux. Raconte un conte africain authentique pour aujourd'hui (jour ${dayNumber}).
Format :
- Titre du conte
- Le conte (8-12 phrases), avec des animaux ou des sages comme personnages
- La morale du conte (2 phrases)
Réponds en français, ton chaleureux de conteur.`;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MISTRAL_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.95,
        max_tokens: 600
      })
    });
    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message.content;
    return res.json({ content: content ? content.trim() : '' });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN — STATISTIQUES
// ══════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════
// DÉMARRAGE
// ══════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('🌳 Le Vieux backend écoute sur le port ' + PORT);
  console.log('📊 Admin : /admin/stats?pwd=' + ADMIN_PWD);
});