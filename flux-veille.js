// ===== SYSTÈME DE VEILLE TECHNOLOGIQUE - GOOGLE SHEETS =====

const GOOGLE_SHEETS_CONFIG = {
    SHEET_ID: '1HzbbwZSt_8sLSRvRz7S0rVu5Fe5MTU46Ea75kd57uhs',
    SHEET_NAME: 'Feuille 1',
    API_KEY: 'AIzaSyBrJcUzjIkYHks7g2qkKBbc3OthsnoAnDI'
};

// Détection de la source depuis le lien
function detectSource(link) {
    if (link.includes('cnil.fr'))              return { name: 'CNIL',       icon: 'fa-balance-scale' };
    if (link.includes('cert.ssi.gouv.fr'))     return { name: 'CERT-FR',    icon: 'fa-shield-virus'  };
    if (link.includes('anssi.gouv.fr'))        return { name: 'ANSSI',      icon: 'fa-shield-virus'  };
    if (link.includes('it-connect.fr'))        return { name: 'IT-Connect', icon: 'fa-server'        };
    if (link.includes('korben.info'))          return { name: 'Korben',     icon: 'fa-rss'           };
    if (link.includes('zataz.com'))            return { name: 'Zataz',      icon: 'fa-lock'          };
    if (link.includes('lemondeinformatique'))  return { name: 'LMI',        icon: 'fa-newspaper'     };
    return { name: 'Actualité IT', icon: 'fa-newspaper' };
}

// Génère un résumé lisible à partir du titre + description
function buildSummary(title, description) {
    const raw = `${title}. ${description}`
        .replace(/<[^>]*>/g, '')
        .replace(/\.\.\.+/g, '…')
        .trim();

    const sentences = raw
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 25);

    if (sentences.length === 0) return raw.substring(0, 180) + (raw.length > 180 ? '…' : '');

    // Mots-clés importants pour prioriser les phrases
    const keywords = [
        'vulnérabilité', 'faille', 'attaque', 'sécurité', 'cyberattaque', 'alerte',
        'mise à jour', 'critique', 'windows', 'linux', 'réseau', 'données', 'ransomware',
        'phishing', 'microsoft', 'google', 'cnil', 'anssi', 'patch', 'exploit'
    ];

    const scored = sentences.map(s => {
        const lower = s.toLowerCase();
        const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0)
            + (s.length >= 40 && s.length <= 160 ? 1 : 0);
        return { s, score };
    }).sort((a, b) => b.score - a.score);

    // Prend les 2 meilleures phrases, limitées à 240 caractères
    let summary = scored.slice(0, 2).map(x => x.s).join(' ');
    if (summary.length > 240) {
        summary = summary.substring(0, 237) + '…';
    }
    return summary;
}

// Formate la date lisiblement
function formatDate(raw) {
    if (!raw) return '';
    // Déjà formaté (ex: "12/04/2025")
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (isNaN(d)) return raw;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Sources à afficher — une carte par source, dans cet ordre
const SOURCES_TO_DISPLAY = ['CERT-FR', 'Korben', 'IT-Connect'];

// ===== RÉCUPÉRATION GOOGLE SHEETS =====
async function fetchArticles() {
    const { SHEET_ID, SHEET_NAME, API_KEY } = GOOGLE_SHEETS_CONFIG;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A:D?key=${API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);

    const data = await response.json();
    if (!data.values || data.values.length < 2) return [];

    // Parse toutes les lignes
    const all = data.values
        .slice(1)
        .filter(row => row[0] && row[2])
        .map(row => {
            const title       = row[0] || 'Sans titre';
            const description = row[1] || '';
            const link        = row[2] || '#';
            const pubDate     = formatDate(row[3]);
            const source      = detectSource(link);
            return { title, description, link, pubDate, source, summary: buildSummary(title, description) };
        });

    // Pour chaque source voulue, prend le DERNIER article (dernière ligne = plus récent)
    return SOURCES_TO_DISPLAY
        .map(sourceName => {
            const matches = all.filter(a => a.source.name === sourceName);
            return matches[matches.length - 1] ?? null; // dernier = plus récent si Zapier ajoute en bas
        })
        .filter(Boolean); // retire les sources absentes du sheet
}

// ===== AFFICHAGE =====
function renderArticles(articles) {
    const container = document.getElementById('veille-container');
    if (!container) return;

    if (articles.length === 0) {
        container.innerHTML = `
            <div class="card" style="grid-column:1/-1;text-align:center;padding:3rem;">
                <i class="fas fa-inbox" style="font-size:3rem;opacity:.4;margin-bottom:1rem;"></i>
                <h3>Aucun article disponible</h3>
                <p style="color:var(--text-muted);margin-top:.5rem;">Vérifiez que le Google Sheet est partagé publiquement.</p>
            </div>`;
        return;
    }

    container.innerHTML = articles.map((a, i) => `
        <a class="card veille-card"
           href="${a.link}"
           target="_blank"
           rel="noopener noreferrer"
           style="text-decoration:none;display:flex;flex-direction:column;gap:.75rem;animation:fadeInUp .4s ease both;animation-delay:${i * 80}ms;">

            <!-- En-tête source + date -->
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:.8rem;color:var(--text-muted);">
                <span style="display:flex;align-items:center;gap:.4rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">
                    <i class="fas ${a.source.icon}" style="color:var(--secondary-color);"></i>
                    ${a.source.name}
                </span>
                ${a.pubDate ? `<span><i class="fas fa-calendar-alt" style="margin-right:.3rem;"></i>${a.pubDate}</span>` : ''}
            </div>

            <!-- Titre -->
            <h3 style="margin:0;font-size:1rem;line-height:1.4;color:var(--text-color);">
                ${a.title}
            </h3>

            <!-- Résumé -->
            <p style="margin:0;font-size:.875rem;line-height:1.6;color:var(--text-muted);flex:1;">
                ${a.summary}
            </p>

            <!-- Lien -->
            <div style="font-size:.8rem;color:var(--secondary-color);display:flex;align-items:center;gap:.4rem;margin-top:auto;">
                <i class="fas fa-external-link-alt"></i> Lire l'article
            </div>
        </a>
    `).join('');
}

// ===== CHARGEMENT PRINCIPAL =====
async function loadVeilleTechnologique() {
    const container = document.getElementById('veille-container');
    const loading   = document.getElementById('veille-loading');

    if (!container) return;

    if (loading) loading.style.display = 'block';
    container.innerHTML = '';

    try {
        const articles = await fetchArticles();
        renderArticles(articles);
    } catch (err) {
        console.error('Erreur veille:', err);
        container.innerHTML = `
            <div class="card" style="grid-column:1/-1;text-align:center;padding:3rem;">
                <i class="fas fa-times-circle" style="font-size:3rem;color:#ef4444;margin-bottom:1rem;"></i>
                <h3>Erreur de chargement</h3>
                <p style="color:var(--text-muted);margin-top:.5rem;">${err.message}</p>
                <button onclick="window.refreshVeille()"
                    style="margin-top:1.25rem;padding:.65rem 1.4rem;background:var(--secondary-color);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:.95rem;">
                    <i class="fas fa-sync-alt"></i> Réessayer
                </button>
            </div>`;
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    // Ajoute l'animation fadeInUp si elle n'existe pas déjà dans le CSS
    if (!document.getElementById('veille-anim-style')) {
        const style = document.createElement('style');
        style.id = 'veille-anim-style';
        style.textContent = `
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(18px); }
                to   { opacity: 1; transform: translateY(0);    }
            }
            .veille-card { transition: transform .2s ease, box-shadow .2s ease; }
            .veille-card:hover { transform: translateY(-4px); }
        `;
        document.head.appendChild(style);
    }

    setTimeout(loadVeilleTechnologique, 800);
    setInterval(loadVeilleTechnologique, 15 * 60 * 1000); // rafraîchissement toutes les 15 min
});

window.refreshVeille = loadVeilleTechnologique;