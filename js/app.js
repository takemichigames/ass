// ============================================================
// APP PRINCIPAL — Home, Categorias, Modal do Jogo
// ============================================================
import {
    buscarJogos,
    DESTAQUES_INFO,
    ICONS,
    escapeHtml,
    escapeAttr
} from './firebase.js';

import {
    getDatabase,
    ref,
    get
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

import { db } from './firebase.js';

const ITENS_POR_PAGINA = 12;

let jogos = [];
let destaquesConfig = null;
let viewAtual = { tipo: 'home', valor: null };
let buscaCategoria = '';
let paginaAtual = 1;
let carrosseisAtivos = [];

// ============================================================
// INICIALIZAÇÃO
// ============================================================
async function init() {
    try {
        // Busca jogos e config de destaques em paralelo
        const [listaJogos, configSnap] = await Promise.all([
            buscarJogos(),
            get(ref(db, 'config/destaques')).catch(() => ({ val: () => null }))
        ]);

        jogos = listaJogos;
        destaquesConfig = configSnap.val() || getConfigPadrao();

        document.getElementById('loader').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        renderizarGenerosDrawer();
        renderizar();
    } catch (e) {
        document.getElementById('loader').innerHTML = `
            <div style="color:#d13438;">Erro ao carregar jogos: ${escapeHtml(e.message)}</div>
        `;
    }
}

function getConfigPadrao() {
    return {
        em_alta: { quantidade: 10, modo: 'aleatorio' },
        famoso: { quantidade: 8, modo: 'aleatorio' },
        recomendado: { quantidade: 12, modo: 'aleatorio' },
        novo: { quantidade: 15, modo: 'recentes' }
    };
}

// ============================================================
// LÓGICA DE DESTAQUES
// ============================================================
// Calcula a lista final de jogos pra um destaque, aplicando:
//   1. Prioridade pros marcados manualmente
//   2. Completar com N - marcados conforme o modo
//   3. Aplicar ordem (aleatório/recentes/alfabético)
// ============================================================
function calcularDestaques(idDestaque, cfg) {
    const quantidade = cfg.quantidade || 10;
    const modo = cfg.modo || 'aleatorio';

    // Separa todos os jogos
    const comDestaqueManual = jogos.filter(j =>
        (j.destaques || []).includes(idDestaque)
    );
    const semDestaqueManual = jogos.filter(j =>
        !(j.destaques || []).includes(idDestaque)
    );

    let resultado = [];

    // 1. Se for modo "manual" puro, só mostra os marcados
    if (modo === 'manual') {
        resultado = [...comDestaqueManual];
        if (modo === 'aleatorio') shuffle(resultado);
        return resultado.slice(0, quantidade);
    }

    // 2. Ordena os candidatos automáticos conforme o modo
    let candidatos = [...semDestaqueManual];

    if (modo === 'recentes') {
        candidatos.sort((a, b) =>
            (b.data_adicao || 0) - (a.data_adicao || 0)
        );
    } else if (modo === 'alfabetico') {
        candidatos.sort((a, b) =>
            (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
        );
    } else if (modo === 'aleatorio') {
        shuffle(candidatos);
    }

    // 3. Marcados manualmente têm prioridade
    //    (embaralha eles também se for aleatório, pra variar)
    let marcados = [...comDestaqueManual];
    if (modo === 'aleatorio') shuffle(marcados);
    else if (modo === 'recentes') {
        marcados.sort((a, b) => (b.data_adicao || 0) - (a.data_adicao || 0));
    }

    // 4. Junta: marcados primeiro, depois completa com candidatos
    resultado = [...marcados, ...candidatos];

    return resultado.slice(0, quantidade);
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ============================================================
// DRAWER — GÊNEROS
// ============================================================
function renderizarGenerosDrawer() {
    const contagem = {};
    jogos.forEach(j => {
        (j.generos || []).forEach(g => {
            contagem[g] = (contagem[g] || 0) + 1;
        });
    });

    const generos = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);
    const container = document.getElementById('drawerGeneros');
    container.innerHTML = generos.map(g => `
        <div class="drawer-item" data-genero="${escapeAttr(g)}" onclick="selecionarGenero('${escapeAttr(g)}')">
            ${ICONS.tag}
            <span>${escapeHtml(g)}</span>
            <span class="count">${contagem[g]}</span>
        </div>
    `).join('');
}

window.abrirDrawer = function() {
    document.getElementById('drawer').classList.add('active');
    document.getElementById('drawerOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.fecharDrawer = function() {
    document.getElementById('drawer').classList.remove('active');
    document.getElementById('drawerOverlay').classList.remove('active');
    document.body.style.overflow = '';
};

// ============================================================
// NAVEGAÇÃO
// ============================================================
window.irParaHome = function() {
    destruirTodosCarrosseis();
    viewAtual = { tipo: 'home', valor: null };
    buscaCategoria = '';
    paginaAtual = 1;
    atualizarDrawerAtivo();
    fecharDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderizar();
};

window.selecionarGenero = function(g) {
    destruirTodosCarrosseis();
    viewAtual = { tipo: 'genero', valor: g };
    buscaCategoria = '';
    paginaAtual = 1;
    atualizarDrawerAtivo();
    fecharDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderizar();
};

window.irParaPagina = function(p) {
    paginaAtual = p;
    renderizarGridCategoria();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function atualizarDrawerAtivo() {
    const homeEl = document.getElementById('drawerHome');
    if (homeEl) homeEl.classList.toggle('active', viewAtual.tipo === 'home');

    document.querySelectorAll('#drawerGeneros .drawer-item').forEach(el => {
        el.classList.remove('active');
        if (viewAtual.tipo === 'genero' && el.dataset.genero === viewAtual.valor) el.classList.add('active');
    });
}

function destruirTodosCarrosseis() {
    carrosseisAtivos.forEach(c => c.destruir());
    carrosseisAtivos = [];
}

// ============================================================
// RENDERIZAÇÃO PRINCIPAL
// ============================================================
function renderizar() {
    destruirTodosCarrosseis();
    const content = document.getElementById('content');
    const empty = document.getElementById('empty');

    // ===== CATEGORIA =====
    if (viewAtual.tipo === 'genero') {
        const todosDoGenero = jogos
            .filter(j => (j.generos || []).includes(viewAtual.valor))
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

        if (todosDoGenero.length === 0) {
            content.innerHTML = `
                <div class="category-section">
                    <div class="empty-state" style="display:block;padding:2rem 1rem;">
                        ${ICONS.alerta}
                        <p>Nenhum jogo nesta categoria ainda.</p>
                    </div>
                </div>
            `;
            return;
        }

        content.innerHTML = `
            <div class="category-section">
                <div class="category-search">
                    <span class="search-icon">${ICONS.tag}</span>
                    <input type="text" id="catSearchInput" placeholder="Filtrar em ${escapeHtml(viewAtual.valor)}..." value="${escapeHtml(buscaCategoria)}" autocomplete="off">
                    <button class="clear-btn ${buscaCategoria ? 'active' : ''}" onclick="limparBuscaCategoria()">
                        ${ICONS.fechar}
                    </button>
                </div>
                <div class="section-header">
                    <span class="icon" style="color:var(--accent);">${ICONS.tag}</span>
                    <h2>${escapeHtml(viewAtual.valor)}</h2>
                    <span class="count" id="catCount">${todosDoGenero.length}</span>
                </div>
                <div id="catContainer"></div>
            </div>
        `;

        renderizarGridCategoria();

        const input = document.getElementById('catSearchInput');
        const clearBtn = document.querySelector('.category-search .clear-btn');

        input.addEventListener('input', () => {
            const termo = input.value.toLowerCase().trim();
            buscaCategoria = termo;
            paginaAtual = 1;
            clearBtn.classList.toggle('active', !!termo);
            renderizarGridCategoria();
        });

        return;
    }

    // ===== HOME (CARROSSÉIS) =====
    let html = '';
    let temConteudo = false;

    Object.keys(DESTAQUES_INFO).forEach(id => {
        const info = DESTAQUES_INFO[id];
        const cfg = destaquesConfig[id] || { quantidade: 10, modo: 'aleatorio' };
        const itens = calcularDestaques(id, cfg);

        if (itens.length > 0) {
            temConteudo = true;
            html += `
                <div class="carousel-section">
                    <div class="carousel-header ${id}">
                        <span class="icon">${info.icon}</span>
                        <h2>${info.label}</h2>
                        <span class="count">${itens.length}</span>
                    </div>
                    <div class="carousel-wrapper">
                        <div class="carousel" id="carousel-${id}" data-id="${id}">
                            ${itens.map(renderCardCarousel).join('')}
                        </div>
                    </div>
                    <div class="carousel-dots ${id}" id="dots-${id}"></div>
                </div>
            `;
        }
    });

    if (!temConteudo) {
        content.innerHTML = '';
        empty.innerHTML = `${ICONS.alerta}<p>Nenhum jogo cadastrado ainda.</p>`;
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    content.innerHTML = html;

    Object.keys(DESTAQUES_INFO).forEach(id => {
        const carousel = document.getElementById('carousel-' + id);
        const dotsContainer = document.getElementById('dots-' + id);
        if (carousel && dotsContainer) {
            const instancia = iniciarCarrossel(carousel, dotsContainer);
            if (instancia) carrosseisAtivos.push(instancia);
        }
    });
}

// ============================================================
// GRID DE CATEGORIA COM PAGINAÇÃO
// ============================================================
function renderizarGridCategoria() {
    const container = document.getElementById('catContainer');
    const catCount = document.getElementById('catCount');
    if (!container) return;

    const todosDoGenero = jogos
        .filter(j => (j.generos || []).includes(viewAtual.valor))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));

    const totalSemBusca = todosDoGenero.length;
    const filtrados = buscaCategoria
        ? todosDoGenero.filter(j => (j.nome || '').toLowerCase().includes(buscaCategoria))
        : todosDoGenero;

    if (catCount) {
        catCount.textContent = filtrados.length + (buscaCategoria ? ' de ' + totalSemBusca : '');
    }

    if (filtrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="display:block;padding:2rem 1rem;">
                ${ICONS.alerta}
                <p>Nenhum jogo encontrado.</p>
            </div>
        `;
        return;
    }

    const totalPaginas = Math.ceil(filtrados.length / ITENS_POR_PAGINA);
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    if (paginaAtual < 1) paginaAtual = 1;

    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    const jogosDaPagina = filtrados.slice(inicio, fim);

    container.innerHTML = `
        <div class="grid">${jogosDaPagina.map(renderCard).join('')}</div>
        ${totalPaginas > 1 ? `
            <div class="pagination-info">
                Mostrando ${inicio + 1}–${Math.min(fim, filtrados.length)} de ${filtrados.length} jogos
            </div>
            <div class="pagination">
                <button class="nav-btn" onclick="irParaPagina(${paginaAtual - 1})" ${paginaAtual === 1 ? 'disabled' : ''} aria-label="Anterior">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                ${renderizarBotoesPagina(paginaAtual, totalPaginas)}
                <button class="nav-btn" onclick="irParaPagina(${paginaAtual + 1})" ${paginaAtual === totalPaginas ? 'disabled' : ''} aria-label="Próxima">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
            </div>
        ` : ''}
    `;
}

function renderizarBotoesPagina(atual, total) {
    const botoes = [];
    const mostrar = 5;

    if (total <= mostrar + 2) {
        for (let i = 1; i <= total; i++) botoes.push(i);
    } else {
        botoes.push(1);
        let inicio = Math.max(2, atual - 1);
        let fim = Math.min(total - 1, atual + 1);

        if (atual <= 3) { inicio = 2; fim = 4; }
        else if (atual >= total - 2) { inicio = total - 3; fim = total - 1; }

        if (inicio > 2) botoes.push('...');
        for (let i = inicio; i <= fim; i++) botoes.push(i);
        if (fim < total - 1) botoes.push('...');
        botoes.push(total);
    }

    return botoes.map(b => {
        if (b === '...') return `<span class="ellipsis">…</span>`;
        return `<button class="${b === atual ? 'active' : ''}" onclick="irParaPagina(${b})">${b}</button>`;
    }).join('');
}

window.limparBuscaCategoria = function() {
    const input = document.getElementById('catSearchInput');
    if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        input.focus();
    }
};

// ============================================================
// CARDS
// ============================================================
function renderCardCarousel(j) {
    return `
        <div class="carousel-card" onclick="abrirModal('${escapeAttr(j._key)}')">
            <div class="card-image">
                ${j.imagem
                    ? `<img src="${escapeHtml(j.imagem)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='${escapeAttr(ICONS.imagemQuebrada)}'">`
                    : ICONS.imagemQuebrada}
            </div>
            <div class="card-body">
                <div class="card-title">${escapeHtml(j.nome)}</div>
            </div>
        </div>
    `;
}

function renderCard(j) {
    return `
        <div class="card" onclick="abrirModal('${escapeAttr(j._key)}')">
            <div class="card-image">
                ${j.imagem
                    ? `<img src="${escapeHtml(j.imagem)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='${escapeAttr(ICONS.imagemQuebrada)}'">`
                    : ICONS.imagemQuebrada}
            </div>
            <div class="card-body">
                <div class="card-title">${escapeHtml(j.nome)}</div>
                <div class="card-genres">${(j.generos || []).join(' • ')}</div>
            </div>
        </div>
    `;
}

// ============================================================
// CARROSSEL INFINITO
// ============================================================
function iniciarCarrossel(carousel, dotsContainer) {
    const cardsOriginais = Array.from(carousel.querySelectorAll('.carousel-card'));
    const total = cardsOriginais.length;

    if (total === 0) return null;
    if (total === 1) {
        const dot = document.createElement('div');
        dot.className = 'dot active';
        dotsContainer.appendChild(dot);
        return { destruir() {} };
    }

    const cardWidth = cardsOriginais[0].offsetWidth;
    const gap = parseFloat(getComputedStyle(carousel).gap) || 0;
    const passo = cardWidth + gap;
    const visiveis = Math.max(1, Math.ceil(carousel.clientWidth / passo));
    const qtdClone = Math.max(total, visiveis) + 1;

    for (let i = 0; i < qtdClone; i++) {
        const clone = cardsOriginais[i % total].cloneNode(true);
        clone.dataset.clone = 'end';
        carousel.appendChild(clone);
    }
    for (let i = 0; i < qtdClone; i++) {
        const indiceOriginal = ((total - qtdClone + i) % total + total) % total;
        const clone = cardsOriginais[indiceOriginal].cloneNode(true);
        clone.dataset.clone = 'start';
        carousel.insertBefore(clone, carousel.firstChild);
    }

    const offsetInicial = qtdClone * passo;

    carousel.classList.add('no-transition');
    carousel.scrollLeft = offsetInicial;
    void carousel.offsetWidth;
    carousel.classList.remove('no-transition');

    dotsContainer.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.dataset.index = i;
        dot.onclick = () => {
            irParaIndex(i);
            pausar();
            agendarRetomada();
        };
        dotsContainer.appendChild(dot);
    }
    const dots = Array.from(dotsContainer.querySelectorAll('.dot'));

    let indiceAtual = 0;
    let autoTimer = null;
    let pausado = false;
    let retomadaTimer = null;
    let reposicionando = false;

    function irParaIndex(index) {
        indiceAtual = ((index % total) + total) % total;
        const scrollAtual = carousel.scrollLeft;
        const posicaoReal = offsetInicial + (indiceAtual * passo);

        if (scrollAtual >= offsetInicial + (total * passo) - (passo / 2)) {
            carousel.classList.add('no-transition');
            carousel.scrollLeft = scrollAtual - (total * passo);
            void carousel.offsetWidth;
            carousel.classList.remove('no-transition');
        }
        carousel.scrollTo({ left: posicaoReal, behavior: 'smooth' });
        atualizarDots();
    }

    function proximo() {
        const scrollAtual = carousel.scrollLeft;
        const proximoScroll = scrollAtual + passo;
        const inicioCloneFim = offsetInicial + (total * passo);

        if (proximoScroll >= inicioCloneFim) {
            carousel.classList.add('no-transition');
            carousel.scrollLeft = scrollAtual - (total * passo);
            void carousel.offsetWidth;
            carousel.classList.remove('no-transition');
            requestAnimationFrame(() => {
                carousel.scrollTo({ left: carousel.scrollLeft + passo, behavior: 'smooth' });
            });
        } else {
            carousel.scrollTo({ left: proximoScroll, behavior: 'smooth' });
        }
        indiceAtual = (indiceAtual + 1) % total;
        atualizarDots();
    }

    function atualizarDots() {
        dots.forEach((d, i) => d.classList.toggle('active', i === indiceAtual));
    }

    let scrollTimeout;
    carousel.addEventListener('scroll', () => {
        if (reposicionando) return;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const scroll = carousel.scrollLeft;
            const posRelativa = scroll - offsetInicial;
            const novoIndice = Math.round(posRelativa / passo);
            const indiceNormalizado = ((novoIndice % total) + total) % total;

            if (indiceNormalizado !== indiceAtual) {
                indiceAtual = indiceNormalizado;
                atualizarDots();
            }

            const inicioCloneFim = offsetInicial + (total * passo);
            const fimCloneInicio = offsetInicial - (qtdClone * passo);

            if (scroll >= inicioCloneFim) {
                reposicionando = true;
                carousel.classList.add('no-transition');
                carousel.scrollLeft = scroll - (total * passo);
                void carousel.offsetWidth;
                carousel.classList.remove('no-transition');
                setTimeout(() => { reposicionando = false; }, 50);
            } else if (scroll < fimCloneInicio + passo) {
                reposicionando = true;
                carousel.classList.add('no-transition');
                carousel.scrollLeft = scroll + (total * passo);
                void carousel.offsetWidth;
                carousel.classList.remove('no-transition');
                setTimeout(() => { reposicionando = false; }, 50);
            }
        }, 100);
    }, { passive: true });

    function iniciarAuto() {
        clearInterval(autoTimer);
        autoTimer = setInterval(() => {
            if (!pausado && !reposicionando) proximo();
        }, 4000);
    }
    function pausar() {
        pausado = true;
        clearInterval(autoTimer);
        clearTimeout(retomadaTimer);
    }
    function agendarRetomada() {
        clearTimeout(retomadaTimer);
        retomadaTimer = setTimeout(() => { pausado = false; iniciarAuto(); }, 3000);
    }

    carousel.addEventListener('touchstart', pausar, { passive: true });
    carousel.addEventListener('touchend', agendarRetomada, { passive: true });
    carousel.addEventListener('mousedown', pausar);
    carousel.addEventListener('mouseup', agendarRetomada);
    carousel.addEventListener('mouseenter', pausar);
    carousel.addEventListener('mouseleave', () => { pausado = false; iniciarAuto(); });

    const aoTrocarVisibilidade = () => {
        if (document.hidden) pausar();
        else { pausado = false; iniciarAuto(); }
    };
    document.addEventListener('visibilitychange', aoTrocarVisibilidade);

    iniciarAuto();

    return {
        destruir() {
            clearInterval(autoTimer);
            clearTimeout(retomadaTimer);
            clearTimeout(scrollTimeout);
            document.removeEventListener('visibilitychange', aoTrocarVisibilidade);
        }
    };
}

// ============================================================
// MODAL DO JOGO — Todos os links liberados
// ============================================================
window.abrirModal = function(key) {
    const j = jogos.find(x => x._key === key);
    if (!j) return;

    const m = j.metadados || {};
    const mediafire = j.mediafire || {};

    function pegarLinks(formato) {
        const campo = mediafire[formato];
        if (!campo) return [];

        if (typeof campo === 'object' && !Array.isArray(campo)) {
            return [
                ...(campo.premium || []),
                ...(campo.free || [])
            ];
        }

        if (Array.isArray(campo)) return campo;
        return [];
    }

    const linksGod = pegarLinks('god');
    const linksXex = pegarLinks('xex');
    const linksDlc = pegarLinks('dlc');
    const temLinks = (linksGod.length || linksXex.length || linksDlc.length);

    const linksHtml = (titulo, links) => {
        if (!links || links.length === 0) return '';
        return `
            <div class="section-title">
                ${titulo.toUpperCase()} (${links.length})
            </div>
            <div class="link-group">
                ${links.map(url => `
                    <a class="link-item" href="${escapeHtml(url)}" target="_blank" rel="nofollow sponsored noopener">
                        <span class="link-format">${titulo.toUpperCase()}</span>
                        <span>${escapeHtml(url.replace(/^https?:\/\//, '').split('/').slice(0, 2).join('/'))}</span>
                    </a>
                `).join('')}
            </div>
        `;
    };

    const destaquesHtml = (j.destaques || []).map(d => {
        const info = DESTAQUES_INFO[d];
        if (!info) return '';
        return `<span class="tag ${d}">${info.icon} ${info.label}</span>`;
    }).join('');

    document.getElementById('modalContent').innerHTML = `
        <div class="modal-handle"></div>
        <button class="modal-close" onclick="fecharModal()">
            ${ICONS.fechar}
        </button>
        <div class="modal-header">
            <div class="modal-cover">
                ${j.imagem ? `<img src="${escapeHtml(j.imagem)}" alt="">` : ICONS.imagemQuebrada}
            </div>
            <div class="modal-info">
                <div class="modal-title">${escapeHtml(j.nome)}</div>
                ${destaquesHtml ? `<div class="modal-destaques">${destaquesHtml}</div>` : ''}
                <div class="modal-genres">
                    ${(j.generos || []).map(g => `<span class="genre-tag">${escapeHtml(g)}</span>`).join('')}
                </div>
                ${m.senha ? `
                    <div class="senha-box">
                        <span class="icon">${ICONS.lock}</span>
                        <div class="info">
                            <div class="label">Senha</div>
                            <div class="value" id="senhaValue">${escapeHtml(m.senha)}</div>
                        </div>
                        <button class="btn-copy" onclick="copiarSenha(this)">
                            ${ICONS.copiar}
                            Copiar
                        </button>
                    </div>
                ` : ''}
                <div class="modal-meta">
                    ${m.plataforma ? `<div><strong>Plataforma:</strong> ${escapeHtml(m.plataforma)}</div>` : ''}
                    ${m.formato ? `<div><strong>Formato:</strong> ${escapeHtml(m.formato)}</div>` : ''}
                    ${m.regiao ? `<div><strong>Região:</strong> ${escapeHtml(m.regiao)}</div>` : ''}
                    ${m.vozes ? `<div><strong>Vozes:</strong> ${escapeHtml(m.vozes)}</div>` : ''}
                    ${m.legendas ? `<div><strong>Legendas:</strong> ${escapeHtml(m.legendas)}</div>` : ''}
                    ${m.tamanho_comprimido ? `<div><strong>Comprimido:</strong> ${escapeHtml(m.tamanho_comprimido)}</div>` : ''}
                    ${m.tamanho_descomprimido ? `<div><strong>Descomprimido:</strong> ${escapeHtml(m.tamanho_descomprimido)}</div>` : ''}
                    ${j.data_lancamento ? `<div><strong>Lançamento:</strong> ${escapeHtml(j.data_lancamento)}</div>` : ''}
                </div>
            </div>
        </div>
        <div class="modal-body">
            ${linksHtml('GOD', linksGod)}
            ${linksHtml('XEX', linksXex)}
            ${linksHtml('DLC', linksDlc)}
            ${(!temLinks)
                ? `<div class="empty-state">${ICONS.info}<p>Nenhum link disponível.</p></div>` : ''}
        </div>
    `;
    document.getElementById('modal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.fecharModal = function() {
    document.getElementById('modal').classList.remove('active');
    document.body.style.overflow = '';
};

window.copiarSenha = async function(btn) {
    const senha = document.getElementById('senhaValue').textContent;
    try {
        await navigator.clipboard.writeText(senha);
    } catch (e) {
        const textarea = document.createElement('textarea');
        textarea.value = senha;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    const originalHTML = btn.innerHTML;
    btn.classList.add('copiado');
    btn.innerHTML = `${ICONS.check} Copiado!`;
    setTimeout(() => {
        btn.classList.remove('copiado');
        btn.innerHTML = originalHTML;
    }, 1500);
};

document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') fecharModal();
});

// ============================================================
// START
// ============================================================
init();