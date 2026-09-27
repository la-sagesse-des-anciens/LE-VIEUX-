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

const PRODUCT_TO_PLAN = {
  'prd_yxuku5': 'decouverte',
  'prd_rhnhn6': 'sage',
  'prd_cnqc9h': 'guide'
};

const PLAN_PERMISSIONS = {
  decouverte: { chatLimit: 30, daily: true, meditation: true, evening: false, teaching: true, challenge: false, journal: false, library: 'weekly', archives: false, customChallenge: false, personalizedChat: false },
  sage: { chatLimit: null, daily: true, meditation: true, evening: true, teaching: true, challenge: true, journal: true, library: 'daily', archives: false, customChallenge: false, personalizedChat: false },
  guide: { chatLimit: null, daily: true, meditation: true, evening: true, teaching: true, challenge: true, journal: true, library: 'daily', archives: true, customChallenge: true, personalizedChat: true }
};

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'La Voix des Anciens Backend', version: '8.0.0', supabase_set: !!supabase });
});

// ══════════════════════════════════════════════════════════════════
// LES 5 PILIERS — Chaque pilier est un angle d'enseignement
// ══════════════════════════════════════════════════════════════════
const PILIERS = [
  {
    id: 'abondance',
    label: 'Abondance & Commerce',
    theme: 'rituels pour débloquer le flux de l\'argent',
    ideas: `- Rituel d'ouverture de chemin avec du sel, de la cannelle, du riz ou de l'eau
- Geste du matin avant d'ouvrir la boutique ou de partir travailler
- Débloquer les dettes, l'argent qui traîne, les clients qui ne viennent plus
- Le sens du premier billet de la journée
- Pourquoi l'argent fuit et comment le retenir`
  },
  {
    id: 'protection',
    label: 'Protection & Foyer',
    theme: 'protéger sa maison et sa famille',
    ideas: `- Se protéger de la jalousie, du mauvais œil, des mauvaises langues
- Bain de décharge pour laver l'intérieur
- Nettoyer les énergies lourdes après une visite
- Protéger la chambre, le lit, le seuil de la porte, les enfants
- Le sel, l'eau, la lumière pour purifier la maison`
  },
  {
    id: 'sante',
    label: 'Santé & Vitalité',
    theme: 'remèdes naturels et vitalité',
    ideas: `- Remèdes de grand-mère avec des plantes : citron, miel, clous de girofle, ail, eau de coco
- Tisanes pour purifier le sang, le foie, les reins
- Points d'énergie du corps
- Purification et digestion naturelle
- Retrouver la force et la vitalité`
  },
  {
    id: 'signes',
    label: 'Signes & Présages',
    theme: 'décoder les signes de la vie',
    ideas: `- Signification des rêves : eau, défunts, dents, serpents, fidélité
- Signes de la nature : oiseaux, animaux, événements de la maison
- Signification des chiffres, dates de naissance, grains de beauté
- Comprendre un signe sans tomber dans la peur
- Les signes qui annoncent un changement`
  },
  {
    id: 'sagesse',
    label: 'Sagesse de Vie',
    theme: 'élever son caractère et son âme',
    ideas: `- Le silence qui protège et qui instruit
- Se protéger des personnes toxiques sans les attaquer
- Le respect de soi qui attire le respect des autres
- La patience : la vraie force
- Élever son aura par les actes, pas par la parole`
  }
];

function getDayPilier() {
  const d = new Date();
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return PILIERS[dayOfYear % PILIERS.length];
}

function getWeekPilier() {
  const d = new Date();
  const weekOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / (7 * 86400000));
  return PILIERS[weekOfYear % PILIERS.length];
}

function getRandomPilier() {
  return PILIERS[Math.floor(Math.random() * PILIERS.length)];
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

async function callGroq(messages, maxTokens = 800, temperature = 0.95) {
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
  try { const { data } = await supabase.from('content_cache').select('content').eq('cache_key', key).maybeSingle(); return data ? data.content : null; } catch (e) { return null; }
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
      if (content && content.trim().length > 0) { await setCache(cacheKey, content.trim()); return content.trim(); }
    }
    if (attempts < 5) await new Promise(r => setTimeout(r, attempts * 5000));
  }
  return null;
}

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

async function getPlan(email) { const sub = await getSubscription(email); if (!sub || sub.expired) return null; return sub.plan || 'decouverte'; }
async function hasPermission(email, permission) { const plan = await getPlan(email); if (!plan) return false; return (PLAN_PERMISSIONS[plan] || PLAN_PERMISSIONS.decouverte)[permission] === true; }
async function getPermissionValue(email, permission) { const plan = await getPlan(email); if (!plan) return PLAN_PERMISSIONS.decouverte[permission]; return (PLAN_PERMISSIONS[plan] || PLAN_PERMISSIONS.decouverte)[permission]; }

// ══════════════════════════════════════════════════════════════════
// LE PROMPT MAÎTRE — La voix du vieux
// ══════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `Tu es "Le Vieux", un sage africain qui sait. Tu as 70 ans. Tu es assis devant ta maison, sous un vieux manguier.

TON CARACTÈRE :
- Tu es bienveillant, digne, chaleureux, direct.
- Tu parles à la première personne : "je", "mon", "ma".
- Tu tutoies toujours ton interlocuteur.
- Tu parles comme au marché, dans le quartier. Langage parlé, simple, populaire, authentique.
- Tu n'es PAS un marabout, PAS un féticheur, PAS un voyant, PAS un prêtre.
- Tu es un vieux qui a la sagesse du terrain et qui la partage.

TON LANGAGE :
- Français parlé, fluide, naturel. Phrases courtes (10 à 12 mots max).
- Mots de la rue et du marché : "gâté", "poisse", "blinder", "laver l'intérieur", "lourdeur", "palabres".
- JAMAIS de langue littéraire ("demeure", "souveraineté", "obstrué", "subsistance").

MOTS PROHIBÉS (RÈGLE ABSOLUE) :
❌ Ne jamais dire : "guérir", "magie", "sortilège", "marabout", "féticheur", "envoûtement", "sorcellerie".
✅ Dire : "soulager", "purifier", "sagesse ancienne", "pratique ancestrale", "tradition", "débloquer", "prospérité", "harmonie".

TON STYLE DE RÉPONSE :
- Commence souvent par : "Assieds-toi, mon enfant.", "Écoute bien.", "Je vais te dire une chose.", "Voilà ce que je sais."
- Tu donnes TOUJOURS un conseil concret : un geste, un rituel, un remède, une plante, une parole à dire.
- Tu termines SOUVENT par une question pour comprendre la personne.
- Maximum 8 phrases par réponse.
- Tu ne fais JAMAIS de promesse de richesse absolue, de guérison miraculeuse. Tu parles de "débloquer", "soulager", "aider".

TES 5 DOMAINES :
1. Abondance & Commerce (argent, boutique, clients, dettes)
2. Protection & Foyer (jalousie, mauvais œil, maison, famille)
3. Santé & Vitalité (plantes, tisanes, remèdes de grand-mère)
4. Signes & Présages (rêves, oiseaux, chiffres, naissance)
5. Sagesse de Vie (silence, patience, personnes toxiques, respect)`;

app.post('/me', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const sub = await getSubscription(key);

  let freeCount = 0;
  try { const { data } = await supabase.from('free_users').select('count').eq('email', key).maybeSingle(); freeCount = (data && data.count) || 0; } catch (e) {}

  if (!sub || sub.expired) {
    return res.json({ email: key, subscribed: false, expired: sub ? sub.expired : false, plan: null, freeRemaining: Math.max(0, 5 - freeCount), permissions: PLAN_PERMISSIONS.decouverte });
  }

  const daysLeft = Math.ceil((sub.expiry_date - Date.now()) / 86400000);
  const planLabels = { decouverte: 'Découverte', sage: 'Sage', guide: 'Guide' };
  return res.json({
    email: key, subscribed: true, expired: false,
    plan: sub.plan || 'decouverte', planLabel: planLabels[sub.plan] || 'Découverte',
    expiryDate: sub.expiry_date, daysLeft,
    permissions: PLAN_PERMISSIONS[sub.plan] || PLAN_PERMISSIONS.decouverte
  });
});

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
    const productId = (event.sale && event.sale.product && event.sale.product.id) || (event.product && event.product.id) || '';
    const plan = PRODUCT_TO_PLAN[productId] || 'decouverte';
    console.log('🎯 Plan détecté : ' + plan);

    const now = Date.now();
    const { data: existing } = await supabase.from('subscribers').select('expiry_date').eq('email', customerEmail).maybeSingle();
    const currentExpiry = (existing && existing.expiry_date) || 0;
    const baseDate = Math.max(currentExpiry, now);
    const newExpiry = baseDate + (30 * 24 * 60 * 60 * 1000);

    await supabase.from('subscribers').upsert({ email: customerEmail, start_date: now, expiry_date: newExpiry, plan, updated_at: now });
    return res.json({ received: true, action: 'activated', email: customerEmail, plan, expiryDate: newExpiry });
  }
  return res.json({ received: true, action: 'ignored' });
});

// ══════════════════════════════════════════════════════════════════
// CHAT — Le Vieux répond
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

  if (!isSubscribed) {
    let freeUser = null;
    try { const { data } = await supabase.from('free_users').select('*').eq('email', key).maybeSingle(); freeUser = data; } catch (e) {}
    const currentCount = (freeUser && freeUser.count) || 0;
    if (currentCount >= FREE_LIMIT) {
      return res.status(402).json({ error: 'quota_exceeded', message: 'Tes 5 questions offertes sont épuisées.' });
    }
    await supabase.from('free_users').upsert({ email: key, count: currentCount + 1 });
    isFree = true;
  } else {
    const chatLimit = await getPermissionValue(key, 'chatLimit');
    if (chatLimit !== null) {
      const monthKey = 'chat_' + key + '_' + new Date().toISOString().slice(0, 7);
      const currentCount = parseInt(await getCache(monthKey) || '0', 10);
      if (currentCount >= chatLimit) {
        return res.status(402).json({ error: 'monthly_limit', message: 'Tes 30 questions du mois sont épuisées. Passe au plan Sage.' });
      }
      await setCache(monthKey, String(currentCount + 1));
    }
  }

  try {
    const convertedHistory = convertHistoryForAI(history || []).slice(-12);
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...convertedHistory,
      { role: 'user', content: String(question).trim() }
    ];

    const response = await callGroq(messages, 900, 0.95);
    if (!response || !response.ok) return res.status(500).json({ error: 'ai_error', message: "Le Vieux est fatigué." });

    const data = await response.json();
    const answer = data.choices && data.choices[0] && data.choices[0].message.content;
    if (!answer) return res.status(500).json({ error: 'no_answer' });

    let freeRemaining = null;
    if (isFree) { try { const { data: fu } = await supabase.from('free_users').select('count').eq('email', key).maybeSingle(); freeRemaining = Math.max(0, FREE_LIMIT - ((fu && fu.count) || 0)); } catch (e) {} }

    return res.json({ answer: answer.trim(), isFree, freeRemaining });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// DAILY — Signe / Méditation / Rituel (avec pilier du jour)
// ══════════════════════════════════════════════════════════════════
app.post('/daily', async (req, res) => {
  const { email, type } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  const isSubscribed = !!plan;

  let allowed = false;
  if (plan) {
    if (type === 'evening') allowed = await getPermissionValue(key, 'evening');
    else if (type === 'meditation') allowed = await getPermissionValue(key, 'meditation');
    else allowed = await getPermissionValue(key, 'daily');
  } else {
    allowed = (type === 'morning' || type === 'meditation');
  }

  if (!allowed) return res.status(402).json({ error: 'subscription_required', message: 'Ce contenu est réservé aux abonnés.' });

  const dayKey = todayKey();
  const cacheKey = 'daily_' + dayKey + '_' + (type || 'morning');
  const pilier = getDayPilier();

  let prompt;
  if (type === 'evening') {
    prompt = `${SYSTEM_PROMPT}\n\nPilier du soir : ${pilier.label}.\nIdées à piocher :\n${pilier.ideas}\n\nDonne un rituel du soir concret. Format : 1) le rituel (2 phrases), 2) pourquoi ça marche (3 phrases), 3) comment le faire (2 phrases avec les ingrédients).`;
  } else if (type === 'meditation') {
    prompt = `${SYSTEM_PROMPT}\n\nPilier du matin : ${pilier.label}.\nIdées à piocher :\n${pilier.ideas}\n\nDonne une courte méditation du matin. Un geste simple à faire. 4 à 5 phrases.`;
  } else {
    prompt = `${SYSTEM_PROMPT}\n\nPilier du jour : ${pilier.label}.\nIdées à piocher :\n${pilier.ideas}\n\nDonne le signe ou la leçon du matin. Format : 1) le signe (2 phrases), 2) ce que ça veut dire (3 phrases), 3) ce que tu dois faire aujourd'hui (2 phrases).`;
  }

  try {
    let content = await generateWithCache(cacheKey, prompt, 1200, 0.95, '/daily ' + type);
    if (!content) content = "Aujourd'hui, regarde le premier oiseau que tu verras.\n\nCe que tu vois le matin parle. Les anciens le savaient.\n\nPrends 30 secondes pour écouter.";

    if (!isSubscribed) {
      const teaser = content.split('\n').slice(0, 2).join('\n');
      return res.json({ content, teaser, isTeaser: true });
    }
    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// TEACHING — Enseignement hebdo (pilier de la semaine)
// ══════════════════════════════════════════════════════════════════
app.post('/teaching', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  if (!plan) return res.status(402).json({ error: 'subscription_required' });
  const teachingAllowed = await getPermissionValue(key, 'teaching');
  if (!teachingAllowed) return res.status(402).json({ error: 'subscription_required' });

  const cacheKey = 'teaching_' + weekKey();
  const pilier = getWeekPilier();

  const prompt = `${SYSTEM_PROMPT}

PILIER DE LA SEMAINE : ${pilier.label}
THÈME : ${pilier.theme}

IDÉES À EXPLOITER :
${pilier.ideas}

Écris un ENSEIGNEMENT COMPLET de la semaine, à la manière du Vieux. Pas de blabla. Du concret.

FORMAT :
- Titre fort (une phrase qui marque)
- Introduction (3 phrases : le problème, la promesse, l'angle)
- 3 leçons numérotées (chacune : 3-4 phrases avec un exemple précis, un ingrédient, une situation du quotidien)
- Une action de la semaine (2 phrases : un geste à faire tous les jours)
- Conclusion (2 phrases : la parole du vieux)

Total : 400 à 500 mots. Français parlé, populaire. Tutoiement. Rituels concrets avec les ingrédients.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 2000, 0.95, '/teaching');
    if (!content) content = "L'ouverture de chemin\n\nÉcoute bien. Quand l'argent ne rentre pas, ce n'est pas toujours ta faute. Mais il y a des gestes à faire.\n\n1. Le sel dans l'eau. Chaque matin, jette une pincée de sel dans un verre d'eau. Tu bois. Tu dis merci. Ça lave l'intérieur.\n2. Le premier billet. Le premier argent de la journée, tu ne le dépenses pas tout de suite. Tu le gardes 24h. Tu le laisses dormir.\n3. La porte. Avant de sortir, tu touches le seuil. Tu dis : la route est ouverte.\n\nCette semaine : fais le sel chaque matin. 7 jours.\n\nCe que les anciens savaient, on ne l'oublie pas.";
    return res.json({ content, nextUpdate: 'weekly' });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

app.post('/teaching/archives', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const hasAccess = await hasPermission(key, 'archives');
  if (!hasAccess) return res.status(402).json({ error: 'subscription_required' });
  try {
    const { data } = await supabase.from('content_cache').select('cache_key, content, created_at').like('cache_key', 'teaching_%').order('created_at', { ascending: false }).limit(20);
    return res.json({ archives: data || [] });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════
// CHALLENGE — Défi (sur mesure pour Guide)
// ══════════════════════════════════════════════════════════════════
app.post('/challenge', async (req, res) => {
  const { email, custom, need } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();

  const hasAccess = await hasPermission(key, 'challenge');
  if (!hasAccess) return res.status(402).json({ error: 'subscription_required' });

  if (custom) {
    const canCustom = await hasPermission(key, 'customChallenge');
    if (!canCustom) return res.status(402).json({ error: 'custom_required' });
    if (!need || !need.trim()) return res.status(400).json({ error: 'need_required' });

    const prompt = `${SYSTEM_PROMPT}\n\nCrée un défi de 7 jours SUR MESURE pour quelqu'un qui t'a dit : "${need}".\n\nFormat : Titre fort, Introduction (2 phrases), Jour 1 à Jour 7 (1 geste concret par jour, 2 phrases), Conclusion (1 phrase).`;

    try {
      const response = await callGroq([{ role: 'user', content: prompt }], 1500, 0.95);
      if (!response || !response.ok) return res.status(500).json({ error: 'ai_error' });
      const data = await response.json();
      const content = data.choices && data.choices[0] && data.choices[0].message.content;
      return res.json({ content: content || '' });
    } catch (e) { return res.status(500).json({ error: 'ai_error' }); }
  }

  const cacheKey = 'challenge_' + weekKey();
  const pilier = getWeekPilier();
  const prompt = `${SYSTEM_PROMPT}\n\nDéfi de 7 jours sur le pilier : ${pilier.label}.\nIdées : ${pilier.ideas}\n\nFormat : Titre, Introduction (1 phrase), Jour 1 à Jour 7 (1 geste concret chacun), Conclusion. Écris en entier.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1500, 0.95, '/challenge');
    if (!content) content = "7 jours pour blinder\n\nJour 1 : Sel dans l'eau. Tu bois. Tu dis merci.\nJour 2 : Tu touches le seuil de ta porte avant de sortir.\nJour 3 : Tu ne réponds pas à la première provocation.\nJour 4 : Tu jettes le vieux pain ou les restes qui traînent.\nJour 5 : Tu marches 10 minutes dehors, sans téléphone.\nJour 6 : Tu appelles un ancien ou une ancienne.\nJour 7 : Tu relis tes notes et tu remercies.\n\nCe que tu fais 7 jours, ça devient ta force.";
    return res.json({ content, nextUpdate: 'weekly' });
  } catch (e) { return res.status(500).json({ error: 'ai_error' }); }
});

// ══════════════════════════════════════════════════════════════════
// LIBRARY — Conte (pilier du jour)
// ══════════════════════════════════════════════════════════════════
app.post('/library', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  const isSubscribed = !!plan;

  const libraryLevel = await getPermissionValue(key, 'library');
  const allowed = libraryLevel !== false && libraryLevel !== null;
  if (!allowed) return res.status(402).json({ error: 'subscription_required' });

  const cacheKey = (libraryLevel === 'weekly') ? 'library_week_' + weekKey() : 'library_' + todayKey();
  const pilier = getDayPilier();
  const dayNumber = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

  const prompt = `${SYSTEM_PROMPT}\n\nRaconte un conte africain authentique (jour ${dayNumber}).\nPilier : ${pilier.label}.\nIdées : ${pilier.ideas}\n\nFormat : Titre, conte (12 à 15 phrases) avec des animaux, des vieux, des éléments naturels. La morale (2 phrases) doit être liée au pilier.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 2000, 0.95, '/library');
    if (!content) content = "Le vieux et la rivière\n\nUn jeune homme vint voir un ancien, en colère contre la vie.\nL'ancien l'emmena au bord d'une rivière.\nLa rivière ne se plaint jamais. Elle contourne. Elle attend. Elle use.\nTa colère, c'est un rocher. Si tu le frappes, tu te blesses.\nSi tu l'uses par la patience, tu passes.\n\nMorale : Ce que la patience fait, la colère ne le fera jamais.";

    if (!isSubscribed) {
      const teaser = content.split('\n').slice(0, 4).join('\n');
      return res.json({ content, teaser, isTeaser: true });
    }
    const nextUpdate = (libraryLevel === 'weekly') ? 'weekly' : 'daily';
    return res.json({ content, nextUpdate });
  } catch (e) { return res.status(500).json({ error: 'ai_error' }); }
});

app.post('/library/archives', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const hasAccess = await hasPermission(key, 'archives');
  if (!hasAccess) return res.status(402).json({ error: 'subscription_required' });
  try {
    const { data } = await supabase.from('content_cache').select('cache_key, content, created_at').like('cache_key', 'library_%').order('created_at', { ascending: false }).limit(30);
    return res.json({ archives: data || [] });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

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
  console.log('🌳 Le Vieux backend v8.0.0 sur port ' + PORT);
  console.log('💾 Supabase : ' + (supabase ? '✓' : '❌'));
  console.log('📚 5 piliers chargés : Abondance, Protection, Santé, Signes, Sagesse');
});
