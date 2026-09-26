<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#0a0a0f">
<title>La Voix des Anciens</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    :root {
        --bg: #0a0a0f;
        --bg-elevated: #12121a;
        --panel: #16161d;
        --panel-2: #1c1c26;
        --panel-3: #24242f;
        --border: #25252f;
        --ink: #ffffff;
        --ink-dim: #8a8a95;
        --ink-faint: #55555f;
        --accent: #e8a838;
        --accent-bright: #ffb84d;
        --accent-soft: rgba(232, 168, 56, 0.12);
        --success: #4ade80;
        --error: #f87171;
        --radius: 16px;
    }
    html, body { height: 100%; overflow: hidden; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        background: var(--bg);
        color: var(--ink);
        font-size: 15px;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
        letter-spacing: -0.01em;
    }
    .app { display: flex; flex-direction: column; height: 100vh; max-width: 520px; margin: 0 auto; position: relative; background: var(--bg); }

    .app-header { padding: 0.9rem 1rem; display: flex; align-items: center; justify-content: space-between; background: var(--bg); flex-shrink: 0; position: relative; z-index: 10; }
    .header-left { display: flex; align-items: center; gap: 0.7rem; flex: 1; min-width: 0; }
    .sage-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--panel-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border: 1px solid var(--border); }
    .sage-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .sage-avatar svg { width: 20px; height: 20px; stroke: var(--accent); fill: none; }
    .sage-name { font-size: 1rem; color: var(--ink); font-weight: 600; letter-spacing: -0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .header-actions { display: flex; gap: 0.4rem; align-items: center; }
    .icon-btn { width: 38px; height: 38px; border-radius: 50%; border: none; background: var(--panel-2); color: var(--ink-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .icon-btn:active { transform: scale(0.92); background: var(--panel-3); }
    .icon-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 1.8; }
    .icon-btn:hover { color: var(--accent); }

    .screen { flex: 1; overflow-y: auto; padding: 1rem; display: none; animation: fadeIn 0.3s ease; }
    .screen.active { display: block; }
    .screen::-webkit-scrollbar { width: 0; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

    .bottom-nav { display: flex; justify-content: space-around; align-items: center; background: var(--bg-elevated); border-top: 1px solid var(--border); padding: 0.4rem 0.2rem calc(0.4rem + env(safe-area-inset-bottom)); flex-shrink: 0; position: relative; z-index: 10; }
    .nav-item { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.5rem 0.4rem; border-radius: 12px; cursor: pointer; color: var(--ink-faint); transition: all 0.15s; min-width: 54px; border: none; background: transparent; font-family: inherit; }
    .nav-item svg { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .nav-item .nav-label { font-size: 0.62rem; font-weight: 500; letter-spacing: 0.01em; }
    .nav-item.active { color: var(--accent); }
    .nav-item:active { transform: scale(0.94); }

    .card { background: var(--panel); border-radius: var(--radius); padding: 1.1rem; margin-bottom: 0.8rem; position: relative; overflow: hidden; }
    .card-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.8rem; }
    .card-header svg { width: 18px; height: 18px; stroke: var(--accent); fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
    .card-header h2 { font-size: 0.72rem; color: var(--ink-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; }
    .card .text { font-size: 0.92rem; line-height: 1.65; color: var(--ink); }
    .card .text strong { color: var(--accent-bright); font-weight: 600; }
    .card .proverb { font-size: 1.1rem; line-height: 1.5; color: var(--ink); padding: 0.3rem 0; font-weight: 500; }

    .audio-btn {
        background: transparent; border: none; color: var(--accent);
        cursor: pointer; font-size: 0.8rem; padding: 0.4rem 0;
        margin-top: 0.5rem; display: inline-flex; align-items: center; gap: 0.4rem;
        font-family: inherit;
    }
    .audio-btn svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; }
    .audio-btn.playing { color: var(--error); }
    .audio-btn:hover { color: var(--accent-bright); }

    .loading-block { text-align: center; padding: 2rem 1rem; color: var(--ink-dim); font-size: 0.85rem; font-style: italic; }
    .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(232,168,56,0.3); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: middle; margin-right: 0.5rem; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .btn { padding: 0.9rem 1.2rem; border-radius: 14px; border: none; font-family: inherit; font-size: 0.92rem; font-weight: 600; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; letter-spacing: -0.01em; }
    .btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; }
    .btn-primary { width: 100%; background: var(--accent); color: #0a0a0f; }
    .btn-primary:active { transform: scale(0.97); background: var(--accent-bright); }
    .btn-primary:disabled { opacity: 0.4; }
    .btn-secondary { background: var(--panel-2); color: var(--ink); border: 1px solid var(--border); }
    .btn-secondary:active { transform: scale(0.97); background: var(--panel-3); }

    .welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem 1rem; min-height: 100%; position: relative; }
    .welcome::before { content: ''; position: absolute; top: 10%; left: 50%; transform: translateX(-50%); width: 300px; height: 300px; background: radial-gradient(circle, rgba(232,168,56,0.15), transparent 70%); border-radius: 50%; z-index: -1; }
    .welcome-avatar { width: 120px; height: 120px; border-radius: 50%; background: var(--panel-2); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; border: 1px solid var(--border); overflow: hidden; position: relative; }
    .welcome-avatar::after { content: ''; position: absolute; inset: -8px; border-radius: 50%; background: radial-gradient(circle, rgba(232,168,56,0.3), transparent 70%); z-index: -1; animation: pulse 3s ease-in-out infinite; }
    .welcome-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .welcome-avatar svg { width: 60px; height: 60px; stroke: var(--accent); fill: none; stroke-width: 1.2; }
    @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
    .welcome h1 { font-size: 1.7rem; color: var(--ink); font-weight: 700; letter-spacing: -0.03em; margin-bottom: 0.3rem; }
    .welcome-sub { font-size: 0.85rem; color: var(--ink-dim); margin-bottom: 2rem; }
    .welcome-message { font-size: 0.95rem; color: var(--ink-dim); line-height: 1.7; max-width: 340px; margin-bottom: 2rem; padding: 1rem 1.2rem; background: var(--panel); border-radius: var(--radius); border-left: 2px solid var(--accent); text-align: left; }
    .welcome-features { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; margin-bottom: 2rem; max-width: 340px; }
    .feature-pill { padding: 0.4rem 0.85rem; border-radius: 20px; background: var(--panel); font-size: 0.72rem; color: var(--ink-dim); display: flex; align-items: center; gap: 0.35rem; }
    .feature-pill svg { width: 13px; height: 13px; stroke: var(--accent); fill: none; stroke-width: 1.8; stroke-linecap: round; }

    .chat-container { display: flex; flex-direction: column; gap: 0.7rem; padding-bottom: 0.5rem; }
    .message { display: flex; gap: 0.5rem; animation: fadeIn 0.3s; }
    .message.user { flex-direction: row-reverse; }
    .message .msg-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--panel-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; align-self: flex-end; overflow: hidden; border: 1px solid var(--border); }
    .message .msg-avatar svg { width: 16px; height: 16px; stroke: var(--accent); fill: none; stroke-width: 1.8; }
    .message .msg-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .message .bubble { max-width: 78%; padding: 0.75rem 1rem; border-radius: 18px; font-size: 0.9rem; line-height: 1.55; word-wrap: break-word; }
    .message.elder .bubble { background: var(--panel); color: var(--ink); border-bottom-left-radius: 6px; }
    .message.user .bubble { background: var(--accent); color: #0a0a0f; border-bottom-right-radius: 6px; font-weight: 500; }

    .typing-indicator { display: flex; gap: 0.3rem; padding: 0.9rem 1rem; background: var(--panel); border-radius: 18px 18px 18px 6px; width: fit-content; }
    .typing-indicator span { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-faint); animation: bounce 1.2s infinite; }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }

    .chat-input-area { display: flex; gap: 0.5rem; align-items: flex-end; padding: 0.7rem 0; margin-top: auto; position: sticky; bottom: 0; background: var(--bg); }
    .chat-input-area textarea { flex: 1; padding: 0.75rem 1rem; border-radius: 22px; border: 1px solid var(--border); background: var(--panel); color: var(--ink); font-family: inherit; font-size: 0.9rem; resize: none; min-height: 42px; max-height: 100px; line-height: 1.4; }
    .chat-input-area textarea:focus { outline: none; border-color: var(--accent); }
    .chat-input-area textarea::placeholder { color: var(--ink-faint); }
    .circle-btn { width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }
    .circle-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .circle-btn:active { transform: scale(0.92); }
    .mic-btn { background: var(--panel-2); color: var(--ink-dim); }
    .mic-btn:hover { color: var(--accent); }
    .send-btn { background: var(--accent); color: #0a0a0f; }
    .send-btn:disabled { opacity: 0.4; }

    .time-divider { display: flex; align-items: center; gap: 0.8rem; margin: 1.5rem 0 1rem; color: var(--ink-faint); font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.15em; }
    .time-divider::before, .time-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

    .journal-textarea { width: 100%; padding: 1rem; border-radius: 14px; border: 1px solid var(--border); background: var(--panel-2); color: var(--ink); font-family: inherit; font-size: 0.9rem; resize: vertical; min-height: 140px; line-height: 1.6; }
    .journal-textarea:focus { outline: none; border-color: var(--accent); }
    .journal-textarea::placeholder { color: var(--ink-faint); }

    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.7rem; color: var(--ink-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.4rem; }
    .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 0.75rem 1rem; border-radius: 12px; border: 1px solid var(--border); background: var(--panel-2); color: var(--ink); font-family: inherit; font-size: 0.9rem; }
    .form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: var(--accent); }
    .form-group textarea { resize: vertical; min-height: 80px; }
    .radio-group { display: flex; gap: 0.5rem; }
    .radio-group label { flex: 1; padding: 0.7rem; background: var(--panel-2); border: 1px solid var(--border); border-radius: 12px; text-align: center; font-size: 0.85rem; cursor: pointer; color: var(--ink-dim); text-transform: none; letter-spacing: 0; font-weight: 500; transition: all 0.15s; }
    .radio-group input { display: none; }
    .radio-group input:checked + label { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); font-weight: 600; }
    .avatar-uploader { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; margin-bottom: 1rem; }
    .avatar-uploader .preview { width: 100px; height: 100px; border-radius: 50%; background: var(--panel-2); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--border); }
    .avatar-uploader .preview svg { width: 40px; height: 40px; stroke: var(--accent); fill: none; stroke-width: 1.2; }
    .avatar-uploader .preview img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-uploader input[type="file"] { display: none; }

    .plan-card { padding: 1.2rem; background: var(--panel); border-radius: var(--radius); margin-bottom: 0.8rem; position: relative; }
    .plan-card.popular { background: linear-gradient(145deg, var(--panel), var(--panel-2)); border: 1px solid var(--accent); }
    .popular-badge { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); padding: 0.25rem 0.8rem; background: var(--accent); color: #0a0a0f; font-size: 0.62rem; font-weight: 700; border-radius: 20px; letter-spacing: 0.06em; text-transform: uppercase; }
    .plan-card h3 { font-size: 1.1rem; color: var(--ink); margin-bottom: 0.3rem; font-weight: 600; letter-spacing: -0.02em; }
    .plan-price { font-size: 1.6rem; color: var(--accent); font-weight: 700; margin: 0.5rem 0; letter-spacing: -0.03em; }
    .plan-price small { font-size: 0.78rem; color: var(--ink-dim); font-weight: 400; }
    .plan-alt-price { font-size: 0.72rem; color: var(--ink-faint); margin-bottom: 1rem; }
    .plan-card ul { list-style: none; margin: 1rem 0; font-size: 0.85rem; }
    .plan-card ul li { padding: 0.35rem 0; color: var(--ink-dim); display: flex; gap: 0.5rem; align-items: flex-start; }
    .plan-card ul li::before { content: '✓'; color: var(--accent); font-weight: 700; flex-shrink: 0; }
    .plan-card ul li.excluded { opacity: 0.35; }
    .plan-card ul li.excluded::before { content: '✕'; color: var(--ink-faint); }

    .toast { position: fixed; top: 1rem; left: 50%; transform: translateX(-50%) translateY(-100px); background: var(--accent); color: #0a0a0f; padding: 0.8rem 1.3rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; z-index: 2000; opacity: 0; transition: all 0.35s; max-width: 90vw; box-shadow: 0 8px 30px rgba(0,0,0,0.4); }
    .toast.visible { transform: translateX(-50%) translateY(0); opacity: 1; }
    .toast.success { background: var(--success); color: #052e16; }
    .toast.error { background: var(--error); color: #450a0a; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); z-index: 1000; display: none; align-items: center; justify-content: center; padding: 1rem; }
    .modal-overlay.visible { display: flex; }
    .modal { background: var(--panel); border-radius: 20px; padding: 2rem 1.5rem; max-width: 380px; width: 100%; text-align: center; animation: fadeIn 0.4s; }
    .modal-icon { width: 60px; height: 60px; background: var(--accent-soft); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; }
    .modal-icon svg { width: 28px; height: 28px; stroke: var(--accent); fill: none; stroke-width: 1.6; stroke-linecap: round; }
    .modal h2 { font-size: 1.2rem; color: var(--ink); margin-bottom: 0.5rem; font-weight: 600; letter-spacing: -0.02em; }
    .modal p { color: var(--ink-dim); font-size: 0.88rem; line-height: 1.6; margin-bottom: 1.2rem; }
    .modal input { width: 100%; padding: 0.9rem 1rem; border-radius: 12px; border: 1px solid var(--border); background: var(--bg); color: var(--ink); font-family: inherit; font-size: 0.95rem; text-align: center; margin-bottom: 1rem; }
    .modal input:focus { outline: none; border-color: var(--accent); }
    .modal input::placeholder { color: var(--ink-faint); }
</style>
</head>
<body>

<div class="app">

    <header class="app-header">
        <div class="header-left">
            <div class="sage-avatar" id="header-avatar">
                <svg viewBox="0 0 24 24"><path d="M12 2C8 2 6 5 6 8c0 2 1 3 1 5 0 1-1 2-1 4 0 2 2 5 6 5s6-3 6-5c0-2-1-3-1-4 0-2 1-3 1-5 0-3-2-6-6-6z"/><path d="M10 13c.5.5 1 .8 2 .8s1.5-.3 2-.8"/></svg>
            </div>
            <div class="sage-name" id="header-sage-name">Le Vieux</div>
        </div>
        <div class="header-actions">
            <button class="icon-btn" id="admin-btn" title="Mon Sage">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
        </div>
    </header>

    <main class="screen active" id="screen-home">
        <div class="welcome">
            <div class="welcome-avatar" id="welcome-avatar">
                <svg viewBox="0 0 24 24"><path d="M12 2C8 2 6 5 6 8c0 2 1 3 1 5 0 1-1 2-1 4 0 2 2 5 6 5s6-3 6-5c0-2-1-3-1-4 0-2 1-3 1-5 0-3-2-6-6-6z"/><path d="M10 13c.5.5 1 .8 2 .8s1.5-.3 2-.8"/></svg>
            </div>
            <h1 id="welcome-title">Le Vieux</h1>
            <p class="welcome-sub">Sagesse ancestrale · Guidance quotidienne</p>
            <div class="welcome-message" id="welcome-message">
                « Bienvenue, mon enfant. Assieds-toi près de moi. Je suis là pour t'écouter et te guider sur ton chemin. »
            </div>
            <div class="welcome-features">
                <span class="feature-pill"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chat</span>
                <span class="feature-pill"><svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3"/></svg>Audio</span>
                <span class="feature-pill"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>Rituels</span>
                <span class="feature-pill"><svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>Contes</span>
            </div>
            <button class="btn btn-primary" id="start-btn" style="max-width: 340px;">
                Commencer mon chemin
            </button>
        </div>
    </main>

    <main class="screen" id="screen-chat">
        <div class="chat-container" id="chat-container">
            <div class="message elder">
                <div class="msg-avatar" id="chat-avatar">
                    <svg viewBox="0 0 24 24"><path d="M12 2C8 2 6 5 6 8c0 2 1 3 1 5 0 1-1 2-1 4 0 2 2 5 6 5s6-3 6-5c0-2-1-3-1-4 0-2 1-3 1-5 0-3-2-6-6-6z"/><path d="M10 13c.5.5 1 .8 2 .8s1.5-.3 2-.8"/></svg>
                </div>
                <div>
                    <div class="bubble">Approche, mon enfant. Assieds-toi près de moi, à l'ombre de cet arbre. Pose-moi ta question — sur la vie, la sagesse, l'amour, la peur, ou ce que tu portes dans le cœur.</div>
                    <button class="audio-btn" onclick="toggleAudio(this)" data-text="Approche, mon enfant. Assieds-toi près de moi, à l'ombre de cet arbre. Pose-moi ta question, sur la vie, la sagesse, l'amour, la peur, ou ce que tu portes dans le cœur.">
                        <svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                        Écouter
                    </button>
                </div>
            </div>
        </div>
        <div class="chat-input-area">
            <button class="circle-btn mic-btn" id="mic-btn" title="Question audio">
                <svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3"/></svg>
            </button>
            <textarea id="user-input" placeholder="Écris ta question..." rows="1"></textarea>
            <button class="circle-btn send-btn" id="send-btn" title="Envoyer">
                <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            </button>
        </div>
    </main>

    <main class="screen" id="screen-today">
        <div class="card" id="card-morning">
            <div class="card-header">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
                <h2>Proverbe du matin</h2>
            </div>
            <div class="loading-block"><span class="spinner"></span>Le Vieux prépare ton proverbe…</div>
        </div>
        <div class="card" id="card-meditation">
            <div class="card-header">
                <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                <h2>Méditation du matin</h2>
            </div>
            <div class="loading-block"><span class="spinner"></span>Chargement…</div>
        </div>
        <div class="time-divider">Soir</div>
        <div class="card" id="card-evening">
            <div class="card-header">
                <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                <h2>Rituel du soir</h2>
            </div>
            <div class="loading-block"><span class="spinner"></span>Chargement…</div>
        </div>
    </main>

    <main class="screen" id="screen-teaching">
        <div class="card">
            <div class="loading-block" id="teaching-loading"><span class="spinner"></span>Le Vieux prépare sa leçon…</div>
            <div id="teaching-content" style="display:none;"></div>
        </div>
    </main>

    <main class="screen" id="screen-challenge">
        <div class="card">
            <div class="loading-block" id="challenge-loading"><span class="spinner"></span>Le Vieux prépare ton défi…</div>
            <div id="challenge-content" style="display:none;"></div>
        </div>
    </main>

    <main class="screen" id="screen-journal">
        <div class="card">
            <div class="card-header">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                <h2>Mon journal</h2>
            </div>
            <div style="font-size:0.75rem; color:var(--ink-dim); margin-bottom:0.6rem;">Écris ce que tu ressens. Personne d'autre ne le verra.</div>
            <textarea class="journal-textarea" id="journal-input" placeholder="Aujourd'hui, je ressens..."></textarea>
            <div style="display:flex; gap:0.5rem; margin-top:0.8rem;">
                <button class="btn btn-secondary" style="flex:1;"><svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3"/></svg>Dicter</button>
                <button class="btn btn-primary" style="flex:2;" id="journal-save-btn"><svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>Sauvegarder</button>
            </div>
        </div>
    </main>

    <main class="screen" id="screen-library">
        <div class="card">
            <div class="loading-block" id="library-loading"><span class="spinner"></span>Le Vieux cherche un conte…</div>
            <div id="library-content" style="display:none;"></div>
        </div>
    </main>

    <main class="screen" id="screen-admin">
        <div class="card">
            <div class="card-header">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
                <h2>Profil du Sage</h2>
            </div>
            <div class="avatar-uploader">
                <div class="preview" id="admin-avatar-preview"><svg viewBox="0 0 24 24"><path d="M12 2C8 2 6 5 6 8c0 2 1 3 1 5 0 1-1 2-1 4 0 2 2 5 6 5s6-3 6-5c0-2-1-3-1-4 0-2 1-3 1-5 0-3-2-6-6-6z"/><path d="M10 13c.5.5 1 .8 2 .8s1.5-.3 2-.8"/></svg></div>
                <input type="file" id="admin-avatar-input" accept="image/*">
                <button class="btn btn-secondary" id="admin-avatar-btn"><svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Changer la photo</button>
            </div>
            <div class="form-group"><label>Nom du Sage</label><input type="text" id="admin-sage-name" value="Le Vieux"></div>
            <div class="form-group"><label>Titre / Rôle</label><input type="text" id="admin-sage-title" value="Sage africain"></div>
            <div class="form-group"><label>Message d'accueil</label><textarea id="admin-welcome-msg">« Bienvenue, mon enfant. Assieds-toi près de moi. Je suis là pour t'écouter et te guider sur ton chemin. »</textarea></div>
        </div>
        <div class="card">
            <div class="card-header">
                <svg viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3"/></svg>
                <h2>Voix du Sage</h2>
            </div>
            <div class="form-group">
                <label>Sexe de la voix</label>
                <div class="radio-group">
                    <input type="radio" name="voice-gender" id="voice-male" value="male" checked>
                    <label for="voice-male">Homme</label>
                    <input type="radio" name="voice-gender" id="voice-female" value="female">
                    <label for="voice-female">Femme</label>
                </div>
            </div>
        </div>
        <button class="btn btn-primary" id="admin-save-btn" style="width:100%;"><svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>Sauvegarder les modifications</button>
    </main>

    <main class="screen" id="screen-subscribe">
        <h2 style="text-align:center; color:var(--ink); font-size:1.4rem; font-weight:600; margin-bottom:0.3rem; letter-spacing:-0.02em;">Choisis ton chemin</h2>
        <p style="text-align:center; color:var(--ink-dim); font-size:0.85rem; margin-bottom:1.5rem;">Accède à la sagesse ancestrale</p>
        <div class="plan-card">
            <h3>Découverte</h3>
            <div class="plan-price">5 000 <small>FCFA / mois</small></div>
            <div class="plan-alt-price">≈ 7,60 € · ≈ 8,30 $</div>
            <ul>
                <li>30 questions / mois</li>
                <li>Proverbe du matin</li>
                <li>Enseignement hebdo</li>
                <li>Contes africains</li>
                <li class="excluded">Chat audio</li>
                <li class="excluded">Rituel du soir</li>
                <li class="excluded">Défi 7 jours</li>
                <li class="excluded">Journal personnel</li>
            </ul>
            <button class="btn btn-secondary" style="width:100%;" onclick="subscribe('decouverte')">Choisir Découverte</button>
        </div>
        <div class="plan-card popular">
            <div class="popular-badge">Populaire</div>
            <h3>Sage</h3>
            <div class="plan-price">10 000 <small>FCFA / mois</small></div>
            <div class="plan-alt-price">≈ 15,20 € · ≈ 16,60 $</div>
            <ul>
                <li>Chat illimité</li>
                <li>Chat audio (30 min / mois)</li>
                <li>Proverbe du matin</li>
                <li>Rituel du soir</li>
                <li>Enseignement hebdo</li>
                <li>Défi 7 jours</li>
                <li>Journal personnel</li>
                <li>Contes africains</li>
                <li>Réponses audio</li>
            </ul>
            <button class="btn btn-primary" style="width:100%;" onclick="subscribe('sage')">Choisir Sage</button>
        </div>
        <div class="plan-card">
            <h3>Guide</h3>
            <div class="plan-price">20 000 <small>FCFA / mois</small></div>
            <div class="plan-alt-price">≈ 30,50 € · ≈ 33,20 $</div>
            <ul>
                <li>Tout le niveau Sage</li>
                <li>Chat audio illimité</li>
                <li>Coaching personnalisé</li>
                <li>Accès VIP communauté</li>
                <li>Questions prioritaires</li>
                <li>Contenu exclusif</li>
            </ul>
            <button class="btn btn-secondary" style="width:100%;" onclick="subscribe('guide')">Choisir Guide</button>
        </div>
        <div style="text-align:center; font-size:0.72rem; color:var(--ink-faint); margin-top:1rem; line-height:1.8;">Paiement sécurisé par Chariow<br>Annulation à tout moment</div>
    </main>

    <main class="screen" id="screen-community">
        <div class="card">
            <div class="card-header">
                <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <h2>Le Cercle des Anciens</h2>
            </div>
            <div class="text">Tu n'es pas seul sur ce chemin. D'autres marchent avec toi.</div>
        </div>
    </main>

    <nav class="bottom-nav">
        <button class="nav-item active" data-screen="chat"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span class="nav-label">Chat</span></button>
        <button class="nav-item" data-screen="today"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg><span class="nav-label">Aujourd'hui</span></button>
        <button class="nav-item" data-screen="teaching"><svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><span class="nav-label">Leçons</span></button>
        <button class="nav-item" data-screen="challenge"><svg viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg><span class="nav-label">Défi</span></button>
        <button class="nav-item" data-screen="library"><svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg><span class="nav-label">Contes</span></button>
    </nav>
</div>

<div class="modal-overlay" id="email-modal">
    <div class="modal">
        <div class="modal-icon">
            <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
        </div>
        <h2>Bienvenue</h2>
        <p>Entre ton email pour que le Sage se souvienne de toi.</p>
        <input type="email" id="email-input" placeholder="ton@email.com">
        <button class="btn btn-primary" style="width:100%;" id="email-save-btn">Commencer</button>
    </div>
</div>

<div class="toast" id="toast">Message</div>

<script>
const BACKEND_URL = 'https://le-vieux-production.up.railway.app';

const state = {
    email: null,
    access: null,
    sageConfig: {
        name: 'Le Vieux',
        title: 'Sage africain',
        welcomeMessage: '« Bienvenue, mon enfant. Assieds-toi près de moi. Je suis là pour t\'écouter et te guider sur ton chemin. »',
        avatar: null,
        voiceGender: 'male'
    },
    isSending: false,
    loaded: {},
    currentAudioBtn: null
};

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast visible ' + type;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
}

function formatMarkdown(text) {
    if (!text) return '';
    let html = esc(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/^[-•]\s+(.+)$/gm, '• $1');
    html = html.replace(/\n/g, '<br>');
    return html;
}

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + screenName);
    if (screen) screen.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.screen === screenName);
    });
    loadContentForScreen(screenName);
}

async function loadContentForScreen(screenName) {
    if (!state.email) return;
    if (state.loaded[screenName]) return;
    state.loaded[screenName] = true;

    if (screenName === 'today') await loadToday();
    if (screenName === 'teaching') await loadTeaching();
    if (screenName === 'challenge') await loadChallenge();
    if (screenName === 'library') await loadLibrary();
}

function renderPaywall(message) {
    return '<div style="text-align:center; padding:1.5rem 1rem;">' +
        '<div style="font-size:2.5rem; margin-bottom:0.8rem;">🔒</div>' +
        '<h3 style="color:var(--accent); font-size:1.1rem; margin-bottom:0.5rem;">Réservé aux abonnés</h3>' +
        '<p style="color:var(--ink-dim); font-size:0.88rem; line-height:1.6; margin-bottom:1.2rem;">' + esc(message) + '</p>' +
        '<button class="btn btn-primary" onclick="showScreen(\'subscribe\')">' +
            'Voir les offres' +
        '</button>' +
    '</div>';
}

// ══════════════════════════════════════════════════════════════════
// CHARGEMENT DES CONTENUS
// ══════════════════════════════════════════════════════════════════

function renderDailyCard(card, icon, title, content) {
    card.innerHTML = 
        '<div class="card-header">' +
            icon +
            '<h2>' + title + '</h2>' +
        '</div>' +
        '<div class="text">' + formatMarkdown(content) + '</div>' +
        '<button class="audio-btn" onclick="toggleAudio(this)" data-text="' + esc(content).replace(/"/g, '&quot;') + '">' +
            '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>Écouter' +
        '</button>';
}

async function loadToday() {
    const icons = {
        morning: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
        meditation: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
        evening: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
    };

    // 1. Proverbe du matin
    await loadDailyCard('card-morning', 'morning', 'Proverbe du matin', icons.morning);
    // 2. Méditation du matin
    await loadDailyCard('card-meditation', 'meditation', 'Méditation du matin', icons.meditation);
    // 3. Rituel du soir
    await loadDailyCard('card-evening', 'evening', 'Rituel du soir', icons.evening);
}

async function loadDailyCard(cardId, type, title, icon) {
    const card = document.getElementById(cardId);
    try {
        const res = await fetch(BACKEND_URL + '/daily', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: state.email, type: type })
        });
        
        if (res.status === 402) {
            card.innerHTML = 
                '<div class="card-header">' + icon + '<h2>' + title + '</h2></div>' +
                renderPaywall('Ce contenu est réservé aux abonnés.');
            return;
        }
        
        const data = await res.json();
        
        if (data.content) {
            renderDailyCard(card, icon, title, data.content);
        } else {
            card.innerHTML = 
                '<div class="card-header">' + icon + '<h2>' + title + '</h2></div>' +
                '<div class="loading-block">Le Vieux prépare ce contenu. Reviens dans un instant.</div>';
        }
    } catch (e) {
        card.innerHTML = 
            '<div class="card-header">' + icon + '<h2>' + title + '</h2></div>' +
            '<div class="loading-block">Erreur de connexion.</div>';
    }
}

async function loadTeaching() {
    const loading = document.getElementById('teaching-loading');
    const content = document.getElementById('teaching-content');
    try {
        const res = await fetch(BACKEND_URL + '/teaching', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: state.email })
        });
        
        loading.style.display = 'none';
        content.style.display = 'block';
        
        if (res.status === 402) {
            content.innerHTML = renderPaywall('Cet enseignement est réservé aux abonnés.');
            return;
        }
        
        const data = await res.json();
        
        if (data.content) {
            content.innerHTML = 
                '<div class="card-header">' +
                    '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' +
                    '<h2>Enseignement de la semaine</h2>' +
                '</div>' +
                '<div class="text" style="margin-bottom:1rem;">' + formatMarkdown(data.content) + '</div>' +
                '<button class="audio-btn" onclick="toggleAudio(this)" data-text="' + esc(data.content).replace(/"/g, '&quot;') + '">' +
                    '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>Écouter Le Vieux' +
                '</button>';
        } else {
            content.innerHTML = '<div class="loading-block">Reviens plus tard.</div>';
        }
    } catch (e) {
        loading.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = '<div class="loading-block">Erreur de connexion.</div>';
    }
}

async function loadChallenge() {
    const loading = document.getElementById('challenge-loading');
    const content = document.getElementById('challenge-content');
    try {
        const res = await fetch(BACKEND_URL + '/challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: state.email })
        });
        
        loading.style.display = 'none';
        content.style.display = 'block';
        
        if (res.status === 402) {
            content.innerHTML = renderPaywall('Ce défi est réservé aux abonnés.');
            return;
        }
        
        const data = await res.json();
        
        if (data.content) {
            content.innerHTML = 
                '<div class="card-header">' +
                    '<svg viewBox="0 0 24 24"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>' +
                    '<h2>Défi de la semaine</h2>' +
                '</div>' +
                '<div class="text" style="margin-bottom:1rem;">' + formatMarkdown(data.content) + '</div>' +
                '<button class="audio-btn" onclick="toggleAudio(this)" data-text="' + esc(data.content).replace(/"/g, '&quot;') + '">' +
                    '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>Écouter Le Vieux' +
                '</button>';
        } else {
            content.innerHTML = '<div class="loading-block">Reviens plus tard.</div>';
        }
    } catch (e) {
        loading.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = '<div class="loading-block">Erreur de connexion.</div>';
    }
}

async function loadLibrary() {
    const loading = document.getElementById('library-loading');
    const content = document.getElementById('library-content');
    try {
        const res = await fetch(BACKEND_URL + '/library', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: state.email })
        });
        
        loading.style.display = 'none';
        content.style.display = 'block';
        
        if (res.status === 402) {
            content.innerHTML = renderPaywall('Les contes sont réservés aux abonnés.');
            return;
        }
        
        const data = await res.json();
        
        if (data.content) {
            content.innerHTML = 
                '<div class="card-header">' +
                    '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' +
                    '<h2>Conte du jour</h2>' +
                '</div>' +
                '<div class="text" style="margin-bottom:1rem;">' + formatMarkdown(data.content) + '</div>' +
                '<button class="audio-btn" onclick="toggleAudio(this)" data-text="' + esc(data.content).replace(/"/g, '&quot;') + '">' +
                    '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>Écouter le conte' +
                '</button>';
        } else {
            content.innerHTML = '<div class="loading-block">Reviens plus tard.</div>';
        }
    } catch (e) {
        loading.style.display = 'none';
        content.style.display = 'block';
        content.innerHTML = '<div class="loading-block">Erreur de connexion.</div>';
    }
}

// ══════════════════════════════════════════════════════════════════
// SYNTHÈSE VOCALE — AVEC BOUTON STOP
// ══════════════════════════════════════════════════════════════════
function findBestVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const frVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('fr'));
    if (!frVoices.length) return null;

    const wantMale = state.sageConfig.voiceGender === 'male';
    const maleNames = /thomas|paul|nicolas|guillaume|henri|david|daniel|georges|yannick|male|homme|claude|pierre/i;
    const femaleNames = /amelie|amélie|audrey|marie|julie|female|femme|chantal|celine|céline|virginie|google français/i;

    const preferred = frVoices.find(v => wantMale ? maleNames.test(v.name) : femaleNames.test(v.name));
    if (preferred) return preferred;
    if (frVoices.length >= 2) return frVoices[wantMale ? 1 : 0];
    return frVoices[0];
}

function cleanTextForSpeech(text) {
    let cleaned = String(text);
    cleaned = cleaned
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u2600-\u26FF]/g, '')
        .replace(/[\u2700-\u27BF]/g, '');
    cleaned = cleaned.replace(/\*\*/g, '').replace(/\*/g, '');
    cleaned = cleaned.replace(/[''`]/g, '');
    cleaned = cleaned
        .replace(/\bquestceque\b/gi, 'keskeu')
        .replace(/\bquestcequ\b/gi, 'keskeu')
        .replace(/\bestceque\b/gi, 'esskeu')
        .replace(/\bestcequ\b/gi, 'esskeu')
        .replace(/\baujourdhui\b/gi, 'aujourd hui');
    cleaned = cleaned.replace(/[«»"]/g, '');
    cleaned = cleaned.replace(/[-–—]/g, ' ');
    cleaned = cleaned.replace(/[;:]/g, ',');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

function speakText(text, btn) {
    if (!('speechSynthesis' in window)) {
        showToast('Lecture audio non supportée', 'error');
        return;
    }
    
    window.speechSynthesis.cancel();
    
    if (state.currentAudioBtn && state.currentAudioBtn !== btn) {
        state.currentAudioBtn.classList.remove('playing');
        state.currentAudioBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>Écouter';
    }
    
    if (btn && btn.classList.contains('playing')) {
        window.speechSynthesis.cancel();
        btn.classList.remove('playing');
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>Écouter';
        state.currentAudioBtn = null;
        return;
    }
    
    const cleaned = cleanTextForSpeech(text);
    const voice = findBestVoice();
    
    const sentences = cleaned
        .match(/[^.!?…]+[.!?…]+/g)
        ?.map(s => s.trim())
        .filter(s => s.length > 0) || [cleaned];
    
    if (btn) {
        btn.classList.add('playing');
        btn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>Arrêter';
        state.currentAudioBtn = btn;
    }
    
    sentences.forEach((sentence, index) => {
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.82;
        utterance.pitch = 0.55;
        utterance.volume = 1;
        if (voice) utterance.voice = voice;
        
        if (index === sentences.length - 1) {
            utterance.onend = () => {
                if (btn) {
                    btn.classList.remove('playing');
                    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>Écouter';
                }
                if (state.currentAudioBtn === btn) state.currentAudioBtn = null;
            };
        }
        window.speechSynthesis.speak(utterance);
    });
    
    showToast('Le Vieux te parle...');
}

function toggleAudio(btn) {
    const text = btn.dataset.text || '';
    speakText(text, btn);
}

// ══════════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════════
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => showScreen(item.dataset.screen));
});

document.getElementById('start-btn').addEventListener('click', () => {
    if (!state.email) {
        document.getElementById('email-modal').classList.add('visible');
    } else {
        showScreen('chat');
    }
});

document.getElementById('admin-btn').addEventListener('click', () => showScreen('admin'));

document.getElementById('email-save-btn').addEventListener('click', async () => {
    const email = document.getElementById('email-input').value.trim();
    if (!email || !email.includes('@')) {
        showToast('Email invalide', 'error');
        return;
    }
    state.email = email;
    localStorage.setItem('levieux_email', email);
    document.getElementById('email-modal').classList.remove('visible');
    showScreen('chat');
    showToast('Bienvenue');
    await checkAccess();
    state.loaded = {};
});

document.getElementById('email-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('email-save-btn').click();
});

async function checkAccess() {
    if (!state.email) return;
    try {
        const res = await fetch(BACKEND_URL + '/check-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: state.email })
        });
        state.access = await res.json();
        console.log('Accès :', state.access);
    } catch (e) {
        console.warn('check-access échoué', e);
    }
}

// ═══ ADMIN ═══
document.getElementById('admin-avatar-btn').addEventListener('click', () => {
    document.getElementById('admin-avatar-input').click();
});

document.getElementById('admin-avatar-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        state.sageConfig.avatar = ev.target.result;
        const img = '<img src="' + ev.target.result + '">';
        const el = document.getElementById('admin-avatar-preview');
        if (el) el.innerHTML = img;
        const w = document.getElementById('welcome-avatar');
        if (w) w.innerHTML = img;
        const h = document.getElementById('header-avatar');
        if (h) h.innerHTML = img;
        const c = document.getElementById('chat-avatar');
        if (c) c.innerHTML = img;
        saveConfig();
        showToast('Photo mise à jour');
    };
    reader.readAsDataURL(file);
});

function saveConfig() {
    try { localStorage.setItem('sageConfig', JSON.stringify(state.sageConfig)); } catch (e) {}
}

function loadConfig() {
    try {
        const saved = localStorage.getItem('sageConfig');
        if (saved) state.sageConfig = { ...state.sageConfig, ...JSON.parse(saved) };
    } catch (e) {}
    applyConfig();
}

function applyConfig() {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setHTML = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

    setText('header-sage-name', state.sageConfig.name);
    setText('welcome-title', state.sageConfig.name);
    setText('welcome-message', state.sageConfig.welcomeMessage);

    if (state.sageConfig.avatar) {
        const img = '<img src="' + state.sageConfig.avatar + '">';
        setHTML('welcome-avatar', img);
        setHTML('header-avatar', img);
        setHTML('chat-avatar', img);
        setHTML('admin-avatar-preview', img);
    }
    setVal('admin-sage-name', state.sageConfig.name);
    setVal('admin-sage-title', state.sageConfig.title);
    setVal('admin-welcome-msg', state.sageConfig.welcomeMessage);
}

document.getElementById('admin-save-btn').addEventListener('click', () => {
    state.sageConfig.name = document.getElementById('admin-sage-name').value.trim() || 'Le Vieux';
    state.sageConfig.title = document.getElementById('admin-sage-title').value.trim() || 'Sage africain';
    state.sageConfig.welcomeMessage = document.getElementById('admin-welcome-msg').value.trim();
    const vg = document.querySelector('input[name="voice-gender"]:checked');
    if (vg) state.sageConfig.voiceGender = vg.value;
    saveConfig();
    applyConfig();
    showToast('Modifications sauvegardées');
});

// ═══ CHAT ═══
function addMessage(role, content) {
    const container = document.getElementById('chat-container');
    const div = document.createElement('div');
    div.className = 'message ' + role;

    const avatarSVG = '<svg viewBox="0 0 24 24"><path d="M12 2C8 2 6 5 6 8c0 2 1 3 1 5 0 1-1 2-1 4 0 2 2 5 6 5s6-3 6-5c0-2-1-3-1-4 0-2 1-3 1-5 0-3-2-6-6-6z"/><path d="M10 13c.5.5 1 .8 2 .8s1.5-.3 2-.8"/></svg>';

    const avatarHTML = role === 'elder'
        ? '<div class="msg-avatar">' + (state.sageConfig.avatar ? '<img src="' + state.sageConfig.avatar + '">' : avatarSVG) + '</div>'
        : '';

    const safeText = esc(content).replace(/"/g, '&quot;');
    const audioBtn = role === 'elder'
        ? '<button class="audio-btn" onclick="toggleAudio(this)" data-text="' + safeText + '"><svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>Écouter</button>'
        : '';

    div.innerHTML = avatarHTML +
        '<div>' +
            '<div class="bubble">' + formatMarkdown(content) + '</div>' +
            audioBtn +
        '</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addTyping() {
    const container = document.getElementById('chat-container');
    const div = document.createElement('div');
    div.className = 'message elder';
    div.id = 'typing-indicator';
    const avatarSVG = '<svg viewBox="0 0 24 24"><path d="M12 2C8 2 6 5 6 8c0 2 1 3 1 5 0 1-1 2-1 4 0 2 2 5 6 5s6-3 6-5c0-2-1-3-1-4 0-2 1-3 1-5 0-3-2-6-6-6z"/><path d="M10 13c.5.5 1 .8 2 .8s1.5-.3 2-.8"/></svg>';
    div.innerHTML = '<div class="msg-avatar">' + (state.sageConfig.avatar ? '<img src="' + state.sageConfig.avatar + '">' : avatarSVG) + '</div>' +
        '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

function getHistory() {
    const messages = document.querySelectorAll('#chat-container .message');
    const history = [];
    messages.forEach(msg => {
        if (msg.id === 'typing-indicator') return;
        const bubble = msg.querySelector('.bubble');
        if (!bubble) return;
        const content = bubble.textContent.trim();
        if (msg.classList.contains('user')) {
            history.push({ role: 'user', content: content });
        } else if (msg.classList.contains('elder')) {
            history.push({ role: 'elder', content: content });
        }
    });
    return history.slice(-6);
}

async function sendQuestion() {
    if (state.isSending) return;

    const input = document.getElementById('user-input');
    const question = input.value.trim();
    if (!question) return;

    if (!state.email) {
        document.getElementById('email-modal').classList.add('visible');
        return;
    }

    addMessage('user', question);
    input.value = '';
    input.style.height = 'auto';
    addTyping();

    state.isSending = true;
    document.getElementById('send-btn').disabled = true;

    try {
        const thinkingDelay = 2000 + Math.random() * 2000;
        await new Promise(r => setTimeout(r, thinkingDelay));

        const response = await fetch(BACKEND_URL + '/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: state.email,
                question: question,
                history: getHistory()
            })
        });

        removeTyping();

        if (response.status === 402) {
            addMessage('elder', 'Mon enfant, tes questions offertes sont épuisées. Pour continuer à recevoir ma guidance, tu dois t\'abonner.');
            showToast('Questions gratuites épuisées', 'error');
            setTimeout(() => showScreen('subscribe'), 1500);
            return;
        }

        if (!response.ok) {
            addMessage('elder', 'Le Vieux est fatigué, mon enfant. Réessaie dans un instant.');
            showToast('Erreur de connexion', 'error');
            return;
        }

        const data = await response.json();

        if (data.answer) {
            addMessage('elder', data.answer);
            if (data.isFree && typeof data.freeRemaining === 'number' && data.freeRemaining > 0) {
                showToast('Il te reste ' + data.freeRemaining + ' question' + (data.freeRemaining > 1 ? 's' : '') + ' gratuite' + (data.freeRemaining > 1 ? 's' : ''));
            }
        } else {
            addMessage('elder', 'Mon enfant, je n\'ai pas pu te répondre. Réessaie.');
        }

    } catch (error) {
        removeTyping();
        addMessage('elder', 'Le Vieux est fatigué, mon enfant. Vérifie ta connexion et réessaie.');
        showToast('Erreur de connexion', 'error');
    } finally {
        state.isSending = false;
        document.getElementById('send-btn').disabled = false;
    }
}

document.getElementById('send-btn').addEventListener('click', sendQuestion);
document.getElementById('user-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(); }
});
document.getElementById('user-input').addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
});
document.getElementById('mic-btn').addEventListener('click', () => {
    showToast('Chat audio à la Couche 4');
});

document.getElementById('journal-save-btn').addEventListener('click', () => {
    const text = document.getElementById('journal-input').value.trim();
    if (!text) { showToast('Écris quelque chose d\'abord', 'error'); return; }
    showToast('Sauvegardé ✓');
    document.getElementById('journal-input').value = '';
});

function subscribe(plan) {
    showToast('Paiement Chariow à la Couche 5');
}

function init() {
    loadConfig();
    try { state.email = localStorage.getItem('levieux_email'); } catch (e) {}
    if (!state.email) {
        document.getElementById('email-modal').classList.add('visible');
    } else {
        checkAccess();
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    showScreen('chat');
}

init();
</script>

</body>
</html>
