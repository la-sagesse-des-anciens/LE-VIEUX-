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

// Client Supabase
const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

if (!supabase) {
  console.error('❌ Supabase non configuré — vérifie SUPABASE_URL et SUPABASE_KEY');
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'La Voix des Anciens Backend',
    version: '4.0.0',
    ai_provider: 'Groq',
    ai_model: GROQ_MODEL,
    groq_key_set: !!GROQ_API_KEY && GROQ_API_KEY.length > 10,
    supabase_set: !!supabase
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

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function weekKey() {
  const d = new Date();
  const year = d.getFullYear();
  const week = Math.floor((d - new Date(year, 0, 1)) / 604800000);
  return year + '-W' + week;
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

    console.log('✅ Abonnement activé : ' + customerEmail + ' jusqu\'au ' + new Date(newExpiry).toLocaleDateString('fr-FR'));
    return res.json({ received: true, action: 'activated', email: customerEmail, expiryDate: newExpiry });
  }

  if (eventType.includes('expired')) {
    console.log('⏰ Licence expirée : ' + customerEmail);
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
    return res.status(500).json({ error: 'config_error' });
  }

  const key = email.toLowerCase().trim();
  const now = Date.now();
  const FREE_LIMIT = 3;

  // Vérifier abonnement
  let isFree = false;
  let sub = null;
  try {
    const { data } = await supabase.from('subscribers').select('*').eq('email', key).maybeSingle();
    sub = data;
  } catch (e) {}

  if (!sub || now > sub.expiry_date) {
    // Utilisateur gratuit
    let freeUser = null;
    try {
      const { data } = await supabase.from('free_users').select('*').eq('email', key).maybeSingle();
      freeUser = data;
    } catch (e) {}

    const currentCount = (freeUser && freeUser.count) || 0;
    if (currentCount >= FREE_LIMIT) {
      return res.status(402).json({
        error: 'quota_exceeded',
        message: 'Vos 3 questions gratuites sont épuisées.',
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

    const response = await callGroq(messages, 600, 0.85);

    if (!response || !response.ok) {
      const errText = response ? await response.text() : 'No response';
      console.error('❌ Erreur Groq :', errText);
      return res.status(500).json({ error: 'ai_error', message: 'Le Vieux est fatigué.' });
    }

    const data = await response.json();
    const answer = data.choices && data.choices[0] && data.choices[0].message.content;

    if (!answer) return res.status(500).json({ error: 'no_answer' });

    // Compter les questions gratuites restantes
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

app.post('/daily', async (req, res) => {
  const { email, type } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();

  // Vérifier abonnement
  try {
    const { data: sub } = await supabase.from('subscribers').select('*').eq('email', key).maybeSingle();
    if (!sub || Date.now() > sub.expiry_date) {
      return res.status(402).json({ error: 'subscription_required' });
    }
  } catch (e) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const dayKey = todayKey();
  const cacheKey = 'daily_' + dayKey + '_' + (type || 'morning');
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);

  let prompt;
  let maxTok;

  if (type === 'evening') {
    prompt = `Tu es Le Vieux. Donne un rituel du soir pour aujourd'hui (jour ${dayOfYear}). Format : une pensée courte (2 phrases), une question à méditer (1 phrase), un exercice simple (1 phrase). Français simple, ton sage, tutoiement.`;
    maxTok = 500;
  } else if (type === 'meditation') {
    prompt = `Tu es Le Vieux. Donne une courte méditation du matin pour aujourd'hui (jour ${dayOfYear}). Format : 3 phrases maximum. Une pensée apaisante sur la respiration, la présence, ou la gratitude. Français simple, ton sage, tutoiement.`;
    maxTok = 400;
  } else {
    prompt = `Tu es Le Vieux. Donne le proverbe du matin (jour ${dayOfYear}). Format : un proverbe africain authentique, son explication (2 phrases), son application moderne (2 phrases). Français simple, ton sage.`;
    maxTok = 500;
  }

  try {
    let content = await generateWithCache(cacheKey, prompt, maxTok, 0.9, '/daily (' + type + ')');

    if (!content) {
      const fallbacks = {
        morning: "Proverbe africain : « Le fleuve ne remonte jamais vers sa source. »\n\nCela signifie que la vie avance toujours, et que regarder en arrière ne fait que ralentir ton chemin.\n\nAujourd'hui, laisse le passé là où il est. Chaque pas en avant est une nouvelle chance de grandir.",
        meditation: "Respire profondément. Laisse ton souffle remplir chaque recoin de ton être. Sois reconnaissant pour cette nouvelle journée, même pour les petites choses.",
        evening: "Pensée courte : Chaque soir, la journée s'efface comme une plume au vent. Apprends à écouter le silence qui t'entoure.\n\nQuestion à méditer : Qu'as-tu appris sur toi aujourd'hui ?\n\nExercice simple : Ferme les yeux, respire lentement, et laisse ton esprit se reposer."
      };
      content = fallbacks[type] || fallbacks.morning;
      console.log('⚠️ Fallback utilisé pour /daily (' + type + ')');
    }

    return res.json({ content: content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error', message: e.message });
  }
});

app.post('/teaching', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();
  try {
    const { data: sub } = await supabase.from('subscribers').select('*').eq('email', key).maybeSingle();
    if (!sub || Date.now() > sub.expiry_date) return res.status(402).json({ error: 'subscription_required' });
  } catch (e) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const cacheKey = 'teaching_' + weekKey();
  const weekNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const prompt = `Tu es Le Vieux. Enseignement de la semaine (semaine ${weekNumber}). Format : titre (une vertu), introduction (3 phrases), 3 leçons numérotées, conclusion (2 phrases). Français simple, ton sage, tutoiement.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 800, 0.9, '/teaching');
    if (!content) {
      content = "Semaine de la Patience\n\nLa patience est la clé pour surmonter les épreuves. Elle t'apprend à attendre sans frustration, à accepter les délais naturels. En la pratiquant, tu découvres la sérénité qui vient de l'attente.\n\n1. Observe chaque petit moment de ta journée et prends le temps de l'apprécier.\n2. Respire profondément quand un obstacle se présente ; rappelle-toi que rien ne dure.\n3. Fais confiance au temps : chaque chose arrive à son heure.\n\nLa patience n'est pas de la faiblesse. C'est une force calme qui te permet de traverser les tempêtes.";
      console.log('⚠️ Fallback /teaching');
    }
    return res.json({ content: content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

app.post('/challenge', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();
  try {
    const { data: sub } = await supabase.from('subscribers').select('*').eq('email', key).maybeSingle();
    if (!sub || Date.now() > sub.expiry_date) return res.status(402).json({ error: 'subscription_required' });
  } catch (e) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const cacheKey = 'challenge_' + weekKey();
  const cycleNumber = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const prompt = `Tu es Le Vieux. Défi de 7 jours (cycle ${cycleNumber}). Format : titre, introduction (1 phrase), Jour 1 à Jour 7 (une action concrète chacun, 1 phrase). Français simple, ton sage, tutoiement.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 600, 0.9, '/challenge');
    if (!content) {
      content = "Défi du Vieux — 7 jours vers la sérénité\n\nUne semaine de gestes simples pour retrouver l'équilibre intérieur.\n\nJour 1 : Respire profondément : prends 5 minutes pour inhaler le silence, exhale la tension.\nJour 2 : Marche pieds nus sur la terre : connecte-toi aux éléments, sans chercher à comprendre.\nJour 3 : Écris trois choses pour lesquelles tu es reconnaissant.\nJour 4 : Offre quelque chose sans attendre en retour.\nJour 5 : Envoie un message à quelqu'un qui compte pour toi.\nJour 6 : Reste 10 minutes en silence, sans téléphone, sans rien.\nJour 7 : Relis tes notes de la semaine et note ce qui a changé.";
      console.log('⚠️ Fallback /challenge');
    }
    return res.json({ content: content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

app.post('/library', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });

  const key = email.toLowerCase().trim();
  try {
    const { data: sub } = await supabase.from('subscribers').select('*').eq('email', key).maybeSingle();
    if (!sub || Date.now() > sub.expiry_date) return res.status(402).json({ error: 'subscription_required' });
  } catch (e) {
    return res.status(402).json({ error: 'subscription_required' });
  }

  const cacheKey = 'library_' + todayKey();
  const dayNumber = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const prompt = `Tu es Le Vieux. Conte africain authentique pour aujourd'hui (jour ${dayNumber}). Format : titre, conte complet (10 à 15 phrases), morale (2 phrases). Termine toujours par une morale complète. Français simple, ton chaleureux de conteur.`;

  try {
    let content = await generateWithCache(cacheKey, prompt, 1200, 0.95, '/library');
    if (!content) {
      content = "La Tortue et le Lièvre\n\nDans la savane, la tortue se promenait lentement quand elle rencontra le lièvre qui battait son cœur de course.\nLe lièvre, fier de sa vitesse, la défia de courir jusqu'au grand baobab.\nLa tortue accepta sans hésiter, convaincue que la patience l'aiderait.\nAu début, le lièvre bondit devant, ricanant, tandis que la tortue avançait pas à pas.\nQuand le lièvre s'arrêta pour se reposer, la tortue continua sans pause.\nLe lièvre se réveilla trop tard, mais la tortue était déjà au sommet du baobab.\nLe lièvre, honteux, demanda à la tortue comment elle avait réussi.\nLa tortue répondit que chaque pas compte quand on ne se laisse pas distraire.\nLes animaux de la savane apprirent alors à admirer la persévérance.\n\nMorale : La persévérance vaut mieux que la vitesse. Celui qui avance sans s'arrêter atteint toujours son but.";
      console.log('⚠️ Fallback /library');
    }
    return res.json({ content: content });
  } catch (e) {
    return res.status(500).json({ error: 'ai_error' });
  }
});

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
  console.log('🌳 La Voix des Anciens backend (Supabase + Groq + Cache) sur port ' + PORT);
  console.log('📊 Admin : /admin/stats?pwd=' + ADMIN_PWD);
  console.log('🔑 Clé Groq : ' + (GROQ_API_KEY ? '✓' : '❌'));
  console.log('💾 Supabase : ' + (supabase ? '✓' : '❌'));
  console.log('🤖 Modèle : ' + GROQ_MODEL);
});
