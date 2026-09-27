const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const ADMIN_PWD = process.env.ADMIN_PWD || 'levieux2026';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

const GROQ_MODEL = 'openai/gpt-oss-20b';

// ══════════════════════════════════════════════════════════════════
// MAPPING DES PRODUITS CHARIOW → PLANS
// ══════════════════════════════════════════════════════════════════
const PRODUCT_TO_PLAN = {
  'prd_yxuku5': 'decouverte',  // 5 000 FCFA
  'prd_rhnhn6': 'sage',        // 10 000 FCFA
  'prd_cnqc9h': 'guide'        // 20 000 FCFA
};

// ══════════════════════════════════════════════════════════════════
// PERMISSIONS PAR PLAN
// ══════════════════════════════════════════════════════════════════
const PLAN_PERMISSIONS = {
  decouverte: {
    chat: true,
    chatLimit: 30,  // 30 questions/mois
    daily: true,
    teaching: true,
    challenge: false,
    library: true,
    journal: false
  },
  sage: {
    chat: true,
    chatLimit: null, // illimité
    daily: true,
    teaching: true,
    challenge: true,
    library: true,
    journal: true
  },
  guide: {
    chat: true,
    chatLimit: null,
    daily: true,
    teaching: true,
    challenge: true,
    library: true,
    journal: true
  }
};

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'La Voix des Anciens Backend',
    version: '6.0.0',
    ai_provider: 'Groq',
    ai_model: GROQ_MODEL,
    groq_key_set: !!GROQ_API_KEY && GROQ_API_KEY.length > 10,
    supabase_set: !!supabase
  });
});

// ══════════════════════════════════════════════════════════════════
// LES 8 CATÉGORIES DE SAGESSE
// ══════════════════════════════════════════════════════════════════
const CATEGORIES = [
  { id: 'nature', label: 'Sagesse de la nature', prompt: `Parle de la sagesse que la nature enseigne...` },
  { id: 'signes', label: 'Signes et destinée', prompt: `Parle des signes que la vie nous envoie...` },
  { id: 'protection', label: 'Protection intérieure', prompt: `Explique comment se protéger intérieurement...` },
  { id: 'reves', label: 'Rêves et messages', prompt: `Interprète un rêve courant...` },
  { id: 'abondance', label: 'Abondance', prompt: `Parle de l'abondance et de la prospérité...` },
  { id: 'paix', label: 'Paix et ancrage', prompt: `Aide à retrouver la paix intérieure...` },
  { id: 'cycles', label: 'Cycles et temps', prompt: `Parle des cycles de la vie...` },
  { id: 'rituels', label: 'Rituels nobles', prompt: `Décris un rituel simple et noble...` }
];

function getDayCategory() {
  const d = new Date();
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return CATEGORIES[dayOfYear % CATEGORIES.length];
}

function getWeekCategory() {
  const d = new Date();
  const weekOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / (7 * 86400000));
  return CATEGORIES[weekOfYear % CATEGORIES.length];
}

function todayKey() { return new Date().toISOString().split('T')[0]; }
function weekKey() {
  const d = new Date();
  return d.getFullYear() + '-W' + Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 604800000);
}

function convertHistoryForAI(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(msg => msg && msg.content)
    .map(msg => {
      let role = 'user';
      const msgRole = (msg.role || '').toLowerCase();
      if (msgRole === 'user') role = 'user';
      else role = 'assistant';
      return { role, content: String(msg.content).trim() };
    })
    .filter(msg => msg.content.length > 0);
}

async function callGroq(messages, maxTokens = 600, temperature = 0.9) {
  let attempt = 0;
  const maxAttempts = 4;
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
        const wait = attempt * 3000;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
    }
    return response;
  }
  return null;
}

async function getCache(cacheKey) {
  if (!supabase) return null;
  try {
    const { data } = await supabase.from('content_cache').select('content').eq('cache_key', cacheKey).maybeSingle();
    return data ? data.content : null;
  } catch (e) { return null; }
}

async function setCache(cacheKey, content) {
  if (!supabase) return;
  try {
    await supabase.from('content_cache').upsert({ cache_key: cacheKey, content, created_at: Date.now() });
  } catch (e) {}
}

async function generateWithCache(cacheKey, prompt, maxTokens, temperature, label) {
  const cached = await getCache(cacheKey);
  if (cached) return cached;
  let response = null;
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    response = await callGroq([{ role: 'user', content: prompt }], maxTokens, temperature);
    if (response && response.ok) {
      const data = await response.json();
      const content = data.choices && data.choices[0] && data.choices[0].message.content;
      if (content && content.trim().length > 0) {
        await setCache(cacheKey, content.trim());
        return content.trim();
      }
    }
    if (attempts < 5) await new Promise(r => setTimeout(r, attempts * 5000));
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES ABONNEMENT
// ══════════════════════════════════════════════════════════════════
async function getSubscription(email) {
  if (!supabase || !email) return null;
  try {
    const key = email.toLowerCase().trim();
    const { data } = await supabase.from('subscribers').select('*').eq('email', key).maybeSingle();
    if (!data) return null;
    if (Date.now() > data.expiry_date) return { ...data, expired: true };
    return { ...data, expired: false };
  } catch (e) { return null; }
}

async function hasPermission(email, permission) {
  const sub = await getSubscription(email);
  if (!sub || sub.expired) return false;
  const plan = sub.plan || 'decouverte';
  const perms = PLAN_PERMISSIONS[plan] || PLAN_PERMISSIONS.decouverte;
  return perms[permission] === true;
}

// ══════════════════════════════════════════════════════════════════
// ROUTE /me — Infos du compte connecté
// ══════════════════════════════════════════════════════════════════
app.post('/me', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();
  const sub = await getSubscription(key);

  // Utilisateur gratuit
  let freeCount = 0;
  try {
    const { data } = await supabase.from('free_users').select('count').eq('email', key).maybeSingle();
    freeCount = (data && data.count) || 0;
  } catch (e) {}

  if (!sub || sub.expired) {
    return res.json({
      email: key,
      subscribed: false,
      expired: sub ? sub.expired : false,
      plan: null,
      freeQuestionsUsed: freeCount,
      freeQuestionsLimit: 5,
      freeRemaining: Math.max(0, 5 - freeCount)
    });
  }

  const daysLeft = Math.ceil((sub.expiry_date - Date.now()) / 86400000);
  return res.json({
    email: key,
    subscribed: true,
    expired: false,
    plan: sub.plan || 'decouverte',
    planLabel: (sub.plan === 'sage' ? 'Sage' : sub.plan === 'guide' ? 'Guide' : 'Découverte'),
    expiryDate: sub.expiry_date,
    daysLeft: daysLeft,
    permissions: PLAN_PERMISSIONS[sub.plan] || PLAN_PERMISSIONS.decouverte
  });
});

// ══════════════════════════════════════════════════════════════════
// CHECK-ACCESS
// ══════════════════════════════════════════════════════════════════
app.post('/check-access', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const sub = await getSubscription(key);

  if (!sub) return res.json({ active: false, reason: 'not_subscribed' });
  if (sub.expired) return res.json({ active: false, reason: 'expired', expiryDate: sub.expiry_date });

  const daysLeft = Math.ceil((sub.expiry_date - Date.now()) / 86400000);
  return res.json({
    active: true,
    email: key,
    plan: sub.plan || 'decouverte',
    expiryDate: sub.expiry_date,
    daysLeft: daysLeft
  });
});

// ══════════════════════════════════════════════════════════════════
// WEBHOOK CHARIOW — détecte le plan par ID produit
// ══════════════════════════════════════════════════════════════════
app.post('/webhook/chariow', async (req, res) => {
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

  if (!customerEmail) return res.json({ received: true, warning: 'no_email' });

  if (eventType.includes('sale') || eventType.includes('purchase') || eventType.includes('successful') || !eventType) {
    // Détection du plan par ID produit (dans sale.product.id)
    const productId =
      (event.sale && event.sale.product && event.sale.product.id) ||
      (event.product && event.product.id) ||
      (event.data && event.data.product && event.data.product.id) ||
      '';

    const plan = PRODUCT_TO_PLAN[productId] || 'decouverte';
    console.log('🎯 Plan détecté : ' + plan + ' (produit : ' + productId + ')');

    const now = Date.now();
    const { data: existing } = await supabase.from('subscribers').select('expiry_date').eq('email', customerEmail).maybeSingle();
    const currentExpiry = (existing && existing.expiry_date) || 0;
    const baseDate = Math.max(currentExpiry, now);
    const newExpiry = baseDate + (30 * 24 * 60 * 60 * 1000);

    await supabase.from('subscribers').upsert({
      email: customerEmail,
      start_date: now,
      expiry_date: newExpiry,
      plan: plan,
      updated_at: now
    });

    console.log('✅ Abonnement activé : ' + customerEmail + ' (plan ' + plan + ')');
    return res.json({ received: true, action: 'activated', email: customerEmail, plan, expiryDate: newExpiry });
  }

  return res.json({ received: true, action: 'ignored' });
});

// ══════════════════════════════════════════════════════════════════
// CHAT — Conversationnel avec mémoire
// ══════════════════════════════════════════════════════════════════
app.post('/ask', async (req, res) => {
  const { email, question, history } = req.body || {};
  if (!email || !question) return res.status(400).json({ error: 'Email et question requis' });
  if (!GROQ_API_KEY || GROQ_API_KEY.length < 10) return res.status(500).json({ error: 'config_error' });

  const key = email.toLowerCase().trim();
  const FREE_LIMIT = 5;
  const sub = await getSubscription(key);
  const isSubscribed = sub && !sub.expired;

  let isFree = false;

  if (!isSubscribed) {
    let freeUser = null;
    try {
      const { data } = await supabase.from('free_users').select('*').eq('email', key).maybeSingle();
      freeUser = data;
    } catch (e) {}

    const currentCount = (freeUser && freeUser.count) || 0;
    if (currentCount >= FREE_LIMIT) {
      return res.status(402).json({ error: 'quota_exceeded', message: 'Tes 5 questions offertes sont épuisées.', freeUsed: currentCount, freeLimit: FREE_LIMIT });
    }
    await supabase.from('free_users').upsert({ email: key, count: currentCount + 1 });
    isFree = true;
  }

  try {
    // PROMPT CONVERSATIONNEL
    const systemPrompt = `Tu es "L'Ancien", un sage africain de 70 ans, assis sous un baobab sacré.
Tu ne récites PAS de leçons. Tu CONVERSES avec la personne qui vient te voir.
Tu poses des questions, tu creuses, tu écoutes vraiment.
Quand quelqu'un te pose une question, tu réponds ET tu lui poses une question en retour pour mieux comprendre sa situation.

Règles :
- Tu tutoies toujours.
- Ton style : direct, chaleureux, sage, jamais froid ni scolaire.
- Tu commences souvent par : "Assieds-toi, mon enfant.", "Écoute bien.", "Je vois que tu portes quelque chose."
- Tu ne fais JAMAIS de réponse longue de plus de 8 phrases.
- Tu termines SOUVENT par une question pour engager la conversation.
- Tu ne parles JAMAIS de religion.
- Tu ne fais JAMAIS de promesse de guérison.

Exemple de bonne réponse :
"Assieds-toi, mon enfant. Ce que tu ressens, beaucoup l'ont ressenti avant toi. Mais dis-moi : quand cette sensation a-t-elle commencé ? C'est important pour comprendre ce qui se passe."`;

    const convertedHistory = convertHistoryForAI(history || []).slice(-12);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...convertedHistory,
      { role: 'user', content: String(question).trim() }
    ];

    const response = await callGroq(messages, 800, 0.95);
    if (!response || !response.ok) return res.status(500).json({ error: 'ai_error', message: "L'Ancien est fatigué." });

    const data = await response.json();
    const answer = data.choices && data.choices[0] && data.choices[0].message.content;
    if (!answer) return res.status(500).json({ error: 'no_answer' });

    let freeRemaining = null;
    if (isFree) {
      try {
        const { data: fu } = await supabase.from('free_users').select('count').eq('email', key).maybeSingle();
        freeRemaining = Math.max(0, FREE_LIMIT - ((fu && fu.count) || 0));
      } catch (e) {}
    }

    return res.json({ answer: answer.trim(), isFree: isFree, freeRemaining: freeRemaining });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// DAILY
// ══════════════════════════════════════════════════════════════════
app.post('/daily', async (req, res) => {
  const { email, type } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();
  const subscribed = await hasPermission(key, 'daily');

  const dayKey = todayKey();
  const cacheKey = 'daily_' + dayKey + '_' + (type || 'morning');
  const cat = getDayCategory();

  let prompt;
  if (type === 'evening') {
    prompt = `${cat.prompt}\n\nContexte : c'est le soir. Format : sujet (2 phrases), explication (3-4 phrases), action concrète (2 phrases).`;
  } else if (type === 'meditation') {
    prompt = `${cat.prompt}\n\nContexte : c'est le matin. Méditation courte : 3-5 phrases. Un geste simple à faire ce matin.`;
  } else {
    prompt = `${cat.prompt}\n\nContexte : c'est le matin. Signe ou leçon du jour. Format : 1) signe (2 phrases), 2) sens (3-4 phrases), 3) action (2 phrases).`;
  }

  try {
    let content = await generateWithCache(cacheKey, prompt, 1200, 0.92, '/daily (' + type + ')');
    if (!content) content = "Aujourd'hui, observe le premier arbre que tu verras.\n\nLes anciens savaient que l'arbre que tu remarques en premier porte un message.\n\nPrends 30 secondes pour regarder un arbre et écoute ce qu'il te dit.";

    if (!subscribed) {
      const teaser = content.split('\n').slice(0, 2).join('\n');
      return res.status(402).json({ error: 'subscription_required', teaser, content });
    }
    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// TEACHING
// ══════════════════════════════════════════════════════════════════
app.post('/teaching', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const subscribed = await hasPermission(key, 'teaching');

  const cacheKey = 'teaching_' + weekKey();
  const weekCat = getWeekCategory();
  const prompt = `Tu es L'Ancien. Catégorie de la semaine : ${weekCat.label}. ${weekCat.prompt}\n\nFormat : Titre, Introduction (3 phrases), 3 leçons numérotées, Action de la semaine, Conclusion. Environ 400 mots.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1800, 0.92, '/teaching');
    if (!content) content = "La sagesse du baobab\n\nLe baobab ne pousse pas vite. Il pousse longtemps.\n\n1. La lenteur n'est pas une faiblesse.\n2. Plus tu grandis, plus tu dois donner.\n3. Ce que tu construis lentement, rien ne peut le détruire.\n\nAction : plante quelque chose cette semaine.";

    if (!subscribed) {
      const teaser = content.split('\n').slice(0, 4).join('\n');
      return res.status(402).json({ error: 'subscription_required', teaser, content });
    }
    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// CHALLENGE — réservé aux plans Sage et Guide
// ══════════════════════════════════════════════════════════════════
app.post('/challenge', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const subscribed = await hasPermission(key, 'challenge');

  const cacheKey = 'challenge_' + weekKey();
  const weekCat = getWeekCategory();
  const prompt = `Tu es L'Ancien. Défi de 7 jours sur : ${weekCat.label}. ${weekCat.prompt}\n\nFormat : Titre, Introduction (1 phrase), Jour 1 à Jour 7 (1 action concrète chacun), Conclusion. Écris les 7 jours en entier.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1500, 0.92, '/challenge');
    if (!content) content = "7 jours de reconnexion\n\nJour 1 : Regarde le ciel 5 minutes.\nJour 2 : Marche pieds nus sur la terre.\nJour 3 : Écris une chose secrète.\nJour 4 : Offre sans attendre de retour.\nJour 5 : Reste 10 minutes en silence.\nJour 6 : Contacte quelqu'un que tu as perdu de vue.\nJour 7 : Relis tout ce que tu as fait.\n\nCe que tu fais 7 jours de suite devient une habitude.";

    if (!subscribed) {
      const teaser = content.split('\n').slice(0, 5).join('\n');
      return res.status(402).json({ error: 'subscription_required', teaser, content });
    }
    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// LIBRARY
// ══════════════════════════════════════════════════════════════════
app.post('/library', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const subscribed = await hasPermission(key, 'library');

  const cacheKey = 'library_' + todayKey();
  const dayNumber = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const prompt = `Tu es L'Ancien. Conte africain authentique pour aujourd'hui (jour ${dayNumber}).\n\nFormat : Titre, conte (12-15 phrases), morale (2 phrases). Noble, universel, sans religion ni sorcellerie. Écris en entier.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1800, 0.95, '/library');
    if (!content) content = "Le vieux et la rivière\n\nUn jour, un jeune homme vint voir un ancien en colère contre la vie.\nL'ancien l'emmena au bord d'une rivière.\nRegarde, dit-il. La rivière ne se plaint jamais.\nElle contourne. Elle attend. Elle use.\nTa colère, c'est un rocher. Si tu le frappes, tu te blesses.\nSi tu l'uses par la patience, tu passes.\n\nMorale : Ne frappe pas l'obstacle. Contourne-le.";

    if (!subscribed) {
      const teaser = content.split('\n').slice(0, 4).join('\n');
      return res.status(402).json({ error: 'subscription_required', teaser, content });
    }
    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN
// ══════════════════════════════════════════════════════════════════
app.get('/admin/stats', async (req, res) => {
  const pwd = req.query.pwd;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'unauthorized' });

  try {
    const { data: subs } = await supabase.from('subscribers').select('*');
    const now = Date.now();
    const actives = [];
    const expired = [];
    (subs || []).forEach(s => {
      if (!s.email) return;
      if (s.expiry_date > now) {
        actives.push({ email: s.email, plan: s.plan, expiry: new Date(s.expiry_date).toLocaleDateString('fr-FR'), daysLeft: Math.ceil((s.expiry_date - now) / 86400000) });
      } else {
        expired.push({ email: s.email, plan: s.plan, expiredSince: new Date(s.expiry_date).toLocaleDateString('fr-FR') });
      }
    });
    const { data: freeUsers } = await supabase.from('free_users').select('*');
    res.json({
      totalActive: actives.length,
      totalExpired: expired.length,
      totalFreeUsers: (freeUsers || []).length,
      actives,
      expired
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log('🌳 L\'Ancien backend v6.0.0 sur port ' + PORT);
  console.log('📊 Admin : /admin/stats?pwd=' + ADMIN_PWD);
  console.log('🔑 Groq : ' + (GROQ_API_KEY ? '✓' : '❌'));
  console.log('💾 Supabase : ' + (supabase ? '✓' : '❌'));
  console.log('🎯 Plans : Découverte / Sage / Guide');
});
