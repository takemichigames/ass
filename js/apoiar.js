// ============================================================
// PÁGINA DE APOIO — TAKEMICHI RGH
// ============================================================
import { SITE_CONFIG, ICONS } from './firebase.js';

function renderizarApoio() {
    const container = document.getElementById('premiumContainer');

    container.innerHTML = `
        <div class="apoio-header">
            <div class="apoio-coracao">${ICONS.coracao}</div>
            <h1>Apoie o Projeto</h1>
            <p>O TAKEMICHI RGH é gratuito e mantido por doações.</p>
        </div>

        <div class="apoio-pix-box">
            <div class="apoio-pix-label">Chave PIX</div>
            <div class="apoio-pix-chave" id="pixChave">${escapeHtml(SITE_CONFIG.pixChave)}</div>
            <button class="apoio-pix-btn" onclick="copiarPix(this)">
                ${ICONS.copiar}
                Copiar
            </button>
        </div>

        <div class="apoio-links">
            <a class="apoio-link" href="${SITE_CONFIG.telegramGrupo}" target="_blank" rel="noopener">
                ${ICONS.telegram}
                <span>Entrar no grupo</span>
            </a>
            <a class="apoio-link" href="${SITE_CONFIG.telegramContato}" target="_blank" rel="noopener">
                ${ICONS.telegram}
                <span>${escapeHtml(SITE_CONFIG.telegramUsuario)}</span>
            </a>
        </div>

        <p class="apoio-obrigado">Obrigado pelo apoio 🎮</p>
    `;
}

window.copiarPix = async function(btn) {
    const chave = document.getElementById('pixChave')?.textContent;
    if (!chave) return;

    try {
        await navigator.clipboard.writeText(chave);
    } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = chave;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    }

    const original = btn.innerHTML;
    btn.innerHTML = `${ICONS.check} Copiado`;
    btn.classList.add('copiado');
    setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('copiado');
    }, 1800);
};

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

renderizarApoio();
