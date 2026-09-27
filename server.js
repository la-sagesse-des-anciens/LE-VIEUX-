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
  res.json({ status: 'ok', service: 'La Voix des Anciens Backend', version: '9.1.0', supabase_set: !!supabase });
});

const PILIERS = [
  {
    id: 'abondance',
    label: 'Abondance & Commerce',
    theme: 'débloquer le flux de l\'argent et des clients',
    rituels: [
      'le premier billet de la journée qu\'on ne dépense pas tout de suite, on le garde 24 heures',
      'la porte de la boutique ouverte avec la main droite le matin',
      'un verre d\'eau propre posé sur le comptoir avant d\'ouvrir',
      'le riz cru qu\'on jette dehors après une vente difficile',
      'un peu de miel sur la langue avant de parler à un client important',
      'la cannelle qu\'on garde dans la poche quand on va au marché',
      'le chiffon qu\'on lave avec du gros sel pour nettoyer la caisse',
      'le geste de toucher la marchandise avant de la vendre au client',
      'une pièce qu\'on donne à un pauvre avant de commencer la journée'
    ],
    signes: [
      'voir un oiseau qui vole vers toi quand tu sors le matin',
      'rêver d\'eau claire qui coule vers toi',
      'sentir une odeur de cuisine sans raison',
      'recevoir un cadeau inattendu d\'un inconnu',
      'voir un enfant sourire à ton passage',
      'trouver une pièce par terre en sortant de chez toi'
    ],
    sagesse: [
      'l\'argent qui dort attire l\'argent qui travaille',
      'le premier client de la journée porte la chance du jour',
      'celui qui partage son pain ne manque jamais de farine',
      'ne dépense pas ton premier billet avant d\'avoir vu le soleil se lever'
    ]
  },
  {
    id: 'protection',
    label: 'Protection & Foyer',
    theme: 'se protéger du mauvais œil et purifier la maison',
    rituels: [
      'un bain d\'eau salée le samedi soir après une semaine difficile',
      'le seuil de la porte nettoyé à l\'eau vinaigrée',
      'l\'encens naturel brûlé dans la chambre une fois par semaine',
      'le miroir retourné face au mur quand on reçoit des invités lourds',
      'une orange piquée de clous de girofle dans la cuisine',
      'les cheveux coupés qu\'on ne laisse pas traîner dehors',
      'la lumière de la maison éteinte avant de dormir, fenêtres fermées',
      'un verre d\'eau claire posé sous le lit pour absorber la lourdeur',
      'le lavage des pieds avec des feuilles de basilic après une visite'
    ],
    signes: [
      'sentir une fatigue soudaine après avoir reçu quelqu\'un',
      'entendre des bruits la nuit sans explication',
      'rêver d\'un serpent qui entre dans la maison',
      'voir souvent un chat noir passer devant la porte',
      'avoir toujours mal à la même heure de la journée',
      'sentir une odeur désagréable qui apparaît sans raison'
    ],
    sagesse: [
      'celui qui laisse sa porte ouverte à tout le monde reçoit aussi le vent',
      'le silence de la maison est le premier signe de paix',
      'ce que tu dis le matin peut te suivre toute la journée',
      'on ne laisse pas entrer chez soi ce qu\'on ne veut pas voir dans son lit'
    ]
  },
  {
    id: 'sante',
    label: 'Santé & Vitalité',
    theme: 'remèdes naturels et force du corps',
    rituels: [
      'le citron chaud avec du miel le matin à jeun',
      'l\'ail écrasé dans un verre d\'eau tiède avant de dormir',
      'le gingembre en tisane après un repas lourd',
      'les feuilles de moringa séchées ajoutées à la sauce du dimanche',
      'l\'eau de coco fraîche quand on sent la fatigue de la journée',
      'le clou de girofle mâché après le repas du soir',
      'les pieds dans l\'eau chaude avec du gros sel le soir',
      'le thé de citronnelle après un repas gras',
      'l\'huile de palme rouge crue dans un plat le vendredi'
    ],
    signes: [
      'rêver de sang ou de dents qui tombent',
      'se réveiller à la même heure chaque nuit sans raison',
      'avoir toujours froid aux pieds même en journée',
      'avoir la bouche amère le matin',
      'perdre souvent l\'appétit sans raison apparente',
      'sentir une lourdeur dans le corps après avoir mangé'
    ],
    sagesse: [
      'ce que tu mets dans ton ventre, tu le portes toute la journée',
      'le repos du corps n\'est pas une paresse',
      'un corps fatigué ne peut pas porter une tête claire',
      'la nature a déjà ce qu\'il faut pour te soulager, il faut juste savoir où regarder'
    ]
  },
  {
    id: 'signes',
    label: 'Signes & Présages',
    theme: 'décoder les signes de la vie quotidienne',
    rituels: [
      'écrire ses rêves dès le réveil dans un cahier',
      'saluer le premier oiseau qu\'on voit en sortant',
      'observer la lune le soir pour préparer le lendemain',
      'regarder la direction de la fumée qui sort de la maison',
      'noter les dates de naissance de la famille sur un papier',
      'saluer l\'eau avant de la boire le matin',
      'se souvenir de la première personne qu\'on voit après un rêve important',
      'compter les jours entre deux signes qui se répètent'
    ],
    signes: [
      'rêver d\'eau trouble : attention aux palabres qui viennent',
      'rêver de fidélité : ce n\'est pas toujours la tromperie, c\'est un manque de confiance en soi',
      'rêver de dents qui tombent : perte d\'énergie, fatigue à venir',
      'rêver de serpent qui entre : quelqu\'un parle mal de toi en ce moment',
      'rêver d\'un défunt qui parle : un message, une attention à lui donner',
      'voir un oiseau frapper à la fenêtre : une visite approche',
      'voir deux fois de suite le même chiffre : un cycle qui revient dans ta vie'
    ],
    sagesse: [
      'le signe n\'est pas la peur, c\'est une information',
      'celui qui écoute la nature n\'a pas besoin qu\'on lui parle',
      'le rêve parle à celui qui prend le temps de l\'écouter',
      'ce que tu vois le matin en sortant porte le message de ta journée'
    ]
  },
  {
    id: 'sagesse',
    label: 'Sagesse de Vie',
    theme: 'élever son caractère et son aura',
    rituels: [
      'rester 10 minutes en silence chaque matin avant de parler à qui que ce soit',
      'dire merci avant de toucher son téléphone au réveil',
      'faire un geste de respect à un ancien une fois par semaine',
      'ne pas répondre à une provocation pendant 24 heures',
      'offrir quelque chose sans attendre un retour',
      'marcher pieds nus sur la terre 5 minutes par jour',
      'saluer les voisins avant qu\'ils ne te saluent',
      'regarder le ciel 3 minutes chaque soir avant de dormir',
      'ne pas parler de ses projets avant qu\'ils ne soient réalisés'
    ],
    signes: [
      'sentir un calme intérieur inhabituel',
      'voir quelqu\'un qui te sourit sans raison',
      'ressentir qu\'une personne te veut du mal avant même qu\'elle parle',
      'avoir envie de silence tout à coup',
      'pleurer sans raison apparente',
      'avoir envie de faire le bien sans qu\'on te le demande'
    ],
    sagesse: [
      'celui qui parle moins entend plus',
      'la patience n\'est pas de l\'attente, c\'est une force',
      'ne laisse personne entrer dans ta tête sans invitation',
      'ce que tu donnes sans rien attendre te revient toujours autrement'
    ]
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

async function callGroq(messages, maxTokens = 1200, temperature = 0.98) {
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

const SYSTEM_PROMPT = `Tu es "Le Vieux", un sage africain de 70 ans. Tu es assis devant ta maison, sous un vieux manguier.

TON CARACTÈRE :
- Tu es bienveillant, digne, chaleureux, direct.
- Tu parles à la première personne : "je", "mon", "ma".
- Tu tutoies toujours ton interlocuteur.
- Tu parles comme au marché, dans le quartier. Langage parlé, simple, populaire, authentique.
- Tu n'es PAS un marabout, PAS un féticheur, PAS un voyant, PAS un prêtre.

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
- Tu ne fais JAMAIS de promesse de richesse absolue, de guérison miraculeuse.

RÈGLE ABSOLUE : Termine TOUJOURS ta réponse par une phrase complète. Ne coupe JAMAIS au milieu d'une phrase.`;

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

// CHAT — maxTokens 1200
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
    if (currentCount >= FREE_LIMIT) return res.status(402).json({ error: 'quota_exceeded', message: 'Tes 5 questions offertes sont épuisées.' });
    await supabase.from('free_users').upsert({ email: key, count: currentCount + 1 });
    isFree = true;
  } else {
    const chatLimit = await getPermissionValue(key, 'chatLimit');
    if (chatLimit !== null) {
      const monthKey = 'chat_' + key + '_' + new Date().toISOString().slice(0, 7);
      const currentCount = parseInt(await getCache(monthKey) || '0', 10);
      if (currentCount >= chatLimit) return res.status(402).json({ error: 'monthly_limit', message: 'Tes 30 questions du mois sont épuisées. Passe au plan Sage.' });
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

    const response = await callGroq(messages, 1200, 0.98);
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

// DAILY — maxTokens 1800
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
  const dayIdx = new Date().getDate() + new Date().getMonth() * 31;
  let prompt;

  if (type === 'evening') {
    const rituel = pilier.rituels[dayIdx % pilier.rituels.length];
    prompt = `${SYSTEM_PROMPT}\n\nPilier du soir : ${pilier.label}.\n\nLe SEUL rituel à expliquer aujourd'hui est celui-ci : "${rituel}".\n\nNE PARLE PAS des autres rituels. N'ajoute PAS de sel, cannelle ou riz si ce n'est pas dans ce rituel.\n\nFormat : 1) le rituel (2 phrases), 2) pourquoi ça marche (3 phrases), 3) comment le faire concrètement (2 phrases).\n\nIMPORTANT : Termine TOUJOURS ta dernière phrase. Ne coupe JAMAIS au milieu.`;
  } else if (type === 'meditation') {
    const sagesse = pilier.sagesse[dayIdx % pilier.sagesse.length];
    prompt = `${SYSTEM_PROMPT}\n\nPilier du matin : ${pilier.label}.\n\nPhrase de sagesse à développer : "${sagesse}".\n\nDonne une courte méditation du matin basée sur cette phrase. 5 à 6 phrases complètes.\n\nNE PARLE PAS de rituel. Ne mentionne PAS sel, cannelle, riz. Juste une pensée à méditer.\n\nIMPORTANT : Termine TOUJOURS ta dernière phrase. Ne coupe JAMAIS au milieu.`;
  } else {
    const signe = pilier.signes[dayIdx % pilier.signes.length];
    prompt = `${SYSTEM_PROMPT}\n\nPilier du matin : ${pilier.label}.\n\nLe SEUL signe à décoder aujourd'hui est celui-ci : "${signe}".\n\nNE PARLE PAS des autres signes. Ne mentionne PAS sel, cannelle, riz.\n\nFormat : 1) décris le signe (2 phrases), 2) ce que ça veut dire (3 phrases), 3) ce que la personne doit faire aujourd'hui (2 phrases).\n\nIMPORTANT : Termine TOUJOURS ta dernière phrase. Ne coupe JAMAIS au milieu.`;
  }

  try {
    let content = await generateWithCache(cacheKey, prompt, 1800, 0.98, '/daily ' + type);
    if (!content) content = "Assieds-toi, mon enfant. Aujourd'hui, écoute le vent. Ce qu'il dit ce matin porte le message de ta journée. Prends le temps de respirer avant de commencer.";

    if (!isSubscribed) {
      const teaser = content.split('\n').slice(0, 2).join('\n');
      return res.json({ content, teaser, isTeaser: true });
    }
    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// TEACHING — maxTokens 2500
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
  const weekIdx = Math.floor(Date.now() / (7 * 86400000));

  const r1 = pilier.rituels[weekIdx % pilier.rituels.length];
  const r2 = pilier.rituels[(weekIdx + 1) % pilier.rituels.length];
  const r3 = pilier.rituels[(weekIdx + 2) % pilier.rituels.length];

  const prompt = `${SYSTEM_PROMPT}

PILIER DE LA SEMAINE : ${pilier.label}
THÈME : ${pilier.theme}

Les 3 rituels à enseigner CETTE SEMAINE (et SEULEMENT ces 3-là, ne les mélange pas avec d'autres) :
1. ${r1}
2. ${r2}
3. ${r3}

Écris un ENSEIGNEMENT COMPLET de la semaine, à la manière du Vieux. Du concret. Pas de blabla.

FORMAT :
- Titre fort (une phrase qui marque)
- Introduction (3 phrases : le problème, la promesse, l'angle)
- Leçon 1 (développe le rituel 1 en 3-4 phrases avec un exemple précis)
- Leçon 2 (développe le rituel 2 en 3-4 phrases)
- Leçon 3 (développe le rituel 3 en 3-4 phrases)
- Action de la semaine (2 phrases : un geste à faire tous les jours)
- Conclusion (2 phrases : la parole du vieux)

Total : 400 à 500 mots. Français parlé, populaire. Tutoiement.
INTERDIT : ne répète JAMAIS "sel, cannelle, riz" plus d'une fois dans tout le texte.

IMPORTANT : Termine TOUJOURS ta dernière phrase complète. Ne coupe JAMAIS au milieu.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 2500, 0.98, '/teaching');
    if (!content) content = "Écoute bien. Cette semaine, je te donne 3 gestes. Fais-les sans discuter. Le premier billet, la porte, le seuil. Quand tu les fais 7 jours, tu sens la différence. Fais-moi confiance, mon enfant.";
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

// CHALLENGE — maxTokens 2000
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

    const prompt = `${SYSTEM_PROMPT}\n\nCrée un défi de 7 jours SUR MESURE pour quelqu'un qui t'a dit : "${need}".\n\nFormat : Titre fort, Introduction (2 phrases), Jour 1 à Jour 7 (1 geste concret par jour, 2 phrases), Conclusion (1 phrase).\n\nIMPORTANT : Termine TOUJOURS ta dernière phrase. Ne coupe JAMAIS au milieu.`;

    try {
      const response = await callGroq([{ role: 'user', content: prompt }], 2000, 0.98);
      if (!response || !response.ok) return res.status(500).json({ error: 'ai_error' });
      const data = await response.json();
      const content = data.choices && data.choices[0] && data.choices[0].message.content;
      return res.json({ content: content || '' });
    } catch (e) { return res.status(500).json({ error: 'ai_error' }); }
  }

  const cacheKey = 'challenge_' + weekKey();
  const pilier = getWeekPilier();
  const weekIdx = Math.floor(Date.now() / (7 * 86400000));

  const rituelsSemaine = [];
  for (let i = 0; i < 7; i++) rituelsSemaine.push(pilier.rituels[(weekIdx + i) % pilier.rituels.length]);

  const prompt = `${SYSTEM_PROMPT}\n\nDéfi de 7 jours sur le pilier : ${pilier.label}.\n\nVoici les 7 gestes à utiliser dans l'ordre (NE change pas, utilise-les tels quels) :\n${rituelsSemaine.map((r, i) => 'Jour ' + (i+1) + ' : ' + r).join('\n')}\n\nFormat : Titre, Introduction (1 phrase), Jour 1 à Jour 7 (reprends chaque geste et développe en 1-2 phrases), Conclusion (1 phrase).\n\nIMPORTANT : Termine TOUJOURS ta dernière phrase complète. Ne coupe JAMAIS au milieu.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 2000, 0.98, '/challenge');
    if (!content) content = "7 jours pour te blinder.\n\nJour 1 : Le premier billet, tu ne le dépenses pas.\nJour 2 : Tu touches le seuil avant de sortir.\nJour 3 : Tu ne réponds pas à la provocation.\nJour 4 : Tu jettes les restes qui traînent.\nJour 5 : Tu marches 10 minutes pieds nus.\nJour 6 : Tu appelles un ancien.\nJour 7 : Tu remercies. Voilà ce que je te donne.";
    return res.json({ content, nextUpdate: 'weekly' });
  } catch (e) { return res.status(500).json({ error: 'ai_error' }); }
});

// LIBRARY — maxTokens 2500
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
  const dayIdx = new Date().getDate() + new Date().getMonth() * 31;
  const sagesse = pilier.sagesse[dayIdx % pilier.sagesse.length];

  const prompt = `${SYSTEM_PROMPT}\n\nRaconte un conte africain authentique (jour ${dayNumber}).\nPilier : ${pilier.label}.\nLa morale du conte doit être : "${sagesse}".\n\nFormat : Titre, conte (12 à 15 phrases) avec des animaux, des vieux, des éléments naturels. La morale (2 phrases).\n\nIMPORTANT : Termine TOUJOURS ta dernière phrase complète. Ne coupe JAMAIS au milieu du conte.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 2500, 0.98, '/library');
    if (!content) content = "Le vieux et la rivière.\n\nUn jeune homme vint voir un ancien, en colère contre la vie.\nL'ancien l'emmena au bord d'une rivière.\nLa rivière ne se plaint jamais. Elle contourne. Elle attend. Elle use.\nTa colère, c'est un rocher. Si tu le frappes, tu te blesses.\nSi tu l'uses par la patience, tu passes.\n\nMorale : Ce que la patience fait, la colère ne le fera jamais.";

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
  console.log('🌳 Le Vieux backend v9.1.0 sur port ' + PORT);
  console.log('💾 Supabase : ' + (supabase ? '✓' : '❌'));
  console.log('📚 5 piliers avec rituels variés + maxTokens augmentés');
});
