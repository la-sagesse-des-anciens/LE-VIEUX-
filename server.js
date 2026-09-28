const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
const ADMIN_PWD = process.env.ADMIN_PWD || 'levieux2026';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

const GROQ_MODEL = 'openai/gpt-oss-120b';

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

const FREE_LIMIT = 10;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'La Voix des Anciens Backend',
    version: '12.2.0',
    model: GROQ_MODEL,
    freeLimit: FREE_LIMIT,
    tts: ELEVENLABS_API_KEY ? 'elevenlabs' : 'browser',
    supabase_set: !!supabase
  });
});

const PILIERS = [
  {
    id: 'abondance',
    label: 'Abondance & Commerce',
    rituels: [
      'Le premier billet de la journée, tu ne le dépenses pas tout de suite. Tu le gardes 24 heures.',
      'Le matin, tu ouvres ta porte avec la main droite.',
      'Avant d\'ouvrir ta boutique, tu poses un verre d\'eau propre sur le comptoir.',
      'Après une vente difficile, tu jettes une poignée de riz cru dehors.',
      'Avant de parler à un client important, tu passes un peu de miel sur ta langue.',
      'Quand tu vas au marché, tu gardes un bâton de cannelle dans ta poche.',
      'Tu laves ton chiffon de caisse avec du gros sel.',
      'Avant de vendre une marchandise, tu la touches avec la main droite.',
      'Avant de commencer ta journée, tu donnes une pièce à quelqu\'un qui en a besoin.'
    ],
    signes: [
      'Quand tu sors le matin, si un oiseau vole vers toi, c\'est un bon signe.',
      'Si tu rêves d\'eau claire qui coule vers toi, l\'argent arrive bientôt.',
      'Si tu sens une odeur de cuisine sans raison, quelqu\'un pense à toi.',
      'Recevoir un cadeau d\'un inconnu, c\'est un signe de chance.',
      'Si un enfant te sourit au passage, ta journée sera bonne.',
      'Trouver une pièce par terre en sortant, c\'est le flux qui s\'ouvre.'
    ],
    sagesse: [
      'L\'argent qui dort attire l\'argent qui travaille. Ne laisse pas ton argent s\'endormir.',
      'Le premier client de la journée porte la chance des autres. Reçois-le bien.',
      'Celui qui partage son pain ne manque jamais de farine.',
      'Ne dépense pas ton premier billet avant d\'avoir vu le soleil se lever.'
    ]
  },
  {
    id: 'protection',
    label: 'Protection & Foyer',
    rituels: [
      'Le samedi soir, après une semaine difficile, tu prends un bain d\'eau salée.',
      'Tu nettoies le seuil de ta porte avec de l\'eau vinaigrée.',
      'Une fois par semaine, tu brûles de l\'encens naturel dans ta chambre.',
      'Quand tu reçois quelqu\'un de lourd, tu retournes ton miroir face au mur.',
      'Dans ta cuisine, tu piques une orange avec des clous de girofle.',
      'Tu ne laisses pas tes cheveux coupés traîner dehors.',
      'Avant de dormir, tu éteins la lumière et tu fermes les fenêtres.',
      'Sous ton lit, tu poses un verre d\'eau claire pour absorber la lourdeur.',
      'Après une visite, tu laves tes pieds avec des feuilles de basilic.'
    ],
    signes: [
      'Si tu sens une fatigue soudaine après avoir reçu quelqu\'un, c\'est un signe.',
      'Si tu entends des bruits la nuit sans explication, veille.',
      'Si tu rêves d\'un serpent qui entre dans la maison, quelqu\'un te veut du mal.',
      'Si un chat noir passe souvent devant ta porte, fais attention.',
      'Si tu as toujours mal à la même heure, c\'est un signal.',
      'Si une odeur désagréable apparaît sans raison, purifie ta maison.'
    ],
    sagesse: [
      'Celui qui laisse sa porte ouverte à tout le monde reçoit aussi le vent.',
      'Le silence de la maison est le premier signe de paix.',
      'Ce que tu dis le matin peut te suivre toute la journée. Parle bien.',
      'On ne laisse pas entrer chez soi ce qu\'on ne veut pas voir dans son lit.'
    ]
  },
  {
    id: 'sante',
    label: 'Santé & Vitalité',
    rituels: [
      'Le matin à jeun, tu bois un citron chaud avec du miel.',
      'Avant de dormir, tu écrases une gousse d\'ail dans un verre d\'eau tiède.',
      'Après un repas lourd, tu prends une tisane de gingembre.',
      'Le dimanche, tu ajoutes des feuilles de moringa séchées dans ta sauce.',
      'Quand tu sens la fatigue, tu bois de l\'eau de coco fraîche.',
      'Après le repas du soir, tu mâches un clou de girofle.',
      'Le soir, tu trempes tes pieds dans de l\'eau chaude avec du gros sel.',
      'Après un repas gras, tu bois un thé de citronnelle.',
      'Le vendredi, tu manges un plat à l\'huile de palme rouge crue.'
    ],
    signes: [
      'Si tu rêves de sang ou de dents qui tombent, ton corps te parle.',
      'Si tu te réveilles à la même heure chaque nuit, écoute ton corps.',
      'Si tu as toujours froid aux pieds, ton sang circule mal.',
      'Si tu as la bouche amère le matin, ton foie travaille trop.',
      'Si tu perds l\'appétit sans raison, repose-toi.',
      'Si tu sens une lourdeur après avoir mangé, allège ton repas.'
    ],
    sagesse: [
      'Ce que tu mets dans ton ventre, tu le portes toute la journée.',
      'Le repos du corps n\'est pas une paresse.',
      'Un corps fatigué ne peut pas porter une tête claire.',
      'La nature a déjà ce qu\'il faut pour te soulager. Regarde autour de toi.'
    ]
  },
  {
    id: 'signes',
    label: 'Signes & Présages',
    rituels: [
      'Dès ton réveil, tu écris tes rêves dans un cahier.',
      'En sortant, tu salues le premier oiseau que tu vois.',
      'Le soir, tu observes la lune pour préparer le lendemain.',
      'Tu regardes la direction de la fumée qui sort de ta maison.',
      'Tu notes les dates de naissance de ta famille sur un papier.',
      'Le matin, tu salues l\'eau avant de la boire.',
      'Après un rêve important, tu retiens la première personne que tu vois.',
      'Tu comptes les jours entre deux signes qui se répètent.'
    ],
    signes: [
      'Si tu rêves d\'eau trouble, attention aux palabres qui viennent.',
      'Si tu rêves de fidélité, ce n\'est pas la tromperie. C\'est un manque de confiance en toi.',
      'Si tu rêves de dents qui tombent, tu perds de l\'énergie.',
      'Si tu rêves d\'un serpent qui entre, quelqu\'un parle mal de toi.',
      'Si un défunt te parle en rêve, c\'est un message.',
      'Si un oiseau frappe à ta fenêtre, une visite approche.',
      'Si tu vois deux fois le même chiffre, un cycle revient.'
    ],
    sagesse: [
      'Le signe n\'est pas la peur, c\'est une information.',
      'Celui qui écoute la nature n\'a pas besoin qu\'on lui parle.',
      'Le rêve parle à celui qui prend le temps de l\'écouter.',
      'Ce que tu vois le matin en sortant porte le message de ta journée.'
    ]
  },
  {
    id: 'sagesse',
    label: 'Sagesse de Vie',
    rituels: [
      'Chaque matin, tu restes 10 minutes en silence avant de parler.',
      'Au réveil, tu dis merci avant de toucher ton téléphone.',
      'Une fois par semaine, tu fais un geste de respect à un ancien.',
      'Quand on te provoque, tu ne réponds pas pendant 24 heures.',
      'Tu offres quelque chose sans attendre un retour.',
      'Chaque jour, tu marches pieds nus sur la terre 5 minutes.',
      'Tu salues tes voisins avant qu\'ils ne te saluent.',
      'Chaque soir, tu regardes le ciel 3 minutes avant de dormir.',
      'Tu ne parles pas de tes projets avant qu\'ils ne soient réalisés.'
    ],
    signes: [
      'Si tu sens un calme intérieur inhabituel, tu es sur le bon chemin.',
      'Si quelqu\'un te sourit sans raison, ton aura attire.',
      'Si tu sens qu\'une personne te veut du mal, écarte-toi d\'elle.',
      'Si tu as envie de silence tout à coup, écoute ce besoin.',
      'Si tu pleures sans raison, libère ce qui est lourd.',
      'Si tu as envie de faire le bien, tu grandis.'
    ],
    sagesse: [
      'Celui qui parle moins entend plus.',
      'La patience n\'est pas de l\'attente, c\'est une force.',
      'Ne laisse personne entrer dans ta tête sans invitation.',
      'Ce que tu donnes sans rien attendre te revient toujours autrement.'
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

async function callGroq(messages, maxTokens = 2000, temperature = 0.95) {
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

const SYSTEM_PROMPT = `Tu es "Le Vieux", un sage africain de 70 ans assis sous un vieux manguier.

RÈGLE ABSOLUE : tu t'adresses DIRECTEMENT à la personne avec "tu", "toi", "ton", "ta". Tu ne dis jamais "je pense". Tu parles à l'autre, pas de toi.

STYLE : français parlé simple, comme au marché. Phrases courtes de 10-15 mots. Mots de la rue : "poisse", "blinder", "laver l'intérieur", "lourdeur", "palabres".

VOCABULAIRE NOBLE (utilise ces tournures quand tu parles de sagesse ancienne) :
- "la tradition ancestrale" (jamais "tradition" tout seul)
- "la sagesse des anciens"
- "la tradition des siècles"
- "le savoir ancestral"
- "ce que les anciens savaient"

INTERDIT ABSOLU :
- Ne JAMAIS dire "ancêtre" ou "ancêtres"
- Ne JAMAIS dire "nos ancêtres"
- Toujours dire "les anciens" à la place

MOTS INTERDITS : "guérir", "magie", "sortilège", "marabout", "féticheur", "envoûtement", "sorcellerie".
À DIRE : "soulager", "purifier", "sagesse ancienne", "tradition ancestrale", "débloquer", "prospérité".

RÈGLE DE FIN : chaque phrase est complète, jamais coupée au milieu.`;

app.post('/me', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const sub = await getSubscription(key);

  let freeCount = 0;
  try { const { data } = await supabase.from('free_users').select('count').eq('email', key).maybeSingle(); freeCount = (data && data.count) || 0; } catch (e) {}

  if (!sub || sub.expired) {
    return res.json({
      email: key,
      subscribed: false,
      expired: sub ? sub.expired : false,
      plan: null,
      freeRemaining: Math.max(0, FREE_LIMIT - freeCount),
      freeLimit: FREE_LIMIT,
      permissions: PLAN_PERMISSIONS.decouverte
    });
  }

  const daysLeft = Math.ceil((sub.expiry_date - Date.now()) / 86400000);
  const planLabels = { decouverte: 'Découverte', sage: 'Sage', guide: 'Guide' };
  const plan = sub.plan || 'decouverte';

  let monthlyUsed = 0;
  const monthlyLimit = (PLAN_PERMISSIONS[plan] && PLAN_PERMISSIONS[plan].chatLimit !== undefined)
    ? PLAN_PERMISSIONS[plan].chatLimit
    : null;

  if (monthlyLimit !== null && supabase) {
    const monthKey = 'chat_' + key + '_' + new Date().toISOString().slice(0, 7);
    try {
      const { data } = await supabase.from('content_cache').select('content').eq('cache_key', monthKey).maybeSingle();
      monthlyUsed = parseInt((data && data.content) || '0', 10);
    } catch (e) {}
  }

  return res.json({
    email: key,
    subscribed: true,
    expired: false,
    plan: plan,
    planLabel: planLabels[plan] || 'Découverte',
    expiryDate: sub.expiry_date,
    daysLeft: daysLeft,
    monthlyUsed: monthlyUsed,
    monthlyLimit: monthlyLimit,
    monthlyRemaining: monthlyLimit !== null ? Math.max(0, monthlyLimit - monthlyUsed) : null,
    permissions: PLAN_PERMISSIONS[plan] || PLAN_PERMISSIONS.decouverte
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

app.post('/tts', async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Texte requis' });
  if (!ELEVENLABS_API_KEY) return res.status(503).json({ error: 'tts_not_configured' });

  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + ELEVENLABS_VOICE_ID + '?output_format=mp3_44100_128',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: String(text).slice(0, 2500),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.80,
            style: 0.35,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('ElevenLabs error:', response.status, err.slice(0, 300));
      return res.status(response.status).json({ error: 'elevenlabs_error', detail: err.slice(0, 200) });
    }

    const arrayBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(arrayBuffer));
  } catch (e) {
    console.error('TTS error:', e.message);
    res.status(500).json({ error: 'tts_server_error', message: e.message });
  }
});

app.post('/preload', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  if (!plan) return res.json({ preloaded: false });

  res.json({ preloaded: true, message: 'Préchargement lancé en arrière-plan' });

  const pilier = getDayPilier();
  const dayIdx = new Date().getDate() + new Date().getMonth() * 31;
  const dayKey = todayKey();
  const weekK = weekKey();
  const weekIdx = Math.floor(Date.now() / (7 * 86400000));

  const signe = pilier.signes[dayIdx % pilier.signes.length];
  const promptMorning = `${SYSTEM_PROMPT}\n\nPilier : ${pilier.label}.\nSigne : "${signe}"\n\nÉcris 6 phrases en tutoyant. Phrases courtes et complètes.`;
  generateWithCache('daily_' + dayKey + '_morning', promptMorning, 1500, 0.95, '/preload morning').catch(() => {});

  const sagesse = pilier.sagesse[dayIdx % pilier.sagesse.length];
  const promptMed = `${SYSTEM_PROMPT}\n\nPilier : ${pilier.label}.\nSagesse : "${sagesse}"\n\nÉcris 5 phrases en tutoyant. Phrases courtes et complètes.`;
  generateWithCache('daily_' + dayKey + '_meditation', promptMed, 1500, 0.95, '/preload meditation').catch(() => {});

  const rituel = pilier.rituels[dayIdx % pilier.rituels.length];
  const promptEve = `${SYSTEM_PROMPT}\n\nPilier : ${pilier.label}.\nRituel : "${rituel}"\n\nÉcris 6 phrases en tutoyant. Phrases courtes et complètes.`;
  generateWithCache('daily_' + dayKey + '_evening', promptEve, 1500, 0.95, '/preload evening').catch(() => {});

  const r1 = pilier.rituels[weekIdx % pilier.rituels.length];
  const r2 = pilier.rituels[(weekIdx + 1) % pilier.rituels.length];
  const r3 = pilier.rituels[(weekIdx + 2) % pilier.rituels.length];
  const promptTeach = `${SYSTEM_PROMPT}\n\nPilier : ${pilier.label}.\n\nGestes :\n1. ${r1}\n2. ${r2}\n3. ${r3}\n\nÉcris : Titre, Intro (2 phrases), Leçon 1 (3 phrases), Leçon 2 (3 phrases), Leçon 3 (3 phrases), Action (2 phrases), Conclusion (2 phrases). Tutoiement partout.`;
  generateWithCache('teaching_' + weekK, promptTeach, 2000, 0.95, '/preload teaching').catch(() => {});

  const rituelsSemaine = [];
  for (let i = 0; i < 7; i++) rituelsSemaine.push(pilier.rituels[(weekIdx + i) % pilier.rituels.length]);
  const promptChall = `${SYSTEM_PROMPT}\n\nPilier : ${pilier.label}.\n\nGestes :\n${rituelsSemaine.map((r, i) => 'Jour ' + (i+1) + ' : ' + r).join('\n')}\n\nÉcris : Titre, 7 jours (1 phrase par jour), Conclusion. Tutoiement.`;
  generateWithCache('challenge_' + weekK, promptChall, 2000, 0.95, '/preload challenge').catch(() => {});

  const promptLib = `${SYSTEM_PROMPT}\n\nConte africain.\nPilier : ${pilier.label}.\nMorale : "${sagesse}"\n\nÉcris : Titre, 8 phrases de conte, 2 phrases de morale avec "tu". Phrases courtes.`;
  generateWithCache('library_' + dayKey, promptLib, 2000, 0.95, '/preload library').catch(() => {});
});

app.post('/ask', async (req, res) => {
  const { email, question, history } = req.body || {};
  if (!email || !question) return res.status(400).json({ error: 'Email requis' });
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'config_error' });

  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  const isSubscribed = !!plan;

  let isFree = false;
  let freeRemaining = null;
  let monthlyRemaining = null;

  if (!isSubscribed) {
    let freeUser = null;
    try { const { data } = await supabase.from('free_users').select('*').eq('email', key).maybeSingle(); freeUser = data; } catch (e) {}
    const currentCount = (freeUser && freeUser.count) || 0;
    if (currentCount >= FREE_LIMIT) return res.status(402).json({ error: 'quota_exceeded', message: 'Tes ' + FREE_LIMIT + ' questions offertes sont épuisées.' });
    await supabase.from('free_users').upsert({ email: key, count: currentCount + 1 });
    isFree = true;
    freeRemaining = Math.max(0, FREE_LIMIT - (currentCount + 1));
  } else {
    const chatLimit = await getPermissionValue(key, 'chatLimit');
    if (chatLimit !== null) {
      const monthKey = 'chat_' + key + '_' + new Date().toISOString().slice(0, 7);
      const currentCount = parseInt(await getCache(monthKey) || '0', 10);
      if (currentCount >= chatLimit) {
        return res.status(402).json({
          error: 'monthly_limit',
          message: 'Tes ' + chatLimit + ' questions du mois sont épuisées. Passe au plan Sage.',
          monthlyUsed: currentCount,
          monthlyLimit: chatLimit,
          monthlyRemaining: 0
        });
      }
      const newCount = currentCount + 1;
      await setCache(monthKey, String(newCount));
      monthlyRemaining = Math.max(0, chatLimit - newCount);
    }
  }

  try {
    const convertedHistory = convertHistoryForAI(history || []).slice(-12);
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...convertedHistory,
      { role: 'user', content: String(question).trim() }
    ];

    const response = await callGroq(messages, 1500, 0.95);
    if (!response || !response.ok) return res.status(500).json({ error: 'ai_error', message: "Le Vieux est fatigué." });

    const data = await response.json();
    const answer = data.choices && data.choices[0] && data.choices[0].message.content;
    if (!answer) return res.status(500).json({ error: 'no_answer' });

    return res.json({
      answer: answer.trim(),
      isFree: isFree,
      freeRemaining: freeRemaining,
      monthlyRemaining: monthlyRemaining
    });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
});

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
    prompt = `${SYSTEM_PROMPT}\n\nPilier : ${pilier.label}.\nRituel : "${rituel}"\n\nÉcris 6 phrases en tutoyant. Phrases courtes et complètes.`;
  } else if (type === 'meditation') {
    const sagesse = pilier.sagesse[dayIdx % pilier.sagesse.length];
    prompt = `${SYSTEM_PROMPT}\n\nPilier : ${pilier.label}.\nSagesse : "${sagesse}"\n\nÉcris 5 phrases en tutoyant. Phrases courtes et complètes.`;
  } else {
    const signe = pilier.signes[dayIdx % pilier.signes.length];
    prompt = `${SYSTEM_PROMPT}\n\nPilier : ${pilier.label}.\nSigne : "${signe}"\n\nÉcris 6 phrases en tutoyant. Phrases courtes et complètes.`;
  }

  try {
    let content = await generateWithCache(cacheKey, prompt, 1500, 0.95, '/daily ' + type);
    if (!content) content = "Assieds-toi, mon enfant. Écoute le vent ce matin. Il porte le message de ta journée. Prends le temps de respirer avant de commencer.";

    if (!isSubscribed) {
      if (type === 'morning') {
        return res.json({ content });
      }
      if (type === 'meditation') {
        const teaser = content.split('\n').slice(0, 2).join('\n');
        return res.json({ content: teaser, teaser, isTeaser: true });
      }
      return res.status(402).json({ error: 'subscription_required' });
    }

    return res.json({ content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

app.post('/teaching', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);

  if (!plan) {
    const cacheKeyFree = 'teaching_' + weekKey();
    const cachedFree = await getCache(cacheKeyFree);
    const teaserText = cachedFree
      ? cachedFree.split('\n').slice(0, 5).join('\n')
      : 'Cette semaine, écoute bien. Les 3 gestes que je vais te donner sont simples mais puissants.';
    return res.json({ content: teaserText, teaser: teaserText, isTeaser: true, freeTeaser: true });
  }

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

Gestes :
1. ${r1}
2. ${r2}
3. ${r3}

Écris : Titre, Intro (2 phrases), Leçon 1 (3 phrases), Leçon 2 (3 phrases), Leçon 3 (3 phrases), Action (2 phrases), Conclusion (2 phrases). Tutoiement partout.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 2000, 0.95, '/teaching');
    if (!content) content = "Cette semaine, tu vas apprendre 3 gestes.\n\nLe premier billet, tu ne le dépenses pas tout de suite.\nLa porte, tu l'ouvres avec la main droite le matin.\nLe seuil, tu le touches avant de sortir.\n\nFais-les 7 jours. Tu sentiras la différence dans ton argent et dans ta paix.";
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

    const prompt = `${SYSTEM_PROMPT}\n\nDéfi 7 jours pour : "${need}"\n\nÉcris : Titre, Intro (1 phrase), Jour 1 à 7 (1 phrase par jour), Conclusion (1 phrase). Tutoiement.`;

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
  const weekIdx = Math.floor(Date.now() / (7 * 86400000));

  const rituelsSemaine = [];
  for (let i = 0; i < 7; i++) rituelsSemaine.push(pilier.rituels[(weekIdx + i) % pilier.rituels.length]);

  const prompt = `${SYSTEM_PROMPT}\n\nDéfi 7 jours sur : ${pilier.label}\n\nGestes :\n${rituelsSemaine.map((r, i) => 'Jour ' + (i+1) + ' : ' + r).join('\n')}\n\nÉcris : Titre, 7 jours (1 phrase par jour), Conclusion. Tutoiement.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1500, 0.95, '/challenge');
    if (!content) content = "7 jours pour te blinder.\n\nJour 1 : Le premier billet, tu ne le dépenses pas.\nJour 2 : Tu touches le seuil avant de sortir.\nJour 3 : Tu ne réponds pas à la provocation.\nJour 4 : Tu jettes les restes.\nJour 5 : Tu marches pieds nus.\nJour 6 : Tu appelles un ancien.\nJour 7 : Tu remercies.";
    return res.json({ content, nextUpdate: 'weekly' });
  } catch (e) { return res.status(500).json({ error: 'ai_error' }); }
});

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
  const dayIdx = new Date().getDate() + new Date().getMonth() * 31;
  const sagesse = pilier.sagesse[dayIdx % pilier.sagesse.length];

  const prompt = `${SYSTEM_PROMPT}\n\nConte africain.\nPilier : ${pilier.label}.\nMorale : "${sagesse}"\n\nÉcris : Titre, 8 phrases de conte, 2 phrases de morale avec "tu". Phrases courtes.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 2000, 0.95, '/library');
    if (!content) content = "Le vieux et la rivière\n\nUn jeune homme vint voir un ancien, en colère.\nL'ancien l'emmena au bord d'une rivière.\nLa rivière ne se plaint jamais.\nElle contourne. Elle attend. Elle use.\nTa colère, c'est un rocher.\nSi tu le frappes, tu te blesses.\nSi tu l'uses par la patience, tu passes.\n\nMorale : Ne frappe pas l'obstacle. Contourne-le avec patience.";

    if (!isSubscribed) {
      const teaser = content.split('\n').slice(0, 5).join('\n');
      return res.json({ content: teaser, teaser, isTeaser: true });
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
  console.log('🌳 Le Vieux backend v12.2.0 sur port ' + PORT);
  console.log('🤖 Modèle : ' + GROQ_MODEL);
  console.log('🎙️  TTS : ' + (ELEVENLABS_API_KEY ? 'ElevenLabs ✓' : 'navigateur (fallback)'));
  console.log('💾 Supabase : ' + (supabase ? '✓' : '❌'));
});
