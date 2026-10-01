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
    version: '18.0.0',
    model: GROQ_MODEL,
    freeLimit: FREE_LIMIT,
    tts: 'edge-tts',
    supabase_set: !!supabase,
    push_set: !!(ONESIGNAL_APP_ID && ONESIGNAL_API_KEY),
    email_set: !!RESEND_API_KEY,
    support: true,
    content: 'structured',
    morning: 30,
    meditation: 30,
    evening: 30,
    themes: 12
  });
});

// ══════════════════════════════════════════════════════════════════
// BASE DE CONNAISSANCE — 30 RITUELS DU MATIN
// ══════════════════════════════════════════════════════════════════
const RITUELS_MATIN = [
  { titre: "Salue la porte", theme: "Protection", texte: "Avant de sortir ce matin, touche le cadre de ta porte avec la main droite. Dis intérieurement : 'Je sors en paix, je rentre en paix'. La porte est le passage entre ta maison et le monde. La saluer, c'est reconnaître ce passage." },
  { titre: "L'eau avant le café", theme: "Santé", texte: "Ce matin, bois un verre d'eau tiède AVANT toute autre chose. Pas de café, pas de thé. L'eau réveille le ventre doucement. Attends 15 minutes avant de manger. Ton corps te remerciera." },
  { titre: "Le premier mot", theme: "Parole", texte: "Aujourd'hui, que ta première phrase à quelqu'un soit douce. Même si tu es en colère. Même si tu es pressé. La première parole du matin porte toute ta journée." },
  { titre: "Salue le ciel", theme: "Spiritualité", texte: "En sortant, lève les yeux 3 secondes vers le ciel. Sans rien dire. Juste regarder. Tu n'es pas seul. Ce geste simple t'ancre dans la journée qui vient." },
  { titre: "Le premier billet", theme: "Argent", texte: "Le premier billet que tu reçois aujourd'hui, ne le dépense pas avant 24 heures. Garde-le dans ta poche. Le premier billet porte la chance des autres." },
  { titre: "La marche du matin", theme: "Santé", texte: "Si tu peux, marche 10 minutes avant de commencer ta journée. Pieds nus sur la terre si possible. Ça décharge la nuit et remet le corps à l'endroit." },
  { titre: "Ne pas balayer", theme: "Protection", texte: "Ne balaie PAS devant ta porte avant midi. Le matin, balayer dehors, c'est chasser la chance qui vient d'arriver pendant la nuit." },
  { titre: "L'huile sur la tête", theme: "Protection", texte: "Si tu as de l'huile de coco, mets-en un peu sur ton front avant de sortir. Une goutte suffit. Ça ferme la tête aux mauvaises pensées des autres." },
  { titre: "Merci avant le téléphone", theme: "Spiritualité", texte: "Avant de toucher ton téléphone ce matin, dis merci. Merci pour la nuit, merci pour le réveil, merci pour ce jour. 3 secondes. Ensuite tu peux tout consulter." },
  { titre: "Le verre sur le comptoir", theme: "Commerce", texte: "Si tu ouvres une boutique aujourd'hui, pose un verre d'eau propre sur ton comptoir avant le premier client. Change l'eau chaque matin. L'eau propre attire l'argent propre." },
  { titre: "Salue le premier oiseau", theme: "Signes", texte: "En sortant, regarde le premier oiseau que tu vois. S'il vole vers toi, bonne journée. S'il vole ailleurs, journée calme. Note-le dans ta tête." },
  { titre: "Ne pas annoncer ses projets", theme: "Parole", texte: "Aujourd'hui, ne raconte à personne ce que tu vas faire. Fais-le d'abord. Parle après. Ce que tu annonces avant de faire, ça se disperse." },
  { titre: "Le citron chaud", theme: "Santé", texte: "Presse un demi-citron dans de l'eau chaude. Ajoute une cuillère de miel. Bois-le à jeun. Ça nettoie le foie après la nuit et prépare le corps." },
  { titre: "Ne pas prêter le matin", theme: "Argent", texte: "N'prête PAS d'argent le matin, avant d'avoir reçu quelque chose. Sinon ta journée reste vide. Si on te demande, dis : 'Reviens cet après-midi'." },
  { titre: "Le sel dans la poche", theme: "Protection", texte: "Mets une pincée de sel dans ta poche droite. Ça t'accompagne toute la journée. Le soir, jette-le dehors. Nouvelle pincée demain matin." },
  { titre: "Parler à sa femme", theme: "Amour", texte: "Si tu es marié, dis quelque chose de doux à ta femme ce matin. Même simple : 'Bonne journée.' C'est ce qui garde le lien vivant sur le long terme." },
  { titre: "Regarder ses mains", theme: "Sagesse", texte: "Regarde tes mains 10 secondes. Elles peuvent frapper ou aider. Ce matin, choisis d'aider. Ce choix, répété, fait ce que tu deviens." },
  { titre: "Ne pas médire", theme: "Parole", texte: "Aujourd'hui, si tu entends du mal sur quelqu'un, ne répète pas. Ferme ta bouche. Ce que tu répètes voyage plus vite que toi." },
  { titre: "Le miel sur la langue", theme: "Commerce", texte: "Si tu dois parler à un client important aujourd'hui, passe une goutte de miel sur ta langue avant. Symboliquement. Ça te rappelle de parler doux." },
  { titre: "Marcher pieds nus", theme: "Spiritualité", texte: "Avant midi, marche 3 minutes pieds nus sur la terre ou l'herbe. Le matin, la terre est propre. Elle te recharge sans que tu le saches." },
  { titre: "Le journal du matin", theme: "Sagesse", texte: "Écris une phrase : ce que tu veux faire aujourd'hui. Une seule. Pose le stylo. Tu verras ce soir si tu l'as fait. C'est comme ça qu'on avance." },
  { titre: "Boire sans téléphone", theme: "Sagesse", texte: "Ce matin, bois ton premier verre sans ton téléphone. Regarde par la fenêtre. Laisse ton esprit s'installer. Cinq minutes, c'est tout." },
  { titre: "Le sourire", theme: "Relations", texte: "Souris à la première personne que tu vois ce matin. Même à un inconnu. Ce sourire revient toujours. Parfois plus tard dans la journée, sans que tu saches d'où il vient." },
  { titre: "Ne pas crier", theme: "Parole", texte: "Aujourd'hui, ne crie sur personne. Même si c'est justifié. Surtout sur les enfants. Le matin, crier casse la journée de tout le monde." },
  { titre: "Le silence de 5 minutes", theme: "Sagesse", texte: "Reste assis 5 minutes sans rien faire ce matin. Sans téléphone, sans radio. Juste assis. Le bruit du monde peut attendre." },
  { titre: "Offrir quelque chose", theme: "Générosité", texte: "Donne une petite chose aujourd'hui à quelqu'un qui n'attend rien. Une pièce à un pauvre, un fruit à un voisin, un mot gentil à un collègue. Ce que tu donnes revient." },
  { titre: "Penser à un ancien", theme: "Respect", texte: "Pense à un ancien que tu as connu. Une personne âgée qui t'a marqué. Dis-lui merci dans ton cœur. Si elle est vivante, appelle-la cette semaine." },
  { titre: "Regarder la lune", theme: "Signes", texte: "Si tu vois la lune ce matin (tôt), note sa forme. Nouvelle lune : commence quelque chose. Pleine lune : termine. Cette connaissance guide ton calendrier." },
  { titre: "Ne pas juger", theme: "Sagesse", texte: "Aujourd'hui, quand tu vois quelqu'un, ne juge pas. Ne pense ni 'il est bien' ni 'il est mal'. Regarde-le, c'est tout. Le jugement prend de l'énergie pour rien." },
  { titre: "Remercier son corps", theme: "Santé", texte: "Pose ta main sur ton ventre ce matin. Dis : 'Merci pour la nuit.' Ton corps t'a porté pendant que tu dormais. Il mérite reconnaissance." }
];

// ══════════════════════════════════════════════════════════════════
// 30 MÉDITATIONS (sagesses courtes)
// ══════════════════════════════════════════════════════════════════
const MEDITATIONS = [
  { titre: "Le silence", texte: "Ce que tu cherches dehors dort déjà en toi. Assieds-toi. Écoute. Ne fais rien." },
  { titre: "La patience", texte: "La patience n'est pas de l'attente. C'est une force. Celui qui sait attendre voit plus loin que les autres." },
  { titre: "Les mots", texte: "La bouche qui parle beaucoup fatigue l'oreille qui écoute. Parle moins. Écoute plus. Tu apprendras plus en 1 an qu'en 10." },
  { titre: "La colère", texte: "Quand tu es en colère, attends 24 heures avant de répondre. Si tu réponds à chaud, tu réponds avec ton ventre. Pas ta tête." },
  { titre: "L'argent", texte: "L'argent qui dort attire l'argent qui travaille. Fais circuler. Aide quelqu'un. Achète quelque chose de juste. Ne laisse pas ton argent s'endormir avec toi." },
  { titre: "La solitude", texte: "Être seul n'est pas être vide. Parfois, c'est le moment où la tête se lave. Ne cherche pas à remplir le silence par du bruit." },
  { titre: "Le pardon", texte: "Pardonner n'est pas oublier. C'est arrêter de porter quelque chose qui n'est plus à toi. Pose-le. Tu marcheras mieux." },
  { titre: "Le travail", texte: "Fais ton travail comme si tu étais le seul à le faire. Mais ne crois pas que le monde s'arrête sans toi. Les deux ensemble, c'est la paix." },
  { titre: "L'amitié", texte: "Un ami, ce n'est pas celui qui te flatte. C'est celui qui te dit la vérité sans vouloir t'humilier. Garde ceux-là." },
  { titre: "La famille", texte: "Ta famille te connaît mieux que tous. Pas parce qu'elle a raison. Parce qu'elle t'a vu grandir. Écoute-la. Mais décide toi-même." },
  { titre: "Les enfants", texte: "Les enfants apprennent ce qu'ils voient, pas ce que tu leur dis. Si tu veux qu'ils soient doux, sois doux devant eux." },
  { titre: "La peur", texte: "La peur n'est pas ton ennemie. C'est ton garde. Elle te dit où sont les dangers. Écoute-la. Ne la laisse juste pas décider à ta place." },
  { titre: "Le corps", texte: "Ton corps est le seul bien qui t'accompagne jusqu'au bout. Traite-le bien. Repose-le. Nourris-le. Il te le rendra." },
  { titre: "La vérité", texte: "La vérité ne change pas selon à qui tu parles. Si ta version change, ce n'est plus la vérité. C'est une histoire. Méfie-toi." },
  { titre: "Le respect", texte: "On n'obtient pas le respect en criant. On l'obtient en étant soi-même, sans s'excuser. Ceux qui te respectent le feront sans qu'on leur demande." },
  { titre: "Le don", texte: "Ce que tu donnes sans attendre te revient toujours. Pas toujours de la même personne. Pas toujours au même moment. Mais ça revient." },
  { titre: "L'écoute", texte: "Écouter, ce n'est pas attendre son tour de parler. C'est vraiment laisser entrer ce que dit l'autre. Essaie une fois. Tu verras la différence." },
  { titre: "Le temps", texte: "Ne cours pas après le temps. Il ne t'attend pas. Marche à ton rythme. Celui qui va trop vite arrive fatigué. Celui qui va juste arrive bien." },
  { titre: "Le lâcher-prise", texte: "Ce que tu ne peux pas changer, pose-le. Le porter ne change rien. Le poser, oui. Ça change ta journée." },
  { titre: "L'humilité", texte: "Ce que tu sais, d'autres le savent. Ce que tu ignores, d'autres le savent aussi. Reste assis. Écoute. Grandis." },
  { titre: "L'espoir", texte: "Après la nuit, il y a toujours un matin. C'est la seule certitude. Ce que tu vis maintenant, dur, il passe. Tiens bon." },
  { titre: "La mémoire", texte: "N'oublie pas ceux qui t'ont aidé. Ce n'est pas de la dette. C'est de la gratitude. Ceux qui se souviennent sont plus légers." },
  { titre: "La différence", texte: "Tu n'es pas obligé de ressembler aux autres. Ce qui te rend unique n'est pas un défaut. C'est peut-être exactement ce qui te sauvera un jour." },
  { titre: "L'action", texte: "Trop réfléchir tue l'action. Après avoir réfléchi raisonnablement, agis. Le monde appartient à ceux qui font, pas à ceux qui pensent faire." },
  { titre: "Le repos", texte: "Le repos du corps n'est pas de la paresse. C'est une sagesse. Ceux qui s'épuisent jeunes arrivent nulle part. Ceux qui savent s'arrêter arrivent loin." },
  { titre: "Le regard des autres", texte: "Ce que les autres pensent de toi change tout le temps. Leur opinion n'est pas ta vérité. Regarde-toi dans tes propres yeux. Là, tu verras qui tu es." },
  { titre: "La joie", texte: "La joie n'est pas dehors. Elle vient de ce que tu fais avec ce que tu as. Un jour simple peut être joyeux. Un jour riche peut être vide." },
  { titre: "La mort", texte: "Penser à la mort n'est pas triste. C'est sage. Ça remet chaque chose à sa place. Que ferais-tu aujourd'hui si c'était le dernier ? Fais-le." },
  { titre: "Le commencement", texte: "Tu peux commencer quelque chose aujourd'hui. Même petit. Une marche, un livre, un appel. Le meilleur moment pour commencer, c'est toujours maintenant." },
  { titre: "La fin", texte: "Ce qui se termine te laisse de la place pour autre chose. Ne t'accroche pas à ce qui part. Ouvre tes mains. Le prochain cadeau arrive." }
];

// ══════════════════════════════════════════════════════════════════
// 30 RITUELS DU SOIR
// ══════════════════════════════════════════════════════════════════
const RITUELS_SOIR = [
  { titre: "Le verre d'eau sous le lit", theme: "Protection", texte: "Ce soir avant de dormir, pose un verre d'eau claire sous ton lit. Demain matin, jette l'eau dehors par la porte. Nouveau verre chaque soir. L'eau absorbe ce que la journée a laissé." },
  { titre: "Pieds dans l'eau salée", theme: "Santé", texte: "Mets tes pieds dans un seau d'eau chaude avec une poignée de gros sel. 10 minutes. Pendant ce temps, ne fais rien. Les pieds portent toute la journée. Laisse-les se vider." },
  { titre: "Le récap de la journée", theme: "Sagesse", texte: "Avant de dormir, pense à 3 choses. Ce qui a été bien aujourd'hui. Ce qui a été dur. Ce que tu feras demain. 2 minutes. Ensuite, tu dors." },
  { titre: "Fermer les fenêtres", theme: "Protection", texte: "Avant de dormir, ferme bien toutes tes fenêtres. Le corps se repose mieux dans un espace fermé. La nuit, l'air qui circule trop emporte l'énergie du corps." },
  { titre: "Ne pas balayer", theme: "Protection", texte: "Ne balaie PAS après le coucher du soleil. Ce que tu balaies le soir sort de la maison et ne revient pas. Attends demain matin." },
  { titre: "Le thé de citronnelle", theme: "Santé", texte: "Bois une tisane de citronnelle avant de dormir. Chaude, sans sucre. Ça calme le ventre et prépare le sommeil." },
  { titre: "Le clou de girofle", theme: "Santé", texte: "Mâche un clou de girofle après ton repas du soir. Haleine propre, digestion bonne, sommeil profond." },
  { titre: "Écrire ses rêves", theme: "Signes", texte: "Avant de dormir, pose un cahier et un stylo près de ton lit. Demain au réveil, écris ton rêve AVANT de parler à qui que ce soit. C'est là que le rêve parle." },
  { titre: "Le silence de 3 minutes", theme: "Sagesse", texte: "Reste assis 3 minutes dans le noir avant de te coucher. Sans téléphone. Le corps passe de la journée à la nuit doucement." },
  { titre: "Pardonner avant de dormir", theme: "Pardon", texte: "S'il y a quelqu'un qui t'a blessé aujourd'hui, dis dans ton cœur : 'Je te libère.' Pas pour lui. Pour toi. Pour dormir léger." },
  { titre: "La porte ouverte", theme: "Protection", texte: "Si tu as reçu quelqu'un de lourd aujourd'hui, retourne ton miroir face au mur ce soir. Demain matin, remets-le." },
  { titre: "L'encens", theme: "Purification", texte: "Brûle un peu d'encens naturel dans ta chambre ce soir. Laisse la fumée monter 2 minutes. Ça purifie l'air et l'esprit." },
  { titre: "Le remerciement", theme: "Gratitude", texte: "Dis merci pour ta journée. Même si elle a été dure. Tu es là, tu es vivant, tu as un lit. Commence par ça." },
  { titre: "Ne pas regarder le téléphone", theme: "Sommeil", texte: "Pose ton téléphone 30 minutes avant de dormir. Pas dans ton lit. Sur une table. Ton cerveau a besoin de silence pour s'endormir." },
  { titre: "La respiration", theme: "Santé", texte: "Allongé, respire lentement. 4 secondes inspiration, 6 secondes expiration. 10 fois. Ça calme le cœur et prépare le corps." },
  { titre: "Le câlin", theme: "Amour", texte: "Si tu as quelqu'un dans ton lit, prends-le dans tes bras avant de dormir. Sans rien dire. Le corps parle mieux que la bouche parfois." },
  { titre: "Le verre d'eau sur la table", theme: "Protection", texte: "Laisse un verre d'eau propre sur ta table de chevet. Si tu te réveilles la nuit avec soif, bois. Si tu fais un mauvais rêve, jette-le dehors demain matin." },
  { titre: "Éteindre la lumière", theme: "Sommeil", texte: "Dors dans le noir complet. Pas de veilleuse, pas d'écran. Le corps se répare mieux dans l'obscurité." },
  { titre: "Penser à demain", theme: "Sagesse", texte: "Pense à UNE chose que tu feras demain, en premier. Écris-la sur un papier. Le matin, tu sauras par où commencer." },
  { titre: "Le remerciement à ton corps", theme: "Santé", texte: "Pose ta main sur ton ventre. Dis merci. Le corps a porté toute la journée. Il mérite." },
  { titre: "La lecture de 5 minutes", theme: "Esprit", texte: "Lis 5 minutes d'un livre avant de dormir. Pas un écran. Un vrai livre. Ça change le sommeil." },
  { titre: "Ne pas manger lourd", theme: "Santé", texte: "Ne mange pas lourd après 20h. Le corps digère mal quand il devrait dormir. Un fruit, une soupe légère." },
  { titre: "Fermer la journée", theme: "Sagesse", texte: "Dis dans ta tête : 'La journée est finie.' Ce qui n'a pas été fait attendra demain. Ne porte pas la journée dans ton lit." },
  { titre: "Le sel dans les coins", theme: "Protection", texte: "Si tu peux, mets une pincée de sel dans les 4 coins de ta chambre ce soir. Change chaque dimanche." },
  { titre: "Écrire une chose", theme: "Journal", texte: "Écris une phrase sur ta journée. Une seule. Ce qui a compté. Demain, tu liras et tu comprendras mieux." },
  { titre: "Penser à ceux qu'on aime", theme: "Amour", texte: "Pense à quelqu'un que tu aimes, loin de toi. Envoie-lui une bonne pensée. Le lien reste vivant même sans contact." },
  { titre: "La lune", theme: "Signes", texte: "Si tu peux, regarde la lune avant de dormir. Sa forme te dit où tu en es dans le cycle. Nouvelle lune : planter. Pleine lune : récolter." },
  { titre: "Ne pas se disputer", theme: "Amour", texte: "Ne te dispute pas avec ton conjoint le soir. La nuit garde ce qui s'est dit. Garde les palabres pour demain après-midi." },
  { titre: "Le sommeil comme un cadeau", theme: "Sagesse", texte: "Le sommeil n'est pas une perte de temps. C'est un cadeau à ton corps. Couche-toi tôt. Tu te réveilleras mieux." },
  { titre: "Dormir le ventre vide", theme: "Santé", texte: "Essaie de dormir le ventre léger. 2-3 heures après le repas au moins. Le corps travaille mieux la nuit quand le ventre ne le dérange pas." }
];

// ══════════════════════════════════════════════════════════════════
// 12 THÈMES D'ENSEIGNEMENT HEBDOMADAIRE
// ══════════════════════════════════════════════════════════════════
const THEMES_ENSEIGNEMENT = [
  { titre: "Protéger son foyer", intro: "Cette semaine, on apprend à protéger sa maison et sa famille.", gestes: ["Le verre d'eau sous le lit chaque soir", "Le sel dans les 4 coins chaque dimanche", "Ne pas balayer dehors après le coucher du soleil"], action: "Choisis UN geste et fais-le 7 jours. Puis observe ce qui change dans ta maison." },
  { titre: "Attirer l'argent", intro: "Cette semaine, on apprend à faire circuler l'argent proprement.", gestes: ["Garder le premier billet 24h sans le dépenser", "Poser un verre d'eau propre sur le comptoir chaque matin", "Donner une petite pièce chaque jour à quelqu'un qui en a besoin"], action: "Pendant 7 jours, fais ces 3 gestes. Note si l'argent circule différemment." },
  { titre: "Comprendre ses rêves", intro: "Cette semaine, on apprend à écouter ses rêves.", gestes: ["Écrire son rêve dès le réveil dans un cahier", "Ne pas parler à personne avant d'avoir écrit", "Relire ses rêves le dimanche soir"], action: "Écris tes rêves pendant 7 jours. Le dimanche, lis tout. Tu verras un fil." },
  { titre: "Prendre soin de son corps", intro: "Cette semaine, on apprend à écouter son corps.", gestes: ["Citron chaud + miel à jeun chaque matin", "Pieds dans l'eau salée chaque soir", "Un plat à l'huile de palme rouge le vendredi"], action: "Fais ces 3 gestes 7 jours. Note ton énergie chaque matin sur 10." },
  { titre: "Renforcer son couple", intro: "Cette semaine, on apprend à nourrir son couple.", gestes: ["Un repas à deux sans téléphone", "Un compliment sincère chaque matin", "Ne pas dormir en colère"], action: "Pendant 7 jours, fais ces 3 gestes. Observe le silence entre vous." },
  { titre: "Blinder sa parole", intro: "Cette semaine, on apprend à protéger ses mots.", gestes: ["Ne pas annoncer ses projets avant de les faire", "Ne pas répondre à une provocation pendant 24h", "Le matin, dire 'je fais' et non 'je vais faire'"], action: "Pendant 7 jours, surveille ta bouche. Note quand tu as parlé trop vite." },
  { titre: "Purifier son corps", intro: "Cette semaine, on apprend à se laver l'intérieur.", gestes: ["Bain de basilic le lundi", "Bain de gros sel le mercredi", "Bain de citron le vendredi"], action: "Fais ces 3 bains cette semaine. Note comment tu te sens après chacun." },
  { titre: "Écouter les signes", intro: "Cette semaine, on apprend à lire les signes du quotidien.", gestes: ["Saluer le premier oiseau du matin", "Noter les chiffres qui reviennent", "Observer la direction de la fumée"], action: "Pendant 7 jours, note dans un cahier les signes que tu vois. Relis le dimanche." },
  { titre: "Pardonner", intro: "Cette semaine, on apprend à se libérer.", gestes: ["Penser à une personne qui t'a blessé", "Dire dans ton cœur : 'Je te libère'", "Faire un geste gentil envers elle si possible"], action: "Choisis UNE personne. Fais ces gestes pendant 7 jours. Vois si ton cœur s'allège." },
  { titre: "Élever ses enfants", intro: "Cette semaine, on apprend à accompagner ses enfants.", gestes: ["Ne pas crier pendant 7 jours", "Écouter chaque enfant 5 minutes par jour", "Montrer l'exemple plutôt que commander"], action: "Pendant 7 jours, applique ces 3 règles. Note ce qui change dans la maison." },
  { titre: "S'organiser", intro: "Cette semaine, on apprend à mettre de l'ordre dans sa vie.", gestes: ["Écrire chaque soir UNE chose à faire demain", "Ranger un endroit de la maison chaque jour", "Éteindre le téléphone 30 min avant de dormir"], action: "Fais ces 3 gestes 7 jours. La 7ème nuit, regarde ta maison. Elle parle." },
  { titre: "Grandir en sagesse", intro: "Cette semaine, on apprend à écouter plus.", gestes: ["Écouter quelqu'un sans l'interrompre", "Rester 5 minutes en silence chaque matin", "Appeler un ancien de ta famille"], action: "Pendant 7 jours, applique ces 3 règles. Note ce que tu as appris." }
];

// ══════════════════════════════════════════════════════════════════
// FONCTIONS DE SÉLECTION (rotation quotidienne / hebdo)
// ══════════════════════════════════════════════════════════════════

function getDayOfYear() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / 86400000);
}

function getWeekOfYear() {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d - start;
  return Math.floor(diff / (7 * 86400000));
}

function getRituelMatinDuJour() {
  const idx = getDayOfYear() % RITUELS_MATIN.length;
  return RITUELS_MATIN[idx];
}

function getMeditationDuJour() {
  const idx = getDayOfYear() % MEDITATIONS.length;
  return MEDITATIONS[idx];
}

function getRituelSoirDuJour() {
  const idx = getDayOfYear() % RITUELS_SOIR.length;
  return RITUELS_SOIR[idx];
}

function getThemeDeLaSemaine() {
  const idx = getWeekOfYear() % THEMES_ENSEIGNEMENT.length;
  return THEMES_ENSEIGNEMENT[idx];
}

// ══════════════════════════════════════════════════════════════════
// LES 60 RITUELS (pour le chat)
// ══════════════════════════════════════════════════════════════════
const RITUELS_CONNUS = [
  "RITUELS QUE TU CONNAIS :",
  "",
  "PROTECTION : bain de sel samedi soir, verre d'eau sous le lit, miroir retourné, orange aux clous de girofle, cheveux coupés brûlés, eau vinaigrée sur le seuil, basilic après visite, sel aux coins, encens hebdo, ne pas balayer la nuit.",
  "ARGENT : premier billet gardé 24h, porte main droite, verre d'eau sur le comptoir, riz cru après vente difficile, miel sur la langue, cannelle en poche, gros sel sur chiffon, toucher marchandise main droite, pièce au pauvre, ne pas prêter le matin.",
  "RÊVES : eau claire = argent, serpent = ennemi, dents = perte énergie, eau trouble = palabres, défunt parle = message, oiseau fenêtre = visite, écrire rêves au réveil, chiffres répétés, chat noir, saluer premier oiseau.",
  "SANTÉ : citron chaud + miel, ail dans eau tiède, tisane gingembre, moringa dans sauce, eau de coco, clou de girofle, pieds eau salée, thé citronnelle, huile de palme crue, bouillie mil + gingembre.",
  "AMOUR : repas à deux sans téléphone, verre d'eau lit conjugal, encens quand conjoint loin, ne pas médire belle-famille, ne pas crier sur enfant, bain de basilic vendredi, ne pas raconter problèmes couple.",
  "PAROLE : ne pas annoncer projets, ne pas répondre à chaud 24h, saluer voisins le premier, 'je fais' et non 'je vais faire', demander pardon mains ouvertes, ne pas médire absent, écouter ancien jusqu'au bout.",
  "BAINS : basilic après visite lourde, citron avant décision, gros sel après dispute, eau de mer mensuel, lavage maison, feuilles amères après deuil."
].join("\n");

// ══════════════════════════════════════════════════════════════════
// PROMPT CHAT
// ══════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT_CHAT = "Tu es 'Le Vieux', un sage africain de 70 ans assis sous un manguier. Tu parles comme un vrai vieux du village, pas comme un livre.\n\n" +
"RÈGLES ABSOLUES :\n" +
"1. Tu tutoies TOUJOURS. Jamais 'vous'.\n" +
"2. Réponses COURTES : 2 à 4 phrases.\n" +
"3. Tu ne récites JAMAIS de listes de mots nobles. Tu parles naturellement.\n" +
"4. Tu poses TOUJOURS au moins une question avant de donner un conseil.\n" +
"5. Tu utilises des images SIMPLES : le manguier, la rivière, le marché, les enfants, la terre.\n" +
"6. Tu peux être taquin, moqueur, ou silencieux.\n\n" +
"INTERDIT :\n" +
"- Ne JAMAIS dire 'ancêtre'. Dis 'les anciens'.\n" +
"- Ne JAMAIS dire : 'guérir', 'magie', 'sortilège', 'marabout', 'féticheur'.\n" +
"- Ne JAMAIS dire : 'prospérité', 'sagesse ancestrale', 'tradition des siècles'.\n" +
"- Ne JAMAIS faire de phrases poétiques creuses.\n" +
"- Ne JAMAIS dire 'assieds-toi sous le manguier' à chaque réponse.\n" +
"- Ne JAMAIS proposer un rituel dès le premier message.\n\n" +
"STYLE : Français simple, comme au village.\n\n" +
"EXEMPLES :\n" +
"Q: 'Bonjour' -> R: 'Bonjour. Assieds-toi.'\n" +
"Q: 'Je me sens lourd' -> R: 'Lourd comment ? Le corps, ou la tête ? Raconte.'\n" +
"Q: 'Je suis fatigué' -> R: 'Fatigué de quoi ? Le corps ou la tête ?'\n" +
"Q: 'Je suis triste' -> R: 'Triste pourquoi ? Raconte-moi.'\n\n" +
"RÈGLE DE FIN : chaque phrase est complète.\n\n" +
"===============================================\n" +
RITUELS_CONNUS + "\n" +
"===============================================\n\n" +
"RÈGLES SUR LES RITUELS :\n" +
"- Tu ne proposes JAMAIS un rituel dès le premier message.\n" +
"- Tu écoutes d'abord. Tu poses 2 questions. Tu comprends.\n" +
"- SEULEMENT APRÈS, tu proposes UN SEUL rituel.\n" +
"- Sur 10 réponses : 7 conseils simples, 2 écoute/proverbe, 1 rituel maximum.\n" +
"- Tu n'es pas un guérisseur. Tu es un vieux.\n\n" +
"RÈGLE DE FIN : chaque phrase est complète.";

const SYSTEM_PROMPT_CONTENT = "Tu es 'Le Vieux', un sage africain de 70 ans. Tu écris un texte court.\n\n" +
"RÈGLES :\n" +
"1. Tu tutoies TOUJOURS.\n" +
"2. Tu respectes EXACTEMENT le nombre de phrases demandé.\n" +
"3. Tu ne poses PAS de questions.\n" +
"4. Tu écris simple, direct.\n" +
"5. Tu utilises des images simples.\n\n" +
"INTERDIT :\n" +
"- 'ancêtre', 'magie', 'sortilège', 'marabout', 'féticheur'\n" +
"- 'prospérité', 'sagesse ancestrale'\n" +
"- Formules creuses\n" +
"- Poser des questions\n\n" +
"STYLE : Phrases courtes. Français simple.\n\n" +
"RÈGLE DE FIN : chaque phrase est complète.";

// ══════════════════════════════════════════════════════════════════
// MÉMOIRE DU VIEUX
// ══════════════════════════════════════════════════════════════════

async function getMemory(email) {
  if (!supabase) return null;
  try {
    const key = email.toLowerCase().trim();
    const { data } = await supabase.from('user_memory').select('*').eq('email', key).maybeSingle();
    return data || null;
  } catch (e) { return null; }
}

async function saveMemory(email, firstName, lastTopics, totalQuestions) {
  if (!supabase) return;
  try {
    const key = email.toLowerCase().trim();
    await supabase.from('user_memory').upsert({
      email: key,
      first_name: firstName || null,
      last_topics: lastTopics || null,
      last_seen: Date.now(),
      total_questions: totalQuestions || 0
    });
  } catch (e) { console.error('saveMemory error:', e.message); }
}

function extractFirstName(text) {
  if (!text) return null;
  const patterns = [
    /je m'appelle\s+([A-Za-zÀ-ÿ\-]+)/i,
    /moi c'est\s+([A-Za-zÀ-ÿ\-]+)/i,
    /je suis\s+([A-Za-zÀ-ÿ\-]+)/i,
    /mon nom est\s+([A-Za-zÀ-ÿ\-]+)/i,
    /appelle[- ]moi\s+([A-Za-zÀ-ÿ\-]+)/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const name = m[1].trim();
      if (name.length >= 2 && name.length <= 20) {
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      }
    }
  }
  return null;
}

function extractTopics(history, currentQuestion) {
  const all = [...(history || []).map(m => m.content), currentQuestion].filter(Boolean);
  const userMessages = all.filter(m => typeof m === 'string' && m.length < 200);
  return userMessages.slice(-5).join(' | ').slice(0, 500);
}

// ══════════════════════════════════════════════════════════════════
// UTILITAIRES
// ══════════════════════════════════════════════════════════════════

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

function todayKey() { return new Date().toISOString().split('T')[0]; }
function weekKey() {
  const d = new Date();
  return d.getFullYear() + '-W' + Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 604800000);
}

// ══════════════════════════════════════════════════════════════════
// EDGE TTS
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
// PUSH NOTIFICATIONS
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
        url: url || 'https://le-vieux-production.up.railway.app/',
        priority: 10,
        android_visibility: 1,
        ttl: 259200,
        android_accent_color: 'FFE8A838',
        chrome_web_icon: 'https://le-vieux-production.up.railway.app/icons/icon-192.png',
        chrome_web_badge: 'https://le-vieux-production.up.railway.app/icons/icon-192.png'
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
        subject: 'Bienvenue - La Voix des Anciens',
        html: '<div style="font-family:sans-serif;background:#0a0a0f;color:#fff;padding:2rem;border-radius:16px;max-width:500px;margin:0 auto;"><h1 style="color:#e8a838;">Bienvenue.</h1><p style="color:#8a8a95;">Assieds-toi près de moi. Pose ta première question.</p><a href="https://le-vieux-production.up.railway.app/" style="display:inline-block;background:#e8a838;color:#0a0a0f;padding:0.8rem 1.5rem;border-radius:12px;text-decoration:none;font-weight:600;margin-top:1rem;">Ouvrir l\'app</a></div>'
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
        subject: 'Tes questions offertes sont épuisées',
        html: '<div style="font-family:sans-serif;background:#0a0a0f;color:#fff;padding:2rem;border-radius:16px;max-width:500px;margin:0 auto;"><h1 style="color:#e8a838;text-align:center;">L\'Ancien t\'attend</h1><p style="color:#8a8a95;line-height:1.7;">Mon enfant, tu as posé tes 10 questions offertes.</p><a href="https://le-vieux-production.up.railway.app/" style="display:block;background:#e8a838;color:#0a0a0f;padding:0.9rem;border-radius:12px;text-decoration:none;font-weight:600;text-align:center;">Continuer mon chemin</a></div>'
      })
    });
    const data = await response.json();
    console.log('📧 Email quota épuisé envoyé à', email);
    return data;
  } catch (e) { console.error('Email quota error:', e.message); return null; }
}

// ══════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════
// NOUVELLE ROUTE /today — contenu quotidien structuré
// ══════════════════════════════════════════════════════════════════
app.post('/today', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  const isSubscribed = !!plan;

  const morning = getRituelMatinDuJour();
  const meditation = getMeditationDuJour();
  const evening = getRituelSoirDuJour();

  const eveningAllowed = plan ? await getPermissionValue(key, 'evening') : false;

  const result = {
    morning: {
      titre: morning.titre,
      theme: morning.theme,
      texte: morning.texte,
      locked: false
    },
    meditation: {
      titre: meditation.titre,
      texte: meditation.texte,
      locked: isSubscribed ? false : true,
      teaser: isSubscribed ? null : meditation.texte.split('.').slice(0, 1).join('.') + '.'
    },
    evening: {
      titre: evening.titre,
      theme: evening.theme,
      texte: evening.texte,
      locked: !eveningAllowed,
      teaser: eveningAllowed ? null : evening.texte.split('.').slice(0, 1).join('.') + '.'
    },
    dayIndex: getDayOfYear()
  };

  return res.json(result);
});

// ══════════════════════════════════════════════════════════════════
// NOUVELLE ROUTE /teaching — Enseignement hebdo structuré
// ══════════════════════════════════════════════════════════════════
app.post('/teaching-v2', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  const isSubscribed = !!plan;

  const theme = getThemeDeLaSemaine();

  if (!isSubscribed) {
    return res.json({
      locked: true,
      titre: theme.titre,
      teaser: theme.intro,
      gestesCount: theme.gestes.length
    });
  }

  return res.json({
    locked: false,
    titre: theme.titre,
    intro: theme.intro,
    gestes: theme.gestes,
    action: theme.action,
    weekIndex: getWeekOfYear()
  });
});

// ══════════════════════════════════════════════════════════════════
// NOUVELLE ROUTE /challenge-v2 — Défi 7 jours structuré
// ══════════════════════════════════════════════════════════════════
app.post('/challenge-v2', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const hasAccess = await hasPermission(key, 'challenge');

  if (!hasAccess) {
    return res.status(402).json({ error: 'subscription_required', message: 'Réservé aux plans Sage et Guide.' });
  }

  const theme = getThemeDeLaSemaine();
  const jours = [];
  const weekIdx = getWeekOfYear();

  for (let i = 0; i < 7; i++) {
    const rituel = RITUELS_MATIN[(weekIdx * 7 + i) % RITUELS_MATIN.length];
    jours.push({
      jour: i + 1,
      titre: rituel.titre,
      texte: rituel.texte
    });
  }

  return res.json({
    titre: theme.titre,
    intro: theme.intro,
    action: theme.action,
    jours: jours,
    weekIndex: weekIdx
  });
});

// ══════════════════════════════════════════════════════════════════
// /ask — Chat avec le Vieux
// ══════════════════════════════════════════════════════════════════
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
    const memory = await getMemory(key);
    const detectedName = extractFirstName(question) || (memory && memory.first_name) || null;
    const detectedTopics = extractTopics(history, question);

    let memoryBlock = '';
    if (memory && memory.first_name) {
      memoryBlock += '\n\nL\'utilisateur s\'appelle ' + memory.first_name + '. Appelle-le par son prénom avec parcimonie.\n';
    } else if (detectedName) {
      memoryBlock += '\n\nL\'utilisateur vient de te dire son prénom : ' + detectedName + '.\n';
    }
    if (memory && memory.total_questions > 0) {
      memoryBlock += 'C\'est sa ' + (memory.total_questions + 1) + 'ème question.\n';
    }

    const convertedHistory = convertHistoryForAI(history || []).slice(-12);
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT_CHAT + memoryBlock },
      ...convertedHistory,
      { role: 'user', content: String(question).trim() }
    ];

    const response = await callGroq(messages, 1500, 0.95);
    if (!response || !response.ok) return res.status(500).json({ error: 'ai_error' });
    const data = await response.json();
    const answer = data.choices && data.choices[0] && data.choices[0].message.content;
    if (!answer) return res.status(500).json({ error: 'no_answer' });

    const newTotal = (memory && memory.total_questions || 0) + 1;
    saveMemory(key, detectedName, detectedTopics, newTotal).catch(() => {});

    return res.json({ answer: answer.trim(), isFree, freeRemaining, monthlyRemaining });
  } catch (e) { return res.status(500).json({ error: 'server_error' }); }
});

// ══════════════════════════════════════════════════════════════════
// /library — Conte (génération IA, garde l'ancien style)
// ══════════════════════════════════════════════════════════════════
app.post('/library', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const key = email.toLowerCase().trim();
  const plan = await getPlan(key);
  const isSubscribed = !!plan;
  const libraryLevel = await getPermissionValue(key, 'library');

  const cacheKey = (libraryLevel === 'weekly') ? 'library_week_' + weekKey() : 'library_' + todayKey();
  const prompt = "Tu es 'Le Vieux'. Écris un conte africain court.\n\n" +
"RÈGLES :\n" +
"- Tutoiement JAMAIS (c'est un conte, pas une conversation).\n" +
"- Ton sage, images simples.\n" +
"- Pas de morale explicite avant la fin.\n" +
"- Personnages : un vieux, un jeune, un animal (tortue, lièvre, singe).\n\n" +
"Structure : Titre, 8 phrases de conte, 2 phrases de morale.\n\n" +
"RÈGLE : chaque phrase est complète.";

  try {
    let content = await getCache(cacheKey);
    if (!content) {
      let response = null, attempts = 0;
      while (attempts < 5) {
        attempts++;
        response = await callGroq([{ role: 'user', content: prompt }], 2000, 0.95);
        if (response && response.ok) {
          const data = await response.json();
          const c = data.choices && data.choices[0] && data.choices[0].message.content;
          if (c && c.trim().length > 0) { content = c.trim(); await setCache(cacheKey, content); break; }
        }
        if (attempts < 5) await new Promise(r => setTimeout(r, attempts * 5000));
      }
    }
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

// ══════════════════════════════════════════════════════════════════
// CRONS
// ══════════════════════════════════════════════════════════════════
app.get('/cron/morning', async (req, res) => {
  if (req.query.secret !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  const r = getRituelMatinDuJour();
  const result = await sendPushNotification('🌅 ' + r.titre, r.texte.slice(0, 100) + '...');
  res.json({ success: true, result, rituel: r.titre });
});

app.get('/cron/evening', async (req, res) => {
  if (req.query.secret !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  const r = getRituelSoirDuJour();
  const result = await sendPushNotification('🌙 ' + r.titre, r.texte.slice(0, 100) + '...');
  res.json({ success: true, result, rituel: r.titre });
});

app.get('/cron/weekly', async (req, res) => {
  if (req.query.secret !== CRON_SECRET) return res.status(401).json({ error: 'unauthorized' });
  const t = getThemeDeLaSemaine();
  const result = await sendPushNotification('📖 ' + t.titre, t.intro);
  res.json({ success: true, result, theme: t.titre });
});

// ══════════════════════════════════════════════════════════════════
// ADMIN
// ══════════════════════════════════════════════════════════════════
app.post('/admin/push', async (req, res) => {
  const { pwd, title, message, url } = req.body || {};
  if (pwd !== ADMIN_PWD) return res.status(401).json({ error: 'unauthorized' });
  const result = await sendPushNotification(title || 'L\'Ancien', message || 'Test', url);
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

// ══════════════════════════════════════════════════════════════════
// SUPPORT
// ══════════════════════════════════════════════════════════════════
const AUTO_REPLY = "Merci, ta demande a bien été reçue. On te répond sous 24h.";

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
    await sendPushNotification('Le Vieux t\'a répondu', 'Ta question a reçu une réponse.');
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log('🌳 Le Vieux backend v18.0.0 sur port ' + PORT);
  console.log('🎙️  Edge TTS : ✓ (voix ' + EDGE_VOICE + ')');
  console.log('📿 Contenu structuré : 30 matin + 30 médit + 30 soir + 12 thèmes');
  console.log('🧠 Mémoire : ✓');
});
