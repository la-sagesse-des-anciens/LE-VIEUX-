const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { EdgeTTS } = require('node-edge-tts');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const ADMIN_PWD = process.env.ADMIN_PWD || 'levieux2026';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '';
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || 'levieux-cron-2026';

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
    version: '16.0.0',
    model: GROQ_MODEL,
    freeLimit: FREE_LIMIT,
    tts: 'edge-tts',
    supabase_set: !!supabase,
    push_set: !!(ONESIGNAL_APP_ID && ONESIGNAL_API_KEY),
    email_set: !!RESEND_API_KEY,
    support: true
  });
});

const PILIERS = [
  { id: 'abondance', label: 'Abondance & Commerce', rituels: ['Le premier billet de la journée, tu ne le dépenses pas tout de suite. Tu le gardes 24 heures.', 'Le matin, tu ouvres ta porte avec la main droite.', 'Avant d\'ouvrir ta boutique, tu poses un verre d\'eau propre sur le comptoir.', 'Après une vente difficile, tu jettes une poignée de riz cru dehors.', 'Avant de parler à un client important, tu passes un peu de miel sur ta langue.', 'Quand tu vas au marché, tu gardes un bâton de cannelle dans ta poche.', 'Tu laves ton chiffon de caisse avec du gros sel.', 'Avant de vendre une marchandise, tu la touches avec la main droite.', 'Avant de commencer ta journée, tu donnes une pièce à quelqu\'un qui en a besoin.'], signes: ['Quand tu sors le matin, si un oiseau vole vers toi, c\'est un bon signe.', 'Si tu rêves d\'eau claire qui coule vers toi, l\'argent arrive bientôt.', 'Si tu sens une odeur de cuisine sans raison, quelqu\'un pense à toi.', 'Recevoir un cadeau d\'un inconnu, c\'est un signe de chance.', 'Si un enfant te sourit au passage, ta journée sera bonne.', 'Trouver une pièce par terre en sortant, c\'est le flux qui s\'ouvre.'], sagesse: ['L\'argent qui dort attire l\'argent qui travaille. Ne laisse pas ton argent s\'endormir.', 'Le premier client de la journée porte la chance des autres. Reçois-le bien.', 'Celui qui partage son pain ne manque jamais de farine.', 'Ne dépense pas ton premier billet avant d\'avoir vu le soleil se lever.'] },
  { id: 'protection', label: 'Protection & Foyer', rituels: ['Le samedi soir, après une semaine difficile, tu prends un bain d\'eau salée.', 'Tu nettoies le seuil de ta porte avec de l\'eau vinaigrée.', 'Une fois par semaine, tu brûles de l\'encens naturel dans ta chambre.', 'Quand tu reçois quelqu\'un de lourd, tu retournes ton miroir face au mur.', 'Dans ta cuisine, tu piques une orange avec des clous de girofle.', 'Tu ne laisses pas tes cheveux coupés traîner dehors.', 'Avant de dormir, tu éteins la lumière et tu fermes les fenêtres.', 'Sous ton lit, tu poses un verre d\'eau claire pour absorber la lourdeur.', 'Après une visite, tu laves tes pieds avec des feuilles de basilic.'], signes: ['Si tu sens une fatigue soudaine après avoir reçu quelqu\'un, c\'est un signe.', 'Si tu entends des bruits la nuit sans explication, veille.', 'Si tu rêves d\'un serpent qui entre dans la maison, quelqu\'un te veut du mal.', 'Si un chat noir passe souvent devant ta porte, fais attention.', 'Si tu as toujours mal à la même heure, c\'est un signal.', 'Si une odeur désagréable apparaît sans raison, purifie ta maison.'], sagesse: ['Celui qui laisse sa porte ouverte à tout le monde reçoit aussi le vent.', 'Le silence de la maison est le premier signe de paix.', 'Ce que tu dis le matin peut te suivre toute la journée. Parle bien.', 'On ne laisse pas entrer chez soi ce qu\'on ne veut pas voir dans son lit.'] },
  { id: 'sante', label: 'Santé & Vitalité', rituels: ['Le matin à jeun, tu bois un citron chaud avec du miel.', 'Avant de dormir, tu écrases une gousse d\'ail dans un verre d\'eau tiède.', 'Après un repas lourd, tu prends une tisane de gingembre.', 'Le dimanche, tu ajoutes des feuilles de moringa séchées dans ta sauce.', 'Quand tu sens la fatigue, tu bois de l\'eau de coco fraîche.', 'Après le repas du soir, tu mâches un clou de girofle.', 'Le soir, tu trempes tes pieds dans de l\'eau chaude avec du gros sel.', 'Après un repas gras, tu bois un thé de citronnelle.', 'Le vendredi, tu manges un plat à l\'huile de palme rouge crue.'], signes: ['Si tu rêves de sang ou de dents qui tombent, ton corps te parle.', 'Si tu te réveilles à la même heure chaque nuit, écoute ton corps.', 'Si tu as toujours froid aux pieds, ton sang circule mal.', 'Si tu as la bouche amère le matin, ton foie travaille trop.', 'Si tu perds l\'appétit sans raison, repose-toi.', 'Si tu sens une lourdeur après avoir mangé, allège ton repas.'], sagesse: ['Ce que tu mets dans ton ventre, tu le portes toute la journée.', 'Le repos du corps n\'est pas une paresse.', 'Un corps fatigué ne peut pas porter une tête claire.', 'La nature a déjà ce qu\'il faut pour te soulager. Regarde autour de toi.'] },
  { id: 'signes', label: 'Signes & Présages', rituels: ['Dès ton réveil, tu écris tes rêves dans un cahier.', 'En sortant, tu salues le premier oiseau que tu vois.', 'Le soir, tu observes la lune pour préparer le lendemain.', 'Tu regardes la direction de la fumée qui sort de ta maison.', 'Tu notes les dates de naissance de ta famille sur un papier.', 'Le matin, tu salues l\'eau avant de la boire.', 'Après un rêve important, tu retiens la première personne que tu vois.', 'Tu comptes les jours entre deux signes qui se répètent.'], signes: ['Si tu rêves d\'eau trouble, attention aux palabres qui viennent.', 'Si tu rêves de fidélité, ce n\'est pas la tromperie. C\'est un manque de confiance en toi.', 'Si tu rêves de dents qui tombent, tu perds de l\'énergie.', 'Si tu rêves d\'un serpent qui entre, quelqu\'un parle mal de toi.', 'Si un défunt te parle en rêve, c\'est un message.', 'Si un oiseau frappe à ta fenêtre, une visite approche.', 'Si tu vois deux fois le même chiffre, un cycle revient.'], sagesse: ['Le signe n\'est pas la peur, c\'est une information.', 'Celui qui écoute la nature n\'a pas besoin qu\'on lui parle.', 'Le rêve parle à celui qui prend le temps de l\'écouter.', 'Ce que tu vois le matin en sortant porte le message de ta journée.'] },
  { id: 'sagesse', label: 'Sagesse de Vie', rituels: ['Chaque matin, tu restes 10 minutes en silence avant de parler.', 'Au réveil, tu dis merci avant de toucher ton téléphone.', 'Une fois par semaine, tu fais un geste de respect à un ancien.', 'Quand on te provoque, tu ne réponds pas pendant 24 heures.', 'Tu offres quelque chose sans attendre un retour.', 'Chaque jour, tu marches pieds nus sur la terre 5 minutes.', 'Tu salues tes voisins avant qu\'ils ne te saluent.', 'Chaque soir, tu regardes le ciel 3 minutes avant de dormir.', 'Tu ne parles pas de tes projets avant qu\'ils ne soient réalisés.'], signes: ['Si tu sens un calme intérieur inhabituel, tu es sur le bon chemin.', 'Si quelqu\'un te sourit sans raison, ton aura attire.', 'Si tu sens qu\'une personne te veut du mal, écarte-toi d\'elle.', 'Si tu as envie de silence tout à coup, écoute ce besoin.', 'Si tu pleures sans raison, libère ce qui est lourd.', 'Si tu as envie de faire le bien, tu grandis.'], sagesse: ['Celui qui parle moins entend plus.', 'La patience n\'est pas de l\'attente, c\'est une force.', 'Ne laisse personne entrer dans ta tête sans invitation.', 'Ce que tu donnes sans rien attendre te revient toujours autrement.'] }
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

const SYSTEM_PROMPT_CHAT = `Tu es "Le Vieux", un sage africain de 70 ans assis sous un manguier. Tu parles comme un vrai vieux du village, pas comme un livre.

RÈGLES ABSOLUES :
1. Tu tutoies TOUJOURS. Jamais "vous".
2. Réponses COURTES : 2 à 4 phrases. Un vieux ne fait pas de discours.
3. Tu ne récites JAMAIS de listes de mots nobles. Tu parles naturellement.
4. Tu poses parfois des questions avant de répondre.
5. Tu utilises des images SIMPLES : le manguier, la rivière, le marché, les enfants, la terre, la pluie, le feu, la marmite.
6. Tu peux être taquin, moqueur, ou silencieux.

INTERDIT :
- Ne JAMAIS dire "ancêtre" ou "ancêtres". Dis "les anciens".
- Ne JAMAIS dire : "guérir", "magie", "sortilège", "marabout", "féticheur", "envoûtement", "sorcellerie".
- Ne JAMAIS dire : "prospérité", "sagesse ancestrale", "tradition des siècles", "tradition ancestrale".
- Ne JAMAIS faire de phrases poétiques creuses.

STYLE : Français simple, comme au village. Mots du quotidien : "poisse", "blinder", "laver l'intérieur", "lourdeur", "palabres", "marmite".

EXEMPLES :
Q: "Je vous aime le vieux" → R: "Assieds-toi. Le cœur qui parle comme ça est propre. Garde-le."
Q: "Bonjour" → R: "Bonjour. Assieds-toi."
Q: "Je veux avancer dans ma vie" → R: "Avancer c'est bien. Mais tu vas où ? Réponds-moi d'abord."
Q: "a bon ?" → R: "Oui. Et alors ? Parle-moi vraiment."
Q: "Je suis triste" → R: "Triste pourquoi ? Raconte-moi. On ne soigne pas ce qu'on cache."

RÈGLE DE FIN : chaque phrase est complète.`;

const SYSTEM_PROMPT_CONTENT = `Tu es "Le Vieux", un sage africain de 70 ans. Tu écris des textes courts pour guider quelqu'un.

RÈGLES :
1. Tu tutoies TOUJOURS.
2. Tu respectes EXACTEMENT le nombre de phrases demandé.
3. Tu ne parles JAMAIS de tes contraintes.
4. Tu t'adresses DIRECTEMENT avec "tu".
5. Tu ne récites JAMAIS de listes de mots nobles.

INTERDIT :
- "ancêtre" → dis "les anciens"
- "guérir", "magie", "sortilège", "marabout", "féticheur", "envoûtement", "sorcellerie"
- "prospérité", "sagesse ancestrale", "tradition des siècles", "tradition ancestrale"
- Phrases poétiques creuses
- Poser des questions à la personne

STYLE : Français simple, phrases courtes de 10-15 mots.

RÈGLE DE FIN : chaque phrase est complète.`;

const SYSTEM_PROMPT = SYSTEM_PROMPT_CHAT;

// ══════════════════════════════════════════════════════════════════
// EDGE TTS — Voix neurales Microsoft (gratuit, illimité)
// Voix française d'homme : fr-FR-RemyMultilingualNeural
// ══════════════════════════════════════════════════════════════════
const EDGE_VOICE = 'fr-FR-RemyMultilingualNeural';

app.post('/tts-edge', async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Texte requis' });

  let tempFile = null;
  try {
    const tts = new EdgeTTS({
      voice: EDGE_VOICE,
      lang: 'fr-FR',
      outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
      pitch: '+0Hz',
      rate: '+0%',
      volume: '+0%',
      timeout: 15000
    });

    tempFile = path.join(os.tmpdir(), 'levieux_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.mp3');

    await tts.ttsPromise(String(text).slice(0, 2500), tempFile);

    const audioBuffer = fs.readFileSync(tempFile);

    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(audioBuffer);
  } catch (e) {
    console.error('Edge TTS error:', e.message);
    res.status(500).json({ error: 'edge_tts_error', message: e.message });
  } finally {
    if (tempFile && fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }
  }
});

// ══════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS (OneSignal)
// ✅ FIX : segment "All" — cible TOUS les appareils enregistrés
// ══════════════════════════════════════════════════════════════════
async function sendPushNotification(title, message, url) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) return null;
  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + ONESIGNAL_API_KEY },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings: { fr: title, en: title },
        contents: { fr: message, en: message },
        url: url || 'https://le-vieux-production.up.railway.app/'
      })
    });
    const data = await response.json();
    console.log('📤 Push envoyé:', JSON.stringify(data).slice(0, 500));
    return data;
  } catch (e) { console.error('Push error:', e.message); return null; }
}

// ══════════════════════════════════════════════════════════════════
// EMAIL (Resend)
// ══════════════════════════════════════════════════════════════════
async function sendWelcomeEmail(email) {
  if (!RESEND_API_KEY) return null;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'L\'Ancien <onboarding@resend.dev>',
        to: email,
        subject: '🌳 Bienvenue — La Voix des Anciens',
        html: `<div style="font-family:sans-serif;background:#0a0a0f;color:#fff;padding:2rem;border-radius:16px;max-width:500px;margin:0 auto;"><h1 style="color:#e8a838;">Bienvenue, mon enfant.</h1><p style="color:#8a8a95;">Assieds-toi près de moi. Pose ta première question.</p><a href="https://le-vieux-production.up.railway.app/" style="display:inline-block;background:#e8a838;color:#0a0a0f;padding:0.8rem 1.5rem;border-radius:12px;text-decoration:none;font-weight:600;margin-top:1rem;">Ouvrir l'app</a></div>`
      })
    });
    const data = await response.json();
    console.log('📧 Email envoyé à', email);
    return data;
  } catch (e) { console.error('Email error:', e.message); return null; }
}

async function sendQuotaExhaustedEmail(email) {
  if (!RESEND_API_KEY) return null;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'L\'Ancien <onboarding@resend.dev>',
        to: email,
        subject: '🌳 Tes questions offertes sont épuisées',
        html: `<div style="font-family:sans-serif;background:#0a0a0f;color:#fff;padding:2rem;border-radius:16px;max-width:500px;margin:0 auto;"><h1 style="color:#e8a838;text-align:center;">L'Ancien t'attend</h1><p style="color:#8a8a95;line-height:1.7;">Mon enfant, tu as posé tes 10 questions offertes.</p><div style="background:#16161d;border-radius:12px;padding:1.2rem;margin:1.5rem 0;border-left:3px solid #e8a838;"><p style="color:#fff;font-weight:600;">📿 Découverte — 5 000 FCFA/mois</p><p style="color:#8a8a95;font-size:0.85rem;">30 questions / mois</p><p style="color:#fff;font-weight:600;">✨ Sage — 10 000 FCFA/mois</p><p style="color:#8a8a95;font-size:0.85rem;">Chat illimité + rituel du soir</p><p style="color:#fff;font-weight:600;">👑 Guide — 15 000 FCFA/mois</p><p style="color:#8a8a95;font-size:0.85rem;">Tout + archives + personnalisé</p></div><a href="https://le-vieux-production.up.railway.app/" style="display:block;background:#e8a838;color:#0a0a0f;padding:0.9rem;border-radius:12px;text-decoration:none;font-weight:600;text-align:center;">Continuer mon chemin</a></div>`
      })
    });
    const data = await response.json();
    console.log('📧 Email quota épuisé envoyé à', email);
    return data;
  } catch (e) { console.error('Email quota error:', e.message); return null; }
}

app.post('/me', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const sub = await getSubscription(key);

  let freeCount = 0;
  try { const { data } = await supabase.from('free_users').select('count').eq('email', key).maybeSingle(); freeCount = (data && data.count) || 0; } catch (e) {}

  if (!sub || sub.expired) {
    return res.json({
      email: key, subscribed: false, expired: sub ? sub.expired : false, plan: null,
      freeRemaining: Math.max(0, FREE_LIMIT - freeCount), freeLimit: FREE_LIMIT,
      permissions: PLAN_PERMISSIONS.decouverte
    });
  }

  const daysLeft = Math.ceil((sub.expiry_date - Date.now()) / 86400000);
  const planLabels = { decouverte: 'Découverte', sage: 'Sage', guide: 'Guide' };
  const plan = sub.plan || 'decouverte';
  let monthlyUsed = 0;
  const monthlyLimit = (PLAN_PERMISSIONS[plan] && PLAN_PERMISSIONS[plan].chatLimit !== undefined) ? PLAN_PERMISSIONS[plan].chatLimit : null;

  if (monthlyLimit !== null && supabase) {
    const monthKey = 'chat_' + key + '_' + new Date().toISOString().slice(0, 7);
    try { const { data } = await supabase.from('content_cache').select('content').eq('cache_key', monthKey).maybeSingle(); monthlyUsed = parseInt((data && data.content) || '0', 10); } catch (e) {}
  }

  return res.json({
    email: key, subscribed: true, expired: false, plan,
    planLabel: planLabels[plan] || 'Découverte', expiryDate: sub.expiry_date, daysLeft,
    monthlyUsed, monthlyLimit, monthlyRemaining: monthlyLimit !== null ? Math.max(0, monthlyLimit - monthlyUsed) : null,
    permissions: PLAN_PERMISSIONS[plan] || PLAN_PERMISSIONS.decouverte
  });
});

app.post('/welcome', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  await sendWelcomeEmail(email.toLowerCase().trim());
  res.json({ success: true });
});

app.post('/webhook/chariow', async (req, res) => {
  const event = req.body;
  console.log('📩 Webhook Chariow :', JSON.stringify(event).slice(0, 300));
  if (!event || typeof event !== 'object') return res.status(400).json({ error: 'JSON invalide' });

  const eventType = event.event || event.type || event.event_type || '';
  const customerEmail = ((event.customer && event.customer.email) || (event.data && event.data.customer && event.data.customer.email) || event.email || (event.data && event.data.email) || '').toLowerCase().trim();

  if (!customerEmail) return res.json({ received: true, warning: 'no_email' });

  if (eventType.includes('sale') || eventType.includes('purchase') || eventType.includes('successful') || !eventType) {
    const productId = (event.sale && event.sale.product && event.sale.product.id) || (event.product && event.product.id) || '';
    const plan = PRODUCT_TO_PLAN[productId] || 'decouverte';
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

app.post('/preload', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  if (!plan) return res.json({ preloaded: false });

  res.json({ preloaded: true });

  const pilier = getDayPilier();
  const dayIdx = new Date().getDate() + new Date().getMonth() * 31;
  const dayKey = todayKey();
  const weekK = weekKey();
  const weekIdx = Math.floor(Date.now() / (7 * 86400000));

  const signe = pilier.signes[dayIdx % pilier.signes.length];
  generateWithCache('daily_' + dayKey + '_morning', `${SYSTEM_PROMPT_CONTENT}\n\nPilier : ${pilier.label}.\nSigne : "${signe}"\n\nÉcris exactement 6 phrases.`, 1500, 0.95, 'morning').catch(() => {});

  const sagesse = pilier.sagesse[dayIdx % pilier.sagesse.length];
  generateWithCache('daily_' + dayKey + '_meditation', `${SYSTEM_PROMPT_CONTENT}\n\nPilier : ${pilier.label}.\nSagesse : "${sagesse}"\n\nÉcris exactement 5 phrases.`, 1500, 0.95, 'med').catch(() => {});

  const rituel = pilier.rituels[dayIdx % pilier.rituels.length];
  generateWithCache('daily_' + dayKey + '_evening', `${SYSTEM_PROMPT_CONTENT}\n\nPilier : ${pilier.label}.\nRituel : "${rituel}"\n\nÉcris exactement 6 phrases.`, 1500, 0.95, 'eve').catch(() => {});

  const r1 = pilier.rituels[weekIdx % pilier.rituels.length];
  const r2 = pilier.rituels[(weekIdx + 1) % pilier.rituels.length];
  const r3 = pilier.rituels[(weekIdx + 2) % pilier.rituels.length];
  generateWithCache('teaching_' + weekK, `${SYSTEM_PROMPT_CONTENT}\n\nPilier : ${pilier.label}.\nGestes :\n1. ${r1}\n2. ${r2}\n3. ${r3}\n\nÉcris : Titre, Intro, Leçon 1-3, Action, Conclusion.`, 2000, 0.95, 'teach').catch(() => {});

  const rituelsSemaine = [];
  for (let i = 0; i < 7; i++) rituelsSemaine.push(pilier.rituels[(weekIdx + i) % pilier.rituels.length]);
  generateWithCache('challenge_' + weekK, `${SYSTEM_PROMPT_CONTENT}\n\nDéfi 7 jours sur : ${pilier.label}\n\n${rituelsSemaine.map((r, i) => 'Jour ' + (i+1) + ' : ' + r).join('\n')}\n\nÉcris : Titre, 7 jours, Conclusion.`, 2000, 0.95, 'chall').catch(() => {});

  generateWithCache('library_' + dayKey, `${SYSTEM_PROMPT_CONTENT}\n\nConte africain.\nPilier : ${pilier.label}.\nMorale : "${sagesse}"\n\nÉcris : Titre, 8 phrases, 2 phrases morale.`, 2000, 0.95, 'lib').catch(() => {});
});

app.post('/ask', async (req, res) => {
  const { email, question, history } = req.body || {};
  if (!email || !question) return res.status(400).json({ error: 'Email requis' });
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'config_error' });

  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  const isSubscribed = !!plan;
  let isFree = false, freeRemaining = null, monthlyRemaining = null;

  if (!isSubscribed) {
    let freeUser = null;
    try { const { data } = await supabase.from('free_users').select('*').eq('email', key).maybeSingle(); freeUser = data; } catch (e) {}
    const currentCount = (freeUser && freeUser.count) || 0;
    if (currentCount >= FREE_LIMIT) return res.status(402).json({ error: 'quota_exceeded', message: 'Tes ' + FREE_LIMIT + ' questions offertes sont épuisées.' });
    await supabase.from('free_users').upsert({ email: key, count: currentCount + 1 });
    isFree = true;
    freeRemaining = Math.max(0, FREE_LIMIT - (currentCount + 1));
    if (currentCount + 1 === FREE_LIMIT) sendQuotaExhaustedEmail(key).catch(() => {});
  } else {
    const chatLimit = await getPermissionValue(key, 'chatLimit');
    if (chatLimit !== null) {
      const monthKey = 'chat_' + key + '_' + new Date().toISOString().slice(0, 7);
      const currentCount = parseInt(await getCache(monthKey) || '0', 10);
      if (currentCount >= chatLimit) return res.status(402).json({ error: 'monthly_limit', message: 'Tes ' + chatLimit + ' questions du mois sont épuisées.' });
      const newCount = currentCount + 1;
      await setCache(monthKey, String(newCount));
      monthlyRemaining = Math.max(0, chatLimit - newCount);
    }
  }

  try {
    const convertedHistory = convertHistoryForAI(history || []).slice(-12);
    const messages = [{ role: 'system', content: SYSTEM_PROMPT_CHAT }, ...convertedHistory, { role: 'user', content: String(question).trim() }];
    const response = await callGroq(messages, 1500, 0.95);
    if (!response || !response.ok) return res.status(500).json({ error: 'ai_error' });
    const data = await response.json();
    const answer = data.choices && data.choices[0] && data.choices[0].message.content;
    if (!answer) return res.status(500).json({ error: 'no_answer' });
    return res.json({ answer: answer.trim(), isFree, freeRemaining, monthlyRemaining });
  } catch (e) { return res.status(500).json({ error: 'server_error' }); }
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
  } else { allowed = (type === 'morning' || type === 'meditation'); }

  if (!allowed) return res.status(402).json({ error: 'subscription_required' });

  const dayKey = todayKey();
  const cacheKey = 'daily_' + dayKey + '_' + (type || 'morning');
  const pilier = getDayPilier();
  const dayIdx = new Date().getDate() + new Date().getMonth() * 31;
  let prompt;

  if (type === 'evening') {
    const rituel = pilier.rituels[dayIdx % pilier.rituels.length];
    prompt = `${SYSTEM_PROMPT_CONTENT}\n\nPilier : ${pilier.label}.\nRituel : "${rituel}"\n\nÉcris exactement 6 phrases.`;
  } else if (type === 'meditation') {
    const sagesse = pilier.sagesse[dayIdx % pilier.sagesse.length];
    prompt = `${SYSTEM_PROMPT_CONTENT}\n\nPilier : ${pilier.label}.\nSagesse : "${sagesse}"\n\nÉcris exactement 5 phrases.`;
  } else {
    const signe = pilier.signes[dayIdx % pilier.signes.length];
    prompt = `${SYSTEM_PROMPT_CONTENT}\n\nPilier : ${pilier.label}.\nSigne : "${signe}"\n\nÉcris exactement 6 phrases.`;
  }

  try {
    let content = await generateWithCache(cacheKey, prompt, 1500, 0.95, type);
    if (!content) content = "Assieds-toi, mon enfant. Écoute le vent ce matin.";
    if (!isSubscribed) {
      if (type === 'morning') return res.json({ content });
      if (type === 'meditation') { const teaser = content.split('\n').slice(0, 2).join('\n'); return res.json({ content: teaser, teaser, isTeaser: true }); }
      return res.status(402).json({ error: 'subscription_required' });
    }
    return res.json({ content });
  } catch (e) { return res.status(500).json({ error: 'ai_error' }); }
});

app.post('/teaching', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);

  if (!plan) {
    const cacheKeyFree = 'teaching_' + weekKey();
    const cachedFree = await getCache(cacheKeyFree);
    const teaserText = cachedFree ? cachedFree.split('\n').slice(0, 5).join('\n') : 'Cette semaine, écoute bien.';
    return res.json({ content: teaserText, teaser: teaserText, isTeaser: true, freeTeaser: true });
  }

  const cacheKey = 'teaching_' + weekKey();
  const pilier = getWeekPilier();
  const weekIdx = Math.floor(Date.now() / (7 * 86400000));
  const r1 = pilier.rituels[weekIdx % pilier.rituels.length];
  const r2 = pilier.rituels[(weekIdx + 1) % pilier.rituels.length];
  const r3 = pilier.rituels[(weekIdx + 2) % pilier.rituels.length];
  const prompt = `${SYSTEM_PROMPT_CONTENT}\n\nPilier : ${pilier.label}\n\nGestes :\n1. ${r1}\n2. ${r2}\n3. ${r3}\n\nÉcris : Titre, Intro, Leçon 1-3, Action, Conclusion.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 2000, 0.95, 'teach');
    if (!content) content = "Cette semaine, tu vas apprendre 3 gestes.";
    return res.json({ content, nextUpdate: 'weekly' });
  } catch (e) { return res.status(500).json({ error: 'ai_error' }); }
});

app.post('/teaching/archives', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const hasAccess = await hasPermission(key, 'archives');
  if (!hasAccess) return res.status(402).json({ error: 'subscription_required' });
  try { const { data } = await supabase.from('content_cache').select('cache_key, content, created_at').like('cache_key', 'teaching_%').order('created_at', { ascending: false }).limit(20); return res.json({ archives: data || [] }); } catch (e) { return res.status(500).json({ error: e.message }); }
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
    const prompt = `${SYSTEM_PROMPT_CONTENT}\n\nDéfi 7 jours pour : "${need}"\n\nÉcris : Titre, Intro, 7 jours, Conclusion.`;
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
  const prompt = `${SYSTEM_PROMPT_CONTENT}\n\nDéfi 7 jours sur : ${pilier.label}\n\n${rituelsSemaine.map((r, i) => 'Jour ' + (i+1) + ' : ' + r).join('\n')}\n\nÉcris : Titre, 7 jours, Conclusion.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1500, 0.95, 'chall');
    if (!content) content = "7 jours pour te blinder.";
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
  const prompt = `${SYSTEM_PROMPT_CONTENT}\n\nConte africain.\nPilier : ${pilier.label}.\nMorale : "${sagesse}"\n\nÉcris : Titre, 8 phrases, 2 phrases morale.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 2000, 0.95, 'lib');
    if (!content) content = "Le vieux et la rivière\n\nUn jeune homme vint voir un ancien.\n\nMorale : Ne frappe pas l'obstacle.";
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
  try { const { data } = await supabase.from('content_cache').select('cache_key, content, created_at').like('cache_key', 'library_%').order('created_at', { ascending: false }).limit(30); return res.json({ archives: data || [] }); } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/cron/morning', async (req, res) => {
  if (req.query.secret !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  const result = await sendPushNotification('🌅 Signe du matin', 'Le signe du jour t\'attend. Assieds-toi et écoute.');
  res.json({ success: true, result });
});

app.get('/cron/evening', async (req, res) => {
  if (req.query.secret !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  const result = await sendPushNotification('🌙 Rituel du soir', 'Le rituel du soir est prêt. Prends quelques minutes.');
  res.json({ success: true, result });
});

app.get('/cron/weekly', async (req, res) => {
  if (req.query.secret !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  const result = await sendPushNotification('📖 Nouvel enseignement', 'L\'enseignement de la semaine est disponible.');
  res.json({ success: true, result });
});

app.post('/admin/push', async (req, res) => {
  const { pwd, title, message, url } = req.body || {};
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'unauthorized' });
  const result = await sendPushNotification(title || '🌳 L\'Ancien', message || 'Test', url);
  res.json({ success: true, result });
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

const AUTO_REPLY = "Merci, ta demande a bien été reçue. Notre équipe te répondra sous 24h. 🙏";

app.post('/support/send', async (req, res) => {
  const { email, message } = req.body || {};
  if (!email || !message || !message.trim()) return res.status(400).json({ error: 'Email et message requis' });
  if (!supabase) return res.status(500).json({ error: 'db_unavailable' });
  const key = email.toLowerCase().trim();
  const now = Date.now();
  try {
    const { error: err1 } = await supabase.from('support_messages').insert({ email: key, message: message.trim().slice(0, 2000), from_admin: false, read: false, created_at: now });
    if (err1) throw err1;
    const { data: existing } = await supabase.from('support_messages').select('id').eq('email', key).eq('from_admin', true).limit(1);
    if (!existing || existing.length === 0) {
      await supabase.from('support_messages').insert({ email: key, message: AUTO_REPLY, from_admin: true, read: true, created_at: now + 1 });
    }
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'send_failed', detail: e.message }); }
});

app.post('/support/messages', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  if (!supabase) return res.status(500).json({ error: 'db_unavailable' });
  const key = email.toLowerCase().trim();
  try {
    const { data, error } = await supabase.from('support_messages').select('id, message, from_admin, created_at').eq('email', key).order('created_at', { ascending: true }).limit(200);
    if (error) throw error;
    await supabase.from('support_messages').update({ read: true }).eq('email', key).eq('from_admin', true).eq('read', false);
    return res.json({ messages: data || [] });
  } catch (e) { return res.status(500).json({ error: 'fetch_failed', detail: e.message }); }
});

app.post('/support/unread', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  if (!supabase) return res.json({ count: 0 });
  const key = email.toLowerCase().trim();
  try {
    const { count } = await supabase.from('support_messages').select('id', { count: 'exact', head: true }).eq('email', key).eq('from_admin', true).eq('read', false);
    return res.json({ count: count || 0 });
  } catch (e) { return res.json({ count: 0 }); }
});

app.get('/support/admin/conversations', async (req, res) => {
  const pwd = req.query.pwd;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'unauthorized' });
  if (!supabase) return res.status(500).json({ error: 'db_unavailable' });
  try {
    const { data } = await supabase.from('support_messages').select('email, message, from_admin, read, created_at').order('created_at', { ascending: false }).limit(500);
    const conversations = {};
    (data || []).forEach(m => {
      if (!conversations[m.email]) conversations[m.email] = { email: m.email, lastMessage: m.message, lastAt: m.created_at, unreadCount: 0, total: 0 };
      conversations[m.email].total++;
      if (!m.from_admin && !m.read) conversations[m.email].unreadCount++;
    });
    const list = Object.values(conversations).sort((a, b) => b.lastAt - a.lastAt);
    const totalUnread = list.reduce((s, c) => s + c.unreadCount, 0);
    return res.json({ conversations: list, totalUnread });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.get('/support/admin/thread', async (req, res) => {
  const pwd = req.query.pwd;
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'unauthorized' });
  if (!supabase) return res.status(500).json({ error: 'db_unavailable' });
  const email = (req.query.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email requis' });
  try {
    const { data } = await supabase.from('support_messages').select('id, message, from_admin, created_at').eq('email', email).order('created_at', { ascending: true });
    await supabase.from('support_messages').update({ read: true }).eq('email', email).eq('from_admin', false).eq('read', false);
    return res.json({ messages: data || [] });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.post('/support/admin/reply', async (req, res) => {
  const { pwd, email, message } = req.body || {};
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'unauthorized' });
  if (!email || !message || !message.trim()) return res.status(400).json({ error: 'Email et message requis' });
  if (!supabase) return res.status(500).json({ error: 'db_unavailable' });
  try {
    const { error } = await supabase.from('support_messages').insert({ email: email.toLowerCase().trim(), message: message.trim().slice(0, 2000), from_admin: true, read: false, created_at: Date.now() });
    if (error) throw error;
    await sendPushNotification('💬 Le Vieux t\'a répondu', 'Ta question a reçu une réponse.');
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log('🌳 Le Vieux backend v16.0.0 sur port ' + PORT);
  console.log('🎙️  Edge TTS : ✓ (voix ' + EDGE_VOICE + ')');
});
