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

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ══════════════════════════════════════════════════════════════════
// MAPPING PRODUITS CHARIOW → PLANS
// ══════════════════════════════════════════════════════════════════
const PRODUCT_TO_PLAN = {
  'prd_yxuku5': 'decouverte',
  'prd_rhnhn6': 'sage',
  'prd_cnqc9h': 'guide'
};

// ══════════════════════════════════════════════════════════════════
// PERMISSIONS PAR PLAN
// ══════════════════════════════════════════════════════════════════
const PLAN_PERMISSIONS = {
  decouverte: {
    chatLimit: 30,
    daily: true,
    meditation: true,
    evening: false,
    teaching: true,
    challenge: false,
    journal: false,
    library: 'weekly',  // 1 par semaine
    archives: false,
    customChallenge: false,
    personalizedChat: false
  },
  sage: {
    chatLimit: null,  // illimité
    daily: true,
    meditation: true,
    evening: true,
    teaching: true,
    challenge: true,
    journal: true,
    library: 'daily',  // 1 par jour
    archives: false,
    customChallenge: false,
    personalizedChat: false
  },
  guide: {
    chatLimit: null,
    daily: true,
    meditation: true,
    evening: true,
    teaching: true,
    challenge: true,
    journal: true,
    library: 'daily',
    archives: true,       // ← accès aux archives
    customChallenge: true, // ← défi sur mesure
    personalizedChat: true // ← chat personnalisé
  }
};

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'La Voix des Anciens Backend',
    version: '7.0.0',
    ai_provider: 'Groq',
    supabase_set: !!supabase
  });
});

// ══════════════════════════════════════════════════════════════════
// CATÉGORIES
// ══════════════════════════════════════════════════════════════════
const CATEGORIES = [
  { id: 'nature', label: 'Sagesse de la nature', prompt: `Parle de la sagesse que la nature enseigne. Choisis UN élément (arbre, plante, eau, terre, feu, vent, animal, saison) et tire une leçon profonde pour la vie humaine.` },
  { id: 'signes', label: 'Signes et destinée', prompt: `Parle des signes que la vie nous envoie. Un signe concret et comment l'interpréter avec sagesse. Explique : 1) le signe, 2) ce qu'il signifie, 3) comment agir.` },
  { id: 'protection', label: 'Protection intérieure', prompt: `Explique comment se protéger intérieurement des mauvaises énergies. Donne une pratique concrète (rituel de sel, bain, intention, geste). Explique : 1) pourquoi, 2) comment, 3) quand.` },
  { id: 'reves', label: 'Rêves et messages', prompt: `Interprète un rêve courant. Choisis UN rêve et explique son sens profond. Rappelle que le rêve est un message de ton esprit, pas une prédiction.` },
  { id: 'abondance', label: 'Abondance', prompt: `Parle de l'abondance. Explique ce qui attire et repousse l'argent. Donne un principe concret : 1) le principe, 2) pourquoi il marche, 3) comment l'appliquer.` },
  { id: 'paix', label: 'Paix et ancrage', prompt: `Aide à retrouver la paix intérieure. Explique un état (colère, peur, doute, fatigue) et comment le traverser. Donne un geste simple ou une pratique d'ancrage.` },
  { id: 'cycles', label: 'Cycles et temps', prompt: `Parle des cycles de la vie. Explique comment un cycle influence une situation. Donne un conseil pratique.` },
  { id: 'rituels', label: 'Rituels nobles', prompt: `Décris un rituel simple et noble d'ancrage. Basé sur éléments naturels (eau, sel, feu, plante, lumière). Explique : 1) à quoi ça sert, 2) comment le faire, 3) quand.` }
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
  return history.filter(m => m && m.content).map(m => {
    const role = (m.role === 'user') ? 'user' : 'assistant';
    return { role, content: String(m.content).trim() };
  }).filter(m => m.content.length > 0);
}

async function callGroq(messages, maxTokens = 800, temperature = 0.9) {
  let attempt = 0;
  while (attempt < 4) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROQ_MODEL, messages, temperature, max_tokens: maxTokens })
    });
    if (response.status === 429) {
      attempt++;
      if (attempt < 4) { await new Promise(r => setTimeout(r, attempt * 3000)); continue; }
    }
    return response;
  }
  return null;
}

async function getCache(key) {
  if (!supabase) return null;
  try {
    const { data } = await supabase.from('content_cache').select('content').eq('cache_key', key).maybeSingle();
    return data ? data.content : null;
  } catch (e) { return null; }
}

async function setCache(key, content) {
  if (!supabase) return;
  try { await supabase.from('content_cache').upsert({ cache_key: key, content, created_at: Date.now() }); } catch (e) {}
}

async function generateWithCache(cacheKey, prompt, maxTokens, temperature, label) {
  const cached = await getCache(cacheKey);
  if (cached) return cached;
  let response = null, attempts = 0;
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
// UTILITAIRES ABONNEMENT
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

async function getPlan(email) {
  const sub = await getSubscription(email);
  if (!sub || sub.expired) return null;
  return sub.plan || 'decouverte';
}

async function hasPermission(email, permission) {
  const plan = await getPlan(email);
  if (!plan) return false;
  const perms = PLAN_PERMISSIONS[plan] || PLAN_PERMISSIONS.decouverte;
  return perms[permission] === true;
}

async function getPermissionValue(email, permission) {
  const plan = await getPlan(email);
  if (!plan) return PLAN_PERMISSIONS.decouverte[permission];
  return (PLAN_PERMISSIONS[plan] || PLAN_PERMISSIONS.decouverte)[permission];
}

// ══════════════════════════════════════════════════════════════════
// /me — Infos du compte
// ══════════════════════════════════════════════════════════════════
app.post('/me', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const sub = await getSubscription(key);

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
      freeRemaining: Math.max(0, 5 - freeCount),
      permissions: PLAN_PERMISSIONS.decouverte
    });
  }

  const daysLeft = Math.ceil((sub.expiry_date - Date.now()) / 86400000);
  const planLabels = { decouverte: 'Découverte', sage: 'Sage', guide: 'Guide' };
  return res.json({
    email: key,
    subscribed: true,
    expired: false,
    plan: sub.plan || 'decouverte',
    planLabel: planLabels[sub.plan] || 'Découverte',
    expiryDate: sub.expiry_date,
    daysLeft,
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
  if (sub.expired) return res.json({ active: false, reason: 'expired' });
  const daysLeft = Math.ceil((sub.expiry_date - Date.now()) / 86400000);
  return res.json({ active: true, email: key, plan: sub.plan, expiryDate: sub.expiry_date, daysLeft });
});

// ══════════════════════════════════════════════════════════════════
// WEBHOOK CHARIOW
// ══════════════════════════════════════════════════════════════════
app.post('/webhook/chariow', async (req, res) => {
  const event = req.body;
  console.log('📩 Webhook Chariow :', JSON.stringify(event).slice(0, 300));

  if (!event || typeof event !== 'object') return res.status(400).json({ error: 'JSON invalide' });

  const eventType = event.event || event.type || event.event_type || '';
  const customerEmail = (
    (event.customer && event.customer.email) ||
    (event.data && event.data.customer && event.data.customer.email) ||
    event.email || (event.data && event.data.email) || ''
  ).toLowerCase().trim();

  if (!customerEmail) return res.json({ received: true, warning: 'no_email' });

  if (eventType.includes('sale') || eventType.includes('purchase') || eventType.includes('successful') || !eventType) {
    const productId = (event.sale && event.sale.product && event.sale.product.id) ||
                      (event.product && event.product.id) || '';
    const plan = PRODUCT_TO_PLAN[productId] || 'decouverte';
    console.log('🎯 Plan détecté : ' + plan);

    const now = Date.now();
    const { data: existing } = await supabase.from('subscribers').select('expiry_date').eq('email', customerEmail).maybeSingle();
    const currentExpiry = (existing && existing.expiry_date) || 0;
    const baseDate = Math.max(currentExpiry, now);
    const newExpiry = baseDate + (30 * 24 * 60 * 60 * 1000);

    await supabase.from('subscribers').upsert({
      email: customerEmail, start_date: now, expiry_date: newExpiry, plan, updated_at: now
    });

    return res.json({ received: true, action: 'activated', email: customerEmail, plan, expiryDate: newExpiry });
  }
  return res.json({ received: true, action: 'ignored' });
});

// ══════════════════════════════════════════════════════════════════
// CHAT — Personnalisé pour Guide
// ══════════════════════════════════════════════════════════════════
app.post('/ask', async (req, res) => {
  const { email, question, history } = req.body || {};
  if (!email || !question) return res.status(400).json({ error: 'Email requis' });
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'config_error' });

  const key = email.toLowerCase().trim();
  const FREE_LIMIT = 5;
  const plan = await getPlan(key);
  const isSubscribed = !!plan;

  let isFree = false;
  let chatLimitReached = false;

  if (!isSubscribed) {
    // Utilisateur gratuit
    let freeUser = null;
    try { const { data } = await supabase.from('free_users').select('*').eq('email', key).maybeSingle(); freeUser = data; } catch (e) {}
    const currentCount = (freeUser && freeUser.count) || 0;
    if (currentCount >= FREE_LIMIT) {
      return res.status(402).json({ error: 'quota_exceeded', message: 'Tes 5 questions offertes sont épuisées.' });
    }
    await supabase.from('free_users').upsert({ email: key, count: currentCount + 1 });
    isFree = true;
  } else {
    // Abonné Découverte : limite 30/mois
    const chatLimit = await getPermissionValue(key, 'chatLimit');
    if (chatLimit !== null) {
      // Compter les questions du mois
      const monthKey = 'chat_' + key + '_' + new Date().toISOString().slice(0, 7);
      const currentCount = parseInt(await getCache(monthKey) || '0', 10);
      if (currentCount >= chatLimit) {
        return res.status(402).json({ error: 'monthly_limit', message: 'Tes 30 questions du mois sont épuisées. Passe au plan Sage pour un chat illimité.' });
      }
      await setCache(monthKey, String(currentCount + 1));
    }
  }

  try {
    const personalizedChat = await getPermissionValue(key, 'personalizedChat');

    let systemPrompt = `Tu es "L'Ancien", un sage africain de 70 ans, assis sous un baobab sacré.
Tu ne récites PAS de leçons. Tu CONVERSES.
Tu poses des questions, tu creuses, tu écoutes vraiment.
Quand quelqu'un te pose une question, tu réponds ET tu poses une question en retour.

Règles :
- Tu tutoies toujours.
- Style : direct, chaleureux, sage, jamais froid ni scolaire.
- Commence souvent par : "Assieds-toi, mon enfant.", "Écoute bien.", "Je vois que tu portes quelque chose."
- Maximum 8 phrases par réponse.
- Termine SOUVENT par une question.
- Jamais de religion. Jamais de promesse de guérison.`;

    if (personalizedChat) {
      systemPrompt += `\n\nTu es face à un membre Guide (membre VIP). Sois encore plus personnel et profond.`;
    }

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
      try { const { data: fu } = await supabase.from('free_users').select('count').eq('email', key).maybeSingle(); freeRemaining = Math.max(0, FREE_LIMIT - ((fu && fu.count) || 0)); } catch (e) {}
    }

    return res.json({ answer: answer.trim(), isFree, freeRemaining });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// /daily — Signe / Méditation / Rituel (par plan)
// ══════════════════════════════════════════════════════════════════
app.post('/daily', async (req, res) => {
  const { email, type } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  const isSubscribed = !!plan;

  // Vérifier permission
  let allowed = false;
  if (plan) {
    if (type === 'evening') allowed = await getPermissionValue(key, 'evening');
    else if (type === 'meditation') allowed = await getPermissionValue(key, 'meditation');
    else allowed = await getPermissionValue(key, 'daily');
  } else {
    // Gratuit : seulement signe du matin et méditation
    allowed = (type === 'morning' || type === 'meditation');
  }

  if (!allowed) {
    return res.status(402).json({ error: 'subscription_required', message: 'Ce contenu est réservé aux abonnés.' });
  }

  const dayKey = todayKey();
  const cacheKey = 'daily_' + dayKey + '_' + (type || 'morning');
  const cat = getDayCategory();

  let prompt;
  if (type === 'evening') {
    prompt = `${cat.prompt}\n\nContexte : c'est le soir. Format : sujet (2 phrases), explication (3-4 phrases), action concrète (2 phrases).`;
  } else if (type === 'meditation') {
    prompt = `${cat.prompt}\n\nContexte : matin. Méditation courte : 3-5 phrases. Un geste simple.`;
  } else {
    prompt = `${cat.prompt}\n\nContexte : matin. Signe ou leçon. Format : 1) signe (2 phrases), 2) sens (3-4 phrases), 3) action (2 phrases).`;
  }

  try {
    let content = await generateWithCache(cacheKey, prompt, 1200, 0.92, '/daily ' + type);
    if (!content) content = "Aujourd'hui, observe le premier arbre que tu verras.\n\nLes anciens savaient que l'arbre que tu remarques porte un message.\n\nPrends 30 secondes pour le regarder.";

    // Si non abonné, teaser
    if (!isSubscribed) {
      const teaser = content.split('\n').slice(0, 2).join('\n');
      return res.json({ content, teaser: teaser, isTeaser: true });
    }
    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// /teaching — Enseignement hebdo (avec archives pour Guide)
// ══════════════════════════════════════════════════════════════════
app.post('/teaching', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  const isSubscribed = !!plan;

  if (!isSubscribed) {
    return res.status(402).json({ error: 'subscription_required' });
  }
  const teachingAllowed = await getPermissionValue(key, 'teaching');
  if (!teachingAllowed) return res.status(402).json({ error: 'subscription_required' });

  const cacheKey = 'teaching_' + weekKey();
  const weekCat = getWeekCategory();
  const prompt = `Tu es L'Ancien. Catégorie : ${weekCat.label}. ${weekCat.prompt}\n\nFormat : Titre, Introduction (3 phrases), 3 leçons numérotées, Action de la semaine, Conclusion. Environ 400 mots.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1800, 0.92, '/teaching');
    if (!content) content = "La sagesse du baobab\n\nLe baobab ne pousse pas vite. Il pousse longtemps.\n\n1. La lenteur n'est pas une faiblesse.\n2. Plus tu grandis, plus tu dois donner.\n3. Ce que tu construis lentement, rien ne peut le détruire.\n\nAction : plante quelque chose cette semaine.";
    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// Archives des enseignements (Guide uniquement)
app.post('/teaching/archives', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const hasAccess = await hasPermission(key, 'archives');
  if (!hasAccess) return res.status(402).json({ error: 'subscription_required' });

  try {
    const { data } = await supabase
      .from('content_cache')
      .select('cache_key, content')
      .like('cache_key', 'teaching_%')
      .order('created_at', { ascending: false })
      .limit(20);
    return res.json({ archives: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// /challenge — Défi (standard + sur mesure pour Guide)
// ══════════════════════════════════════════════════════════════════
app.post('/challenge', async (req, res) => {
  const { email, custom, need } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();

  const hasAccess = await hasPermission(key, 'challenge');
  if (!hasAccess) return res.status(402).json({ error: 'subscription_required' });

  // Défi sur mesure pour Guide
  if (custom) {
    const canCustom = await hasPermission(key, 'customChallenge');
    if (!canCustom) return res.status(402).json({ error: 'custom_required' });
    if (!need || !need.trim()) return res.status(400).json({ error: 'need_required' });

    const prompt = `Tu es L'Ancien. Crée un défi de 7 jours SUR MESURE pour quelqu'un qui a besoin de : "${need}".

Format :
- Titre personnalisé
- Introduction (2 phrases)
- Jour 1 à Jour 7 (1 action concrète chacun, 2 phrases)
- Conclusion (1 phrase)

Français simple, ton direct et sage.`;

    try {
      const response = await callGroq([{ role: 'user', content: prompt }], 1500, 0.95);
      if (!response || !response.ok) return res.status(500).json({ error: 'ai_error' });
      const data = await response.json();
      const content = data.choices && data.choices[0] && data.choices[0].message.content;
      return res.json({ content: content || '' });
    } catch (e) {
      return res.status(500).json({ error: 'ai_error' });
    }
  }

  // Défi standard
  const cacheKey = 'challenge_' + weekKey();
  const weekCat = getWeekCategory();
  const prompt = `Tu es L'Ancien. Défi de 7 jours sur : ${weekCat.label}. ${weekCat.prompt}\n\nFormat : Titre, Introduction (1 phrase), Jour 1 à Jour 7 (1 action concrète chacun), Conclusion. Écris en entier.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1500, 0.92, '/challenge');
    if (!content) content = "7 jours de reconnexion\n\nJour 1 : Regarde le ciel 5 minutes.\nJour 2 : Marche pieds nus sur la terre.\nJour 3 : Écris une chose secrète.\nJour 4 : Offre sans attendre de retour.\nJour 5 : Reste 10 minutes en silence.\nJour 6 : Contacte quelqu'un que tu as perdu de vue.\nJour 7 : Relis tout ce que tu as fait.";
    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// /library — Conte (avec archives pour Guide)
// ══════════════════════════════════════════════════════════════════
app.post('/library', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();

  const libraryLevel = await getPermissionValue(key, 'library');
  if (!libraryLevel || libraryLevel === false) return res.status(402).json({ error: 'subscription_required' });

  const cacheKey = 'library_' + todayKey();
  const dayNumber = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const prompt = `Tu es L'Ancien. Conte africain authentique pour aujourd'hui (jour ${dayNumber}).\n\nFormat : Titre, conte (12-15 phrases), morale (2 phrases). Noble, universel, sans religion. Écris en entier.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1800, 0.95, '/library');
    if (!content) content = "Le vieux et la rivière\n\nUn jeune homme vint voir un ancien en colère.\nL'ancien l'emmena au bord d'une rivière.\nLa rivière ne se plaint jamais. Elle contourne. Elle attend. Elle use.\nTa colère, c'est un rocher. Si tu le frappes, tu te blesses.\nSi tu l'uses par la patience, tu passes.\n\nMorale : Ne frappe pas l'obstacle. Contourne-le.";
    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// Archives contes (Guide uniquement)
app.post('/library/archives', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const hasAccess = await hasPermission(key, 'archives');
  if (!hasAccess) return res.status(402).json({ error: 'subscription_required' });

  try {
    const { data } = await supabase
      .from('content_cache')
      .select('cache_key, content')
      .like('cache_key', 'library_%')
      .order('created_at', { ascending: false })
      .limit(30);
    return res.json({ archives: data || [] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
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
    const actives = [], expired = [];
    (subs || []).forEach(s => {
      if (!s.email) return;
      if (s.expiry_date > now) actives.push({ email: s.email, plan: s.plan, expiry: new Date(s.expiry_date).toLocaleDateString('fr-FR'), daysLeft: Math.ceil((s.expiry_date - now) / 86400000) });
      else expired.push({ email: s.email, plan: s.plan, expiredSince: new Date(s.expiry_date).toLocaleDateString('fr-FR') });
    });
    const { data: freeUsers } = await supabase.from('free_users').select('*');
    res.json({ totalActive: actives.length, totalExpired: expired.length, totalFreeUsers: (freeUsers || []).length, actives, expired });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log('🌳 L\'Ancien backend v7.0.0 sur port ' + PORT);
  console.log('💾 Supabase : ' + (supabase ? '✓' : '❌'));
  console.log('🎯 Plans : Découverte / Sage / Guide');
});
