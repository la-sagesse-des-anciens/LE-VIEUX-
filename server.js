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

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'La Voix des Anciens Backend',
    version: '5.1.0',
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
  {
    id: 'nature',
    label: 'Sagesse de la nature',
    prompt: `Parle de la sagesse que la nature enseigne. Choisis UN élément (arbre, plante, eau, terre, feu, vent, animal, saison) et tire une leçon profonde pour la vie humaine. Explique ce que cet élément fait, et ce que l'humain doit apprendre de lui. Ton : direct, sage, autoritaire. Pas de religion. Pas de superstition.`
  },
  {
    id: 'signes',
    label: 'Signes et destinée',
    prompt: `Parle des signes que la vie nous envoie. Un signe concret (un oiseau, un objet trouvé, un événement répété, une rencontre) et comment l'interpréter avec sagesse. Explique : 1) le signe, 2) ce qu'il signifie, 3) comment agir. Ton : direct, sage, autoritaire.`
  },
  {
    id: 'protection',
    label: 'Protection intérieure',
    prompt: `Explique comment se protéger intérieurement des mauvaises énergies, des intentions négatives, des personnes toxiques. Donne une pratique concrète (un rituel de sel, un bain, une intention, un geste). Explique : 1) pourquoi, 2) comment, 3) quand. Ton : direct, sage.`
  },
  {
    id: 'reves',
    label: 'Rêves et messages',
    prompt: `Interprète un rêve courant de manière noble et symbolique. Choisis UN rêve (eau, serpent, dents, chute, vol, mort, mariage, argent, feu) et explique son sens profond. Rappelle que le rêve est un message de ton propre esprit, pas une prédiction. Explique : 1) le rêve, 2) son sens symbolique, 3) ce que tu dois en faire.`
  },
  {
    id: 'abondance',
    label: 'Abondance',
    prompt: `Parle de l'abondance et de la prospérité. Explique ce qui attire et ce qui repousse l'argent. Donne un principe concret (une attitude, un geste, une habitude) lié à la sagesse ancienne. Explique : 1) le principe, 2) pourquoi il marche, 3) comment l'appliquer aujourd'hui.`
  },
  {
    id: 'paix',
    label: 'Paix et ancrage',
    prompt: `Aide à retrouver la paix intérieure dans le chaos. Explique un état intérieur (colère, peur, doute, fatigue, tristesse) et comment le traverser avec sagesse. Donne un geste simple, une pensée, ou une pratique d'ancrage. Ton : direct, sage, chaleureux.`
  },
  {
    id: 'cycles',
    label: 'Cycles et temps',
    prompt: `Parle des cycles de la vie : naissance, lune, saison, âge, moment propice. Explique comment un cycle influence une situation. Donne un conseil pratique : quel moment est bon pour agir, pour attendre, pour se reposer.`
  },
  {
    id: 'rituels',
    label: 'Rituels nobles',
    prompt: `Décris un rituel simple et noble d'ancrage ou de purification. Basé sur des éléments naturels (eau, sel, feu, plante, lumière). Explique : 1) à quoi ça sert, 2) comment le faire, 3) quand le faire. Ton : direct, sage, respectueux.`
  }
];

function getDayCategory(dateStr) {
  const d = new Date(dateStr || Date.now());
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return CATEGORIES[dayOfYear % CATEGORIES.length];
}

function getWeekCategory(dateStr) {
  const d = new Date(dateStr || Date.now());
  const weekOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / (7 * 86400000));
  return CATEGORIES[weekOfYear % CATEGORIES.length];
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function weekKey() {
  const d = new Date();
  const year = d.getFullYear();
  const week = Math.floor((d - new Date(year, 0, 1)) / 604800000);
  return year + '-W' + week;
}

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
        console.log('⏳ Rate limit Groq, attente ' + wait + 'ms');
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
    const { data, error } = await supabase
      .from('content_cache')
      .select('content')
      .eq('cache_key', cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    return data.content;
  } catch (e) { return null; }
}

async function setCache(cacheKey, content) {
  if (!supabase) return;
  try {
    await supabase.from('content_cache').upsert({
      cache_key: cacheKey,
      content: content,
      created_at: Date.now()
    });
  } catch (e) { console.error('Erreur setCache:', e.message); }
}

async function generateWithCache(cacheKey, prompt, maxTokens, temperature, label) {
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log('💾 Cache hit : ' + cacheKey);
    return cached;
  }

  let response = null;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    attempts++;
    console.log('📤 ' + label + ' tentative ' + attempts + '/' + maxAttempts);
    response = await callGroq([{ role: 'user', content: prompt }], maxTokens, temperature);

    if (response && response.ok) {
      const data = await response.json();
      const content = data.choices && data.choices[0] && data.choices[0].message.content;
      if (content && content.trim().length > 0) {
        await setCache(cacheKey, content.trim());
        console.log('✅ ' + label + ' généré et caché (' + content.length + ' caractères)');
        return content.trim();
      }
    }

    if (attempts < maxAttempts) {
      const wait = attempts * 5000;
      console.log('⏳ ' + label + ' échec, attente ' + wait + 'ms');
      await new Promise(r => setTimeout(r, wait));
    }
  }

  console.error('❌ ' + label + ' échec après ' + maxAttempts + ' tentatives');
  return null;
}

async function isSubscribed(email) {
  if (!supabase || !email) return false;
  try {
    const key = email.toLowerCase().trim();
    const { data: sub } = await supabase.from('subscribers').select('*').eq('email', key).maybeSingle();
    if (!sub) return false;
    return Date.now() <= sub.expiry_date;
  } catch (e) { return false; }
}

app.post('/check-access', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();

  try {
    const { data: sub } = await supabase
      .from('subscribers')
      .select('*')
      .eq('email', key)
      .maybeSingle();

    if (!sub) return res.json({ active: false, reason: 'not_subscribed' });

    const now = Date.now();
    if (now > sub.expiry_date) {
      return res.json({ active: false, reason: 'expired', expiryDate: sub.expiry_date });
    }

    const daysLeft = Math.ceil((sub.expiry_date - now) / 86400000);
    return res.json({
      active: true,
      email: key,
      expiryDate: sub.expiry_date,
      daysLeft: daysLeft,
      plan: sub.plan || 'monthly'
    });
  } catch (e) {
    console.error('check-access erreur:', e.message);
    return res.json({ active: false, reason: 'error' });
  }
});

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
    const now = Date.now();
    const { data: existing } = await supabase
      .from('subscribers')
      .select('expiry_date')
      .eq('email', customerEmail)
      .maybeSingle();

    const currentExpiry = (existing && existing.expiry_date) || 0;
    const baseDate = Math.max(currentExpiry, now);
    const newExpiry = baseDate + (30 * 24 * 60 * 60 * 1000);

    await supabase.from('subscribers').upsert({
      email: customerEmail,
      start_date: now,
      expiry_date: newExpiry,
      plan: 'monthly',
      updated_at: now
    });

    console.log('✅ Abonnement activé : ' + customerEmail);
    return res.json({ received: true, action: 'activated', email: customerEmail, expiryDate: newExpiry });
  }

  if (eventType.includes('expired')) {
    return res.json({ received: true, action: 'expired' });
  }

  return res.json({ received: true, action: 'ignored' });
});

// ══════════════════════════════════════════════════════════════════
// CHAT — 5 questions gratuites
// ══════════════════════════════════════════════════════════════════
app.post('/ask', async (req, res) => {
  const { email, question, history } = req.body || {};

  if (!email || !question) {
    return res.status(400).json({ error: 'Email et question requis' });
  }

  if (!GROQ_API_KEY || GROQ_API_KEY.length < 10) {
    return res.status(500).json({ error: 'config_error' });
  }

  const key = email.toLowerCase().trim();
  const FREE_LIMIT = 5;

  const subscribed = await isSubscribed(key);
  let isFree = false;

  if (!subscribed) {
    let freeUser = null;
    try {
      const { data } = await supabase.from('free_users').select('*').eq('email', key).maybeSingle();
      freeUser = data;
    } catch (e) {}

    const currentCount = (freeUser && freeUser.count) || 0;
    if (currentCount >= FREE_LIMIT) {
      return res.status(402).json({
        error: 'quota_exceeded',
        message: 'Tes 5 questions offertes sont épuisées.',
        freeUsed: currentCount,
        freeLimit: FREE_LIMIT
      });
    }

    await supabase.from('free_users').upsert({
      email: key,
      count: currentCount + 1
    });
    isFree = true;
  }

  try {
    const systemPrompt = `Tu es "L'Ancien", un sage africain de 70 ans, assis sous un baobab sacré.
Tu transmets la sagesse ancestrale africaine noble — celle qui parle de la nature, des signes, des cycles, de la protection intérieure, des rêves et de l'abondance.
Tu ne parles JAMAIS de religion. Tu ne parles JAMAIS de sorcellerie. Tu ne fais JAMAIS de promesse de guérison.
Tu parles de la nature, de l'observation, de l'intention, du respect des cycles.
Tu tutoies toujours ton interlocuteur.
Ton style : direct, autoritaire, sage. Tu dis "Voici ce que les anciens savaient...", "Écoute bien...", "Ne l'oublie jamais...".
Tu réponds en français simple, compréhensible par tous.
Tu réponds en 4 à 8 phrases. Tu donnes toujours un conseil concret.
Tu ne mentionnes jamais que tu es une IA. Tu es L'Ancien, point.`;

    const convertedHistory = convertHistoryForAI(history || []).slice(-6);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...convertedHistory,
      { role: 'user', content: String(question).trim() }
    ];

    const response = await callGroq(messages, 1000, 0.9);

    if (!response || !response.ok) {
      const errText = response ? await response.text() : 'No response';
      console.error('❌ Erreur Groq :', errText);
      return res.status(500).json({ error: 'ai_error', message: "L'Ancien est fatigué." });
    }

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

    return res.json({
      answer: answer.trim(),
      isFree: isFree,
      freeRemaining: freeRemaining
    });

  } catch (e) {
    console.error('❌ Erreur serveur :', e.message);
    return res.status(500).json({ error: 'server_error', message: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// /daily — Signe / Méditation / Rituel
// ══════════════════════════════════════════════════════════════════
app.post('/daily', async (req, res) => {
  const { email, type } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();
  const subscribed = await isSubscribed(key);

  const dayKey = todayKey();
  const cacheKey = 'daily_' + dayKey + '_' + (type || 'morning');

  let prompt;

  if (type === 'evening') {
    const eveningCategories = ['paix', 'reves', 'protection'];
    const cat = CATEGORIES.find(c => c.id === eveningCategories[
      Math.floor((Date.now() / 86400000) % eveningCategories.length)
    ]) || CATEGORIES[5];
    prompt = `${cat.prompt}\n\nContexte : c'est le soir. Donne un contenu pour la soirée. Format : 1) le sujet (2 phrases), 2) l'explication (3-4 phrases), 3) l'action concrète (2 phrases). Français simple, ton direct et sage.`;
  } else if (type === 'meditation') {
    const medCategories = ['nature', 'rituels', 'cycles'];
    const cat = CATEGORIES.find(c => c.id === medCategories[
      Math.floor((Date.now() / 86400000) % medCategories.length)
    ]) || CATEGORIES[0];
    prompt = `${cat.prompt}\n\nContexte : c'est le matin. Donne une méditation courte et puissante. Format : 3-5 phrases. Un geste simple à faire ce matin. Français simple, ton direct et sage.`;
  } else {
    const morningCategories = ['signes', 'abondance', 'nature'];
    const cat = CATEGORIES.find(c => c.id === morningCategories[
      Math.floor((Date.now() / 86400000) % morningCategories.length)
    ]) || CATEGORIES[1];
    prompt = `${cat.prompt}\n\nContexte : c'est le matin. Donne le signe ou la leçon du jour. Format : 1) le signe ou la leçon (2 phrases), 2) son sens profond (3-4 phrases), 3) ce que tu dois faire aujourd'hui (2 phrases). Français simple, ton direct et sage.`;
  }

  try {
    let content = await generateWithCache(cacheKey, prompt, 1200, 0.92, '/daily (' + type + ')');

    if (!content) {
      const fallbacks = {
        morning: "Aujourd'hui, observe le premier arbre que tu verras.\n\nLes anciens savaient que l'arbre que tu remarques en premier le matin porte un message. Sa forme, sa taille, son état — tout parle. Si l'arbre est fort et droit, la journée te portera. S'il est penché, tu devras t'adapter.\n\nAujourd'hui, prends 30 secondes pour regarder un arbre. Et écoute ce qu'il te dit.",
        meditation: "Ce matin, avant de toucher ton téléphone, pose tes deux pieds au sol.\n\nLes anciens disaient : celui qui sent la terre sous ses pieds ne perd pas son chemin. La terre est ton premier soutien. Avant toute chose, reconnecte-toi à elle.\n\nFais-le maintenant. 10 secondes. Pieds nus si possible.",
        evening: "Ce soir, avant de dormir, pose ta main sur ton cœur.\n\nLes anciens savaient que le cœur parle la nuit. Ce que tu ressens avant de dormir, ton esprit le travaille pendant ton sommeil. Si tu dors avec de la colère, tu te réveilleras fatigué. Si tu dors avec de la gratitude, tu te réveilleras léger.\n\nCe soir, avant de fermer les yeux, dis merci pour une chose. Une seule. Et dors en paix."
      };
      content = fallbacks[type] || fallbacks.morning;
    }

    if (!subscribed) {
      const teaser = content.split('\n').slice(0, 2).join('\n');
      return res.status(402).json({
        error: 'subscription_required',
        teaser: teaser,
        content: content
      });
    }

    return res.json({ content: content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error', message: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// /teaching — Enseignement hebdo (maxTokens 1800)
// ══════════════════════════════════════════════════════════════════
app.post('/teaching', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();
  const subscribed = await isSubscribed(key);

  const cacheKey = 'teaching_' + weekKey();
  const weekCat = getWeekCategory();

  const prompt = `Tu es L'Ancien. Catégorie de la semaine : ${weekCat.label}.
${weekCat.prompt}

Format de l'enseignement :
- Titre (une phrase forte)
- Introduction (3 phrases qui captivent)
- 3 leçons numérotées (chacune : 3-4 phrases avec un exemple concret)
- Une action de la semaine (2 phrases)
- Conclusion (2 phrases de sagesse)

Total : environ 400 mots. Français simple, ton direct, autoritaire, sage.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1800, 0.92, '/teaching');

    if (!content) {
      content = "La sagesse du baobab\n\nLe baobab ne pousse pas vite. Il pousse longtemps. Voici ce que les anciens enseignaient sur cet arbre.\n\n1. La lenteur n'est pas une faiblesse. Le baobab met 100 ans à devenir grand, mais rien ne le déracine ensuite.\n\n2. Le baobab donne tout : fruit, ombre, écorce, eau. Plus tu grandis, plus tu dois donner.\n\n3. Le baobab vit plus longtemps que ceux qui le plantent. Ce que tu fais aujourd'hui servira à tes petits-enfants.\n\nAction de la semaine : plante quelque chose. Une graine, une idée, une relation. Et laisse le temps faire.\n\nCe que tu construis lentement, rien ne peut le détruire.";
    }

    if (!subscribed) {
      const teaser = content.split('\n').slice(0, 4).join('\n');
      return res.status(402).json({
        error: 'subscription_required',
        teaser: teaser,
        content: content
      });
    }

    return res.json({ content: content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// /challenge — Défi de 7 jours (maxTokens 1500)
// ══════════════════════════════════════════════════════════════════
app.post('/challenge', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();
  const subscribed = await isSubscribed(key);

  const cacheKey = 'challenge_' + weekKey();
  const weekCat = getWeekCategory();

  const prompt = `Tu es L'Ancien. Défi de 7 jours sur le thème : ${weekCat.label}.
${weekCat.prompt}

Format OBLIGATOIRE (respecte exactement) :
- Titre (court et fort)
- Introduction (1 phrase)
- Jour 1 : (1 action concrète, 1-2 phrases)
- Jour 2 : (1 action concrète, 1-2 phrases)
- Jour 3 : (1 action concrète, 1-2 phrases)
- Jour 4 : (1 action concrète, 1-2 phrases)
- Jour 5 : (1 action concrète, 1-2 phrases)
- Jour 6 : (1 action concrète, 1-2 phrases)
- Jour 7 : (1 action concrète, 1-2 phrases)
- Conclusion (1 phrase)

Écris les 7 jours en entier, sans t'arrêter.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1500, 0.92, '/challenge');

    if (!content) {
      content = "7 jours de reconnexion\n\nUne semaine pour revenir à l'essentiel.\n\nJour 1 : Regarde le ciel 5 minutes. Sans rien faire d'autre.\n\nJour 2 : Marche pieds nus sur la terre ou l'herbe.\n\nJour 3 : Écris une chose que tu n'as jamais dite à personne.\n\nJour 4 : Offre quelque chose sans attendre de retour.\n\nJour 5 : Reste 10 minutes en silence complet.\n\nJour 6 : Contacte quelqu'un que tu as perdu de vue.\n\nJour 7 : Relis tout ce que tu as fait cette semaine.\n\nCe que tu fais 7 jours de suite devient une habitude. Une habitude devient une vie.";
    }

    if (!subscribed) {
      const teaser = content.split('\n').slice(0, 5).join('\n');
      return res.status(402).json({
        error: 'subscription_required',
        teaser: teaser,
        content: content
      });
    }

    return res.json({ content: content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

// ══════════════════════════════════════════════════════════════════
// /library — Conte africain (maxTokens 1800)
// ══════════════════════════════════════════════════════════════════
app.post('/library', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();
  const subscribed = await isSubscribed(key);

  const cacheKey = 'library_' + todayKey();
  const dayNumber = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

  const prompt = `Tu es L'Ancien. Raconte un conte africain authentique pour aujourd'hui (jour ${dayNumber}).

Format du conte :
- Titre
- Le conte (12-15 phrases, avec des animaux, des sages ou des éléments naturels)
- La morale (2 phrases)

Le conte doit être noble, universel, sans religion, sans sorcellerie. Il doit transmettre une leçon profonde sur la vie, la nature, les cycles, la sagesse.
Français simple, ton chaleureux de conteur ancien. Écris le conte en entier sans t'arrêter.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1800, 0.95, '/library');

    if (!content) {
      content = "Le vieux et la rivière\n\nUn jour, un jeune homme vint voir un ancien. Il était en colère contre la vie.\nL'ancien l'emmena au bord d'une rivière.\nRegarde, dit-il. La rivière ne se plaint jamais.\nElle ne dit pas : pourquoi ce rocher sur mon chemin ?\nElle contourne. Elle attend. Elle use.\nLe jeune homme regarda la rivière.\nElle était là depuis toujours, et elle coulait toujours.\nL'ancien dit : Ta colère, c'est un rocher. Si tu le frappes, tu te blesses.\nSi tu l'uses par la patience, tu passes.\nLe jeune homme comprit.\nIl revint un an plus tard.\nIl avait contourné son rocher.\nEt il coulait, lui aussi, comme la rivière.\n\nMorale : Ne frappe pas l'obstacle. Contourne-le. Ce que la patience fait, la colère ne le fera jamais.";
    }

    if (!subscribed) {
      const teaser = content.split('\n').slice(0, 4).join('\n');
      return res.status(402).json({
        error: 'subscription_required',
        teaser: teaser,
        content: content
      });
    }

    return res.json({ content: content });
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
        actives.push({
          email: s.email,
          expiry: new Date(s.expiry_date).toLocaleDateString('fr-FR'),
          daysLeft: Math.ceil((s.expiry_date - now) / 86400000)
        });
      } else {
        expired.push({
          email: s.email,
          expiredSince: new Date(s.expiry_date).toLocaleDateString('fr-FR')
        });
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
  console.log('🌳 L\'Ancien backend v5.1.0 sur port ' + PORT);
  console.log('📊 Admin : /admin/stats?pwd=' + ADMIN_PWD);
  console.log('🔑 Groq : ' + (GROQ_API_KEY ? '✓' : '❌'));
  console.log('💾 Supabase : ' + (supabase ? '✓' : '❌'));
  console.log('📚 8 catégories chargées');
});
