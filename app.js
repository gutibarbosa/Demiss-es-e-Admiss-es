/**
 * app.js — Dashboard de Turnover
 * ─────────────────────────────────────────────────────────────────────────────
 * Integração: Google Sheets publicado como CSV (sem CORS, funciona no GitHub Pages)
 * Fórmula:    Turnover = ((Adm + Dem) / 2) / Ativos × 100
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════════════════
const State = {
  turnoverData: [],   // BASE_TURNOVER sanitizada
  ativosMap:    {},   // { "1": 12, "2": 8 } → chave normalizada
  filtered:     [],   // subconjunto após filtros
  charts:       {},   // instâncias Chart.js
  lastUpdate:   null,
  fonteAtivos:  'planilha', // 'planilha' | 'fallback'
};

const MES_IDX = {
  JAN:1, FEV:2, MAR:3, ABR:4, MAI:5, JUN:6,
  JUL:7, AGO:8, SET:9, OUT:10, NOV:11, DEZ:12,
};

// ══════════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  setupListeners();
  setupDetalheListeners();
  carregarTudo();
});

// ══════════════════════════════════════════════════════════════════════════════
// CARREGAMENTO PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
async function carregarTudo() {
  showState('loading');

  try {
    // Carrega BASE_TURNOVER como CSV (obrigatório)
    const baseRows = await fetchCSV(CONFIG.urlBaseTurnover, 'BASE_TURNOVER');

    // Carrega ATIVOS como CSV (opcional — fallback gracioso se falhar)
    let ativosRows = [];
    try {
      ativosRows = await fetchCSV(CONFIG.urlAtivos, 'ATIVOS');
      State.fonteAtivos = 'planilha';
    } catch (errAtivos) {
      console.warn('[Turnover] Aba ATIVOS indisponível:', errAtivos.message);
      showToast('Aba ATIVOS não encontrada — headcount estimado via base.', 'warning');
      State.fonteAtivos = 'fallback';
    }

    processarBase(baseRows);
    processarAtivos(ativosRows);
    finalizarCarga('planilha');

  } catch (errBase) {
    console.error('[Turnover] Falha ao carregar BASE_TURNOVER:', errBase);

    if (CONFIG.localFallback && window.EMBEDDED_DATA) {
      showToast('Planilha inacessível — exibindo dados locais.', 'warning');
      const parsed = Papa.parse(window.EMBEDDED_DATA, { header: true, skipEmptyLines: true });
      processarBase(parsed.data || []);
      processarAtivos([]);
      State.fonteAtivos = 'fallback';
      finalizarCarga('local');
    } else {
      showToast('Não foi possível carregar os dados. Verifique a planilha.', 'error');
      showState('error');
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// FETCH CSV — Google Sheets publicado como CSV
// URL: https://docs.google.com/spreadsheets/d/e/{ID}/pub?gid={GID}&output=csv
// Retorna array de objetos (igual ao que OpenSheet retornava)
// ══════════════════════════════════════════════════════════════════════════════
async function fetchCSV(url, nomeAba) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao buscar aba "${nomeAba}"`);
  }

  const text = await res.text();

  if (!text || text.trim().length === 0) {
    throw new Error(`Resposta vazia para aba "${nomeAba}"`);
  }

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: result => {
        if (!result.data || result.data.length === 0) {
          console.warn(`[Turnover] Aba "${nomeAba}" retornou 0 linhas.`);
          resolve([]);
          return;
        }
        console.log(`[Turnover] "${nomeAba}": ${result.data.length} linhas carregadas via CSV`);
        resolve(result.data);
      },
      error: err => reject(new Error(`Erro ao parsear CSV da aba "${nomeAba}": ${err.message}`)),
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// NORMALIZAÇÃO DE LOJA — chave de JOIN
// "LOJA 01" → "1", "Loja 1" → "1", "01" → "1"
// ══════════════════════════════════════════════════════════════════════════════
function normLoja(raw) {
  if (!raw) return '';
  let s = String(raw).trim().toUpperCase().replace(/^LOJA\s*/i, '');
  const n = parseInt(s, 10);
  return isNaN(n) ? s : String(n);
}

// ══════════════════════════════════════════════════════════════════════════════
// DETECÇÃO AUTOMÁTICA DE COLUNAS
// ══════════════════════════════════════════════════════════════════════════════
function normStr(s) {
  return String(s).toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function detectarColunas(keys, aliasMap) {
  const map = {};
  for (const [campo, aliases] of Object.entries(aliasMap)) {
    for (const key of keys) {
      if (aliases.includes(normStr(key))) { map[campo] = key; break; }
    }
    if (!map[campo]) console.warn(`[Turnover] Coluna não mapeada: "${campo}"`);
  }
  return map;
}

function campo(row, col) {
  return col ? String(row[col] ?? '').trim() : '';
}

// ══════════════════════════════════════════════════════════════════════════════
// PROCESSAMENTO — BASE_TURNOVER
// ══════════════════════════════════════════════════════════════════════════════
function processarBase(rows) {
  if (!rows.length) {
    console.warn('[Turnover] BASE_TURNOVER vazia.');
    return;
  }

  const headers = detectarColunas(Object.keys(rows[0]), CONFIG.colTurnover);
  console.log('[Turnover] Colunas BASE_TURNOVER detectadas:', headers);

  const essenciais = ['colaborador', 'loja', 'status', 'mes', 'ano'];
  const faltando = essenciais.filter(c => !headers[c]);
  if (faltando.length) {
    console.error('[Turnover] Colunas essenciais faltando:', faltando);
    showToast(`Colunas não encontradas na planilha: ${faltando.join(', ')}`, 'error');
  }

  const seen = new Set();
  State.turnoverData = [];

  for (const row of rows) {
    const colaborador = campo(row, headers.colaborador).toUpperCase();
    const loja        = campo(row, headers.loja).toUpperCase().trim();
    const supervisor  = campo(row, headers.supervisor).toUpperCase().trim();
    const funcao      = campo(row, headers.funcao).toUpperCase().trim();
    const regiao      = campo(row, headers.regiao).toUpperCase().trim();
    const mesRaw      = campo(row, headers.mes).toUpperCase().substring(0, 3).trim();
    const anoRaw      = campo(row, headers.ano);
    const statusNorm  = normStr(campo(row, headers.status));

    if (!colaborador || !loja) continue;
    if (!MES_IDX[mesRaw]) continue;
    const ano = parseInt(anoRaw, 10);
    if (isNaN(ano) || ano < 2000 || ano > 2099) continue;

    let status = null;
    if (CONFIG.statusAdmissao.some(v => statusNorm.includes(normStr(v)))) status = 'ADMISSÃO';
    else if (CONFIG.statusDemissao.some(v => statusNorm.includes(normStr(v)))) status = 'DEMISSÃO';
    else continue;

    const chave = `${colaborador}|${loja}|${status}|${mesRaw}|${ano}`;
    if (seen.has(chave)) continue;
    seen.add(chave);

    State.turnoverData.push({ colaborador, loja, supervisor, funcao, regiao, status, mes: mesRaw, ano });
  }

  console.log(`[Turnover] BASE: ${rows.length} brutas → ${State.turnoverData.length} válidas`);
}

// ══════════════════════════════════════════════════════════════════════════════
// PROCESSAMENTO — ATIVOS
// ══════════════════════════════════════════════════════════════════════════════
function processarAtivos(rows) {
  State.ativosMap = {};

  if (!rows.length) {
    console.warn('[Turnover] Aba ATIVOS vazia — headcount não disponível.');
    return;
  }

  const headers = detectarColunas(Object.keys(rows[0]), CONFIG.colAtivos);
  const vistos  = new Set();

  for (const row of rows) {
    const lojaRaw   = campo(row, headers.loja);
    const ativosRaw = campo(row, headers.ativos);
    if (!lojaRaw) continue;

    const chave  = normLoja(lojaRaw);
    const ativos = parseInt(ativosRaw, 10);

    if (isNaN(ativos) || ativos < 0) {
      console.warn(`[Turnover] ATIVOS: valor inválido — loja "${lojaRaw}" → "${ativosRaw}"`);
      continue;
    }
    if (vistos.has(chave)) {
      console.warn(`[Turnover] ATIVOS: duplicata ignorada — loja "${lojaRaw}"`);
      continue;
    }

    vistos.add(chave);
    State.ativosMap[chave] = ativos;
  }

  console.log(`[Turnover] Ativos carregados: ${Object.keys(State.ativosMap).length} lojas`, State.ativosMap);
}

// ══════════════════════════════════════════════════════════════════════════════
// FINALIZAÇÃO
// ══════════════════════════════════════════════════════════════════════════════
function finalizarCarga(fonte) {
  if (!State.turnoverData.length) {
    showToast('Nenhum dado válido encontrado na planilha.', 'error');
    showState('error');
    return;
  }

  if (Object.keys(State.ativosMap).length > 0) {
    const lojasBase   = [...new Set(State.turnoverData.map(r => normLoja(r.loja)))];
    const semCadastro = lojasBase.filter(l => State.ativosMap[l] === undefined);
    if (semCadastro.length) {
      console.warn('[Turnover] Lojas sem ativos cadastrados:', semCadastro);
      showToast(`⚠ ${semCadastro.length} loja(s) sem registro na aba ATIVOS.`, 'warning');
    }
  }

  State.lastUpdate = new Date();
  popularFiltros();
  aplicarFiltros();
  showState('dashboard');
  atualizarTimestamp();

  const msg = fonte === 'planilha'
    ? `✓ Dados carregados da planilha (${State.turnoverData.length} registros)`
    : `⚠ Usando dados locais (${State.turnoverData.length} registros)`;
  showToast(msg, fonte === 'planilha' ? 'success' : 'warning');

  atualizarBarraFonte(fonte);
}

function atualizarBarraFonte(fonte) {
  const bar = document.querySelector('.datasource-bar p');
  if (!bar) return;

  const temAtivos   = Object.keys(State.ativosMap).length > 0;
  const totalReg    = State.turnoverData.length;
  const totalLojas  = new Set(State.turnoverData.map(r => r.loja)).size;

  if (fonte === 'planilha') {
    bar.innerHTML = `
      <strong>✓ Google Sheets conectado (CSV publicado)</strong> &nbsp;|&nbsp;
      ${totalReg} registros · ${totalLojas} lojas ·
      Headcount: ${temAtivos ? `<span style="color:var(--success)">aba ATIVOS carregada</span>` : `<span style="color:var(--warning)">⚠ aba ATIVOS não encontrada</span>`}
    `;
  } else {
    bar.innerHTML = `
      <strong style="color:var(--warning)">⚠ Dados locais (planilha inacessível)</strong> &nbsp;|&nbsp;
      ${totalReg} registros · ${totalLojas} lojas · 
      <a href="#" onclick="carregarTudo();return false;" style="color:var(--accent)">Tentar novamente</a>
    `;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HEADCOUNT — soma ativos das lojas no conjunto filtrado
// ══════════════════════════════════════════════════════════════════════════════
function getHeadcount(lojas) {
  const unicas = [...new Set(lojas.map(normLoja))];
  let total = 0;
  for (const l of unicas) {
    const ativos = State.ativosMap[l];
    if (ativos !== undefined) total += ativos;
  }
  return total;
}

// ══════════════════════════════════════════════════════════════════════════════
// CÁLCULO DE MÉTRICAS
// ══════════════════════════════════════════════════════════════════════════════
function calcMetrics(data) {
  const admissoes     = data.filter(r => r.status === 'ADMISSÃO').length;
  const desligamentos = data.filter(r => r.status === 'DEMISSÃO').length;
  const headcount     = getHeadcount(data.map(r => r.loja));
  const turnover      = CONFIG.calcTurnover(admissoes, desligamentos, headcount);
  return { admissoes, desligamentos, headcount, turnover };
}

// ══════════════════════════════════════════════════════════════════════════════
// FILTROS
// ══════════════════════════════════════════════════════════════════════════════
function setupListeners() {
  document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') lerCSVLocal(file);
    else if (['xlsx', 'xls'].includes(ext)) lerXLSX(file);
    else showToast('Use .csv ou .xlsx', 'error');
  });

  document.getElementById('btnRefresh').addEventListener('click', () => {
    showToast('Atualizando dados da planilha...', 'info');
    carregarTudo();
  });
  document.getElementById('btnUpload').addEventListener('click', () =>
    document.getElementById('fileInput').click()
  );
  document.getElementById('btnReset').addEventListener('click', resetarFiltros);

  ['filterLoja', 'filterSupervisor', 'filterRegiao', 'filterFuncao', 'filterMes', 'filterAno']
    .forEach(id => document.getElementById(id).addEventListener('change', aplicarFiltros));
}

function popularFiltros() {
  const d    = State.turnoverData;
  const uniq = f => [...new Set(d.map(r => r[f]))].filter(Boolean).sort();

  const lojas = uniq('loja').sort((a, b) => {
    const na = parseInt(normLoja(a)), nb = parseInt(normLoja(b));
    return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b);
  });

  preencherSelect('filterLoja',       lojas,             'Loja');
  preencherSelect('filterSupervisor', uniq('supervisor'), 'Supervisor');
  preencherSelect('filterRegiao',     uniq('regiao'),     'Região');
  preencherSelect('filterFuncao',     uniq('funcao'),     'Função');

  const meses = Object.keys(MES_IDX).filter(m => d.some(r => r.mes === m));
  preencherSelect('filterMes', meses, 'Mês');
  preencherSelect('filterAno', [...new Set(d.map(r => r.ano))].sort(), 'Ano');
}

function preencherSelect(id, opcoes, label) {
  const sel = document.getElementById(id);
  sel.innerHTML = `<option value="">Todos (${label})</option>`;
  opcoes.forEach(o => {
    const el = document.createElement('option');
    el.value = o; el.textContent = o;
    sel.appendChild(el);
  });
}

function aplicarFiltros() {
  const f = {
    loja:       document.getElementById('filterLoja').value,
    supervisor: document.getElementById('filterSupervisor').value,
    regiao:     document.getElementById('filterRegiao').value,
    funcao:     document.getElementById('filterFuncao').value,
    mes:        document.getElementById('filterMes').value,
    ano:        document.getElementById('filterAno').value,
  };

  State.filtered = State.turnoverData.filter(r => {
    if (f.loja       && r.loja       !== f.loja)        return false;
    if (f.supervisor && r.supervisor !== f.supervisor)   return false;
    if (f.regiao     && r.regiao     !== f.regiao)       return false;
    if (f.funcao     && r.funcao     !== f.funcao)       return false;
    if (f.mes        && r.mes        !== f.mes)          return false;
    if (f.ano        && String(r.ano) !== String(f.ano)) return false;
    return true;
  });

  renderizarTudo(f);
}

function resetarFiltros() {
  ['filterLoja', 'filterSupervisor', 'filterRegiao', 'filterFuncao', 'filterMes', 'filterAno']
    .forEach(id => document.getElementById(id).value = '');
  aplicarFiltros();
  showToast('Filtros resetados.', 'info');
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDERIZAÇÃO PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
function renderizarTudo(filtros) {
  const data   = State.filtered;
  const global = calcMetrics(data);

  console.table({
    admissoes:     global.admissoes,
    desligamentos: global.desligamentos,
    ativos:        global.headcount,
    turnover:      global.turnover !== null ? global.turnover.toFixed(2) + '%' : 'Sem headcount',
    filtros:       JSON.stringify(filtros),
  });

  renderKPIs(data, global);
  renderMemoria(global, filtros);
  renderGraficos(data);
  renderDetalhe(data);
  atualizarTimestamp();
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function renderKPIs(data, g) {
  const temHeadcount = g.headcount > 0;

  if (g.turnover !== null) {
    setText('kpiTurnover', g.turnover.toFixed(1) + '%');
    colorirKPI('kpiTurnover', g.turnover, 15, 30);
  } else {
    setText('kpiTurnover', temHeadcount ? '0,0%' : '—');
    document.getElementById('kpiTurnover').classList.remove('kpi-warn', 'kpi-danger');
  }

  setText('kpiAdmissoes',     g.admissoes);
  setText('kpiDesligamentos', g.desligamentos);
  setText('kpiHeadcount',     temHeadcount ? g.headcount : '—');

  const lojaMax = maxGrupo(data, 'loja');
  const regMax  = maxGrupo(data, 'regiao');
  setText('kpiLojaMax',  lojaMax ? `${lojaMax.grupo} — ${lojaMax.turnover.toFixed(1)}%` : '—');
  setText('kpiLocalMax', regMax  ? `${regMax.grupo} — ${regMax.turnover.toFixed(1)}%`   : '—');

  const subHC = document.querySelector('#kpiHeadcount + .kpi-sub') ||
                document.querySelector('[id="kpiHeadcount"]')?.parentElement?.querySelector('.kpi-sub');
  if (subHC) {
    subHC.textContent = temHeadcount
      ? 'fonte: aba ATIVOS'
      : State.fonteAtivos === 'planilha' ? '⚠ aba ATIVOS não encontrada' : 'aba ATIVOS indisponível';
  }
}

function maxGrupo(data, campo) {
  const grupos = agrupar(data, campo);
  let melhor = null;
  for (const [grupo, rows] of Object.entries(grupos)) {
    const m = calcMetrics(rows);
    if (m.turnover !== null && (!melhor || m.turnover > melhor.turnover))
      melhor = { grupo, ...m };
  }
  return melhor;
}

function colorirKPI(id, val, warn, danger) {
  const el = document.getElementById(id);
  el.classList.remove('kpi-warn', 'kpi-danger');
  if (val === null) return;
  if (val >= danger) el.classList.add('kpi-danger');
  else if (val >= warn) el.classList.add('kpi-warn');
}

// ── MEMÓRIA DE CÁLCULO ────────────────────────────────────────────────────────
function renderMemoria(g, filtros) {
  const filtrosAtivos = Object.entries(filtros)
    .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' | ') || 'Nenhum (visão geral)';

  setText('memAdmissoes',    g.admissoes);
  setText('memDesligamentos', g.desligamentos);
  setText('memHeadcount',    g.headcount > 0 ? g.headcount : '⚠ sem cadastro');
  setText('memFiltros',      filtrosAtivos);

  if (g.turnover !== null) {
    setText('memTurnover', g.turnover.toFixed(2) + '%');
  } else if (g.admissoes === 0 && g.desligamentos === 0) {
    setText('memTurnover', 'Sem movimentações no período');
  } else if (g.headcount === 0) {
    setText('memTurnover', 'Headcount não cadastrado para estas lojas');
  } else {
    setText('memTurnover', '—');
  }

  const aviso = document.getElementById('memAviso');
  if (aviso) aviso.style.display = (filtros.mes || filtros.ano) ? 'block' : 'none';
}

// ── GRÁFICOS ──────────────────────────────────────────────────────────────────
function renderGraficos(data) {
  renderBarras  ('chartLoja',       data, 'loja',       'Turnover por Loja (%)');
  renderHBarras ('chartSupervisor', data, 'supervisor',  'Turnover por Supervisor (%)');
  renderDonut   ('chartRegiao',     data, 'regiao',      'Turnover por Região');
  renderBarras  ('chartFuncao',     data, 'funcao',      'Turnover por Função (%)');
  renderLinha   ('chartMensal',     data);
}

function criarChart(id, tipo, cfg) {
  if (State.charts[id]) { State.charts[id].destroy(); delete State.charts[id]; }
  const ctx = document.getElementById(id);
  if (!ctx) return;
  State.charts[id] = new Chart(ctx.getContext('2d'), { type: tipo, ...cfg });
}

function metricsGrupo(data, campoNome) {
  return Object.entries(agrupar(data, campoNome))
    .map(([key, rows]) => {
      const m = calcMetrics(rows);
      return { label: key, ...m, turnover: m.turnover ?? 0 };
    })
    .sort((a, b) => b.turnover - a.turnover);
}

function renderBarras(id, data, campoNome, titulo) {
  const mets = metricsGrupo(data, campoNome);
  const clrs = CONFIG.colors.chartBars;
  criarChart(id, 'bar', {
    data: {
      labels: mets.map(m => m.label),
      datasets: [{
        label: 'Turnover (%)',
        data:  mets.map(m => m.turnover),
        backgroundColor: mets.map((_, i) => clrs[i % clrs.length] + 'cc'),
        borderColor:     mets.map((_, i) => clrs[i % clrs.length]),
        borderWidth: 1, borderRadius: 4,
      }]
    },
    options: optsBar(titulo, mets),
  });
}

function renderHBarras(id, data, campoNome, titulo) {
  const mets = metricsGrupo(data, campoNome);
  criarChart(id, 'bar', {
    data: {
      labels: mets.map(m => m.label),
      datasets: [{
        label: 'Turnover (%)',
        data:  mets.map(m => m.turnover),
        backgroundColor: CONFIG.colors.accent + 'bb',
        borderColor:     CONFIG.colors.accent,
        borderWidth: 1, borderRadius: 4,
      }]
    },
    options: { ...optsBar(titulo, mets), indexAxis: 'y' },
  });
}

function renderDonut(id, data, campoNome, titulo) {
  const mets = metricsGrupo(data, campoNome);
  const clrs = CONFIG.colors.chartBars;
  criarChart(id, 'doughnut', {
    data: {
      labels: mets.map(m => m.label),
      datasets: [{
        data: mets.map(m => m.turnover),
        backgroundColor: mets.map((_, i) => clrs[i % clrs.length] + 'cc'),
        borderColor:     mets.map((_, i) => clrs[i % clrs.length]),
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: CONFIG.colors.textSec, font: { size: 12 } } },
        title:  { display: true, text: titulo, color: CONFIG.colors.textPri, font: { size: 13, weight: '600' } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const m = mets[ctx.dataIndex];
              return [
                ` Turnover: ${ctx.raw.toFixed(1)}%`,
                ` Adm: ${m.admissoes}  |  Des: ${m.desligamentos}`,
                ` Ativos: ${m.headcount > 0 ? m.headcount : '⚠ sem cadastro'}`,
              ];
            }
          }
        }
      }
    }
  });
}

function renderLinha(id, data) {
  const por = {};
  for (const r of data) {
    const k = `${r.ano}-${String(MES_IDX[r.mes]).padStart(2, '0')}`;
    if (!por[k]) por[k] = { label: `${r.mes}/${r.ano}`, rows: [] };
    por[k].rows.push(r);
  }

  const sorted  = Object.entries(por).sort(([a], [b]) => a.localeCompare(b));
  const labels  = sorted.map(([, v]) => v.label);
  const tvVals  = sorted.map(([, v]) => { const m = calcMetrics(v.rows); return m.turnover ?? 0; });
  const admVals = sorted.map(([, v]) => v.rows.filter(r => r.status === 'ADMISSÃO').length);
  const demVals = sorted.map(([, v]) => v.rows.filter(r => r.status === 'DEMISSÃO').length);

  criarChart(id, 'line', {
    data: {
      labels,
      datasets: [
        { label: 'Turnover (%)', data: tvVals, borderColor: CONFIG.colors.accent, backgroundColor: CONFIG.colors.accent + '22', fill: true, tension: 0.4, pointRadius: 5, pointBackgroundColor: CONFIG.colors.accent, yAxisID: 'yTv' },
        { label: 'Admissões',    data: admVals, borderColor: CONFIG.colors.success, backgroundColor: 'transparent', borderDash: [4, 3], tension: 0.3, pointRadius: 3, yAxisID: 'yCount' },
        { label: 'Desligamentos', data: demVals, borderColor: CONFIG.colors.danger, backgroundColor: 'transparent', borderDash: [4, 3], tension: 0.3, pointRadius: 3, yAxisID: 'yCount' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: CONFIG.colors.textSec } },
        title:  { display: true, text: 'Evolução Mensal — Turnover, Admissões e Desligamentos', color: CONFIG.colors.textSec, font: { size: 12 } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.yAxisID === 'yTv' ? ` Turnover: ${ctx.raw.toFixed(1)}%` : ` ${ctx.dataset.label}: ${ctx.raw}` } }
      },
      scales: {
        x:      { ticks: { color: CONFIG.colors.textSec }, grid: { color: '#334155' } },
        yTv:    { type: 'linear', position: 'left',  ticks: { color: CONFIG.colors.accent, callback: v => v.toFixed(1) + '%' }, grid: { color: '#334155' }, title: { display: true, text: 'Turnover %', color: CONFIG.colors.accent } },
        yCount: { type: 'linear', position: 'right', ticks: { color: CONFIG.colors.textSec }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Qtd', color: CONFIG.colors.textSec } },
      }
    }
  });
}

function optsBar(titulo, mets) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title:  { display: true, text: titulo, color: CONFIG.colors.textPri, font: { size: 13, weight: '600' } },
      tooltip: {
        callbacks: {
          label: ctx => {
            const m = mets?.[ctx.dataIndex];
            return m ? [
              ` Turnover: ${ctx.raw.toFixed(1)}%`,
              ` Adm: ${m.admissoes}  |  Des: ${m.desligamentos}`,
              ` Ativos: ${m.headcount > 0 ? m.headcount : '⚠ sem cadastro'}`,
            ] : ` ${ctx.raw.toFixed(1)}%`;
          }
        }
      }
    },
    scales: {
      x: { ticks: { color: CONFIG.colors.textSec }, grid: { color: '#334155' } },
      y: { ticks: { color: CONFIG.colors.textSec, callback: v => v.toFixed(1) + '%' }, grid: { color: '#334155' } },
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// UPLOAD LOCAL
// ══════════════════════════════════════════════════════════════════════════════
function lerCSVLocal(file) {
  showState('loading');
  Papa.parse(file, {
    header: true, skipEmptyLines: true,
    complete: r => { processarBase(r.data || []); processarAtivos([]); finalizarCarga('local'); },
    error: () => { showToast('Erro ao ler CSV.', 'error'); showState('error'); }
  });
}

function lerXLSX(file) {
  showState('loading');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'array' });
      const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!json.length) { showToast('Excel vazio.', 'error'); showState('error'); return; }
      processarBase(json);
      processarAtivos([]);
      finalizarCarga('local');
    } catch (err) { showToast('Erro ao ler Excel: ' + err.message, 'error'); showState('error'); }
  };
  reader.readAsArrayBuffer(file);
}

// ══════════════════════════════════════════════════════════════════════════════
// TABELA DETALHADA DE COLABORADORES
// ══════════════════════════════════════════════════════════════════════════════
const DetalheState = {
  data:       [],   // dados base (já filtrados pelo painel)
  filtered:   [],   // após busca interna + status
  sortField:  'periodo',
  sortDir:    'desc',
  page:       1,
  pageSize:   25,
  query:      '',
  statusFilt: '',
};

const MES_NUM = {
  JAN:'01', FEV:'02', MAR:'03', ABR:'04', MAI:'05', JUN:'06',
  JUL:'07', AGO:'08', SET:'09', OUT:'10', NOV:'11', DEZ:'12',
};

function renderDetalhe(data) {
  DetalheState.data = data;
  DetalheState.page = 1;
  aplicarFiltroDetalhe();
}

function aplicarFiltroDetalhe() {
  const q      = DetalheState.query.toLowerCase().trim();
  const status = DetalheState.statusFilt;

  let rows = DetalheState.data;

  if (status) rows = rows.filter(r => r.status === status);

  if (q) {
    rows = rows.filter(r =>
      r.colaborador.toLowerCase().includes(q) ||
      r.funcao.toLowerCase().includes(q)      ||
      r.loja.toLowerCase().includes(q)        ||
      r.supervisor.toLowerCase().includes(q)  ||
      r.regiao.toLowerCase().includes(q)
    );
  }

  // Ordenação
  const { sortField, sortDir } = DetalheState;
  rows = [...rows].sort((a, b) => {
    let va, vb;
    if (sortField === 'periodo') {
      va = `${a.ano}-${MES_NUM[a.mes] || '00'}`;
      vb = `${b.ano}-${MES_NUM[b.mes] || '00'}`;
    } else if (sortField === 'loja') {
      va = parseInt(normLoja(a.loja)) || a.loja;
      vb = parseInt(normLoja(b.loja)) || b.loja;
    } else {
      va = (a[sortField] || '').toLowerCase();
      vb = (b[sortField] || '').toLowerCase();
    }
    if (va < vb) return sortDir === 'asc' ? -1 :  1;
    if (va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  DetalheState.filtered = rows;
  renderDetalheTabela();
}

function renderDetalheTabela() {
  const { filtered, page, pageSize } = DetalheState;
  const total  = filtered.length;
  const pages  = Math.max(1, Math.ceil(total / pageSize));
  const cur    = Math.min(page, pages);
  DetalheState.page = cur;

  const start = (cur - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  // Badge contador
  const badge = document.getElementById('detalheBadge');
  if (badge) badge.textContent = `${total} registro${total !== 1 ? 's' : ''}`;

  // Corpo da tabela
  const tbody = document.getElementById('detalheTbody');
  if (!tbody) return;

  if (!slice.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="detalhe-empty"><span>🔍</span>Nenhum colaborador encontrado com os filtros aplicados.</td></tr>`;
  } else {
    tbody.innerHTML = slice.map(r => {
      const badgeCls = r.status === 'ADMISSÃO' ? 'badge-admissao' : 'badge-demissao';
      const badgeIcon = r.status === 'ADMISSÃO' ? '⬆' : '⬇';
      const lojaFmt = isNaN(parseInt(normLoja(r.loja))) ? r.loja : `Loja ${normLoja(r.loja)}`;
      const periodo = `${r.mes}/${r.ano}`;
      return `<tr>
        <td class="td-colaborador" title="${r.colaborador}">${capitalize(r.colaborador)}</td>
        <td>${capitalize(r.funcao) || '—'}</td>
        <td class="td-loja">${lojaFmt}</td>
        <td>${capitalize(r.supervisor) || '—'}</td>
        <td>${r.regiao || '—'}</td>
        <td class="td-periodo">${periodo}</td>
        <td><span class="badge-status ${badgeCls}">${badgeIcon} ${r.status}</span></td>
      </tr>`;
    }).join('');
  }

  // Paginação
  const pagInfo  = document.getElementById('pagInfo');
  const pagPages = document.getElementById('pagPages');
  const pagPrev  = document.getElementById('pagPrev');
  const pagNext  = document.getElementById('pagNext');

  if (pagInfo) {
    const from = total ? start + 1 : 0;
    const to   = Math.min(start + pageSize, total);
    pagInfo.textContent = `${from}–${to} de ${total}`;
  }

  if (pagPrev) pagPrev.disabled = cur <= 1;
  if (pagNext) pagNext.disabled = cur >= pages;

  if (pagPages) {
    pagPages.innerHTML = '';
    const makeBtn = (n) => {
      const btn = document.createElement('button');
      btn.className = 'pag-num' + (n === cur ? ' active' : '');
      btn.textContent = n;
      btn.addEventListener('click', () => { DetalheState.page = n; renderDetalheTabela(); });
      return btn;
    };
    const makeEllipsis = () => {
      const s = document.createElement('span');
      s.className = 'pag-ellipsis';
      s.textContent = '…';
      return s;
    };

    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) pagPages.appendChild(makeBtn(i));
    } else {
      pagPages.appendChild(makeBtn(1));
      if (cur > 3) pagPages.appendChild(makeEllipsis());
      const lo = Math.max(2, cur - 1), hi = Math.min(pages - 1, cur + 1);
      for (let i = lo; i <= hi; i++) pagPages.appendChild(makeBtn(i));
      if (cur < pages - 2) pagPages.appendChild(makeEllipsis());
      pagPages.appendChild(makeBtn(pages));
    }
  }

  // Atualizar setas de ordenação
  document.querySelectorAll('.detalhe-table th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = '↕';
    if (th.dataset.sort === DetalheState.sortField) {
      th.classList.add(DetalheState.sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      if (arrow) arrow.textContent = DetalheState.sortDir === 'asc' ? '↑' : '↓';
    }
  });
}

function capitalize(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function setupDetalheListeners() {
  // Busca
  const search = document.getElementById('detalheSearch');
  if (search) {
    search.addEventListener('input', () => {
      DetalheState.query = search.value;
      DetalheState.page  = 1;
      aplicarFiltroDetalhe();
    });
  }

  // Filtro de status
  const statusFilter = document.getElementById('detalheStatusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      DetalheState.statusFilt = statusFilter.value;
      DetalheState.page = 1;
      aplicarFiltroDetalhe();
    });
  }

  // Ordenação por cabeçalho
  document.querySelectorAll('.detalhe-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (DetalheState.sortField === field) {
        DetalheState.sortDir = DetalheState.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        DetalheState.sortField = field;
        DetalheState.sortDir   = 'asc';
      }
      DetalheState.page = 1;
      aplicarFiltroDetalhe();
    });
  });

  // Paginação
  const pagPrev = document.getElementById('pagPrev');
  const pagNext = document.getElementById('pagNext');
  const pagSize = document.getElementById('pagSize');

  if (pagPrev) pagPrev.addEventListener('click', () => {
    if (DetalheState.page > 1) { DetalheState.page--; renderDetalheTabela(); }
  });
  if (pagNext) pagNext.addEventListener('click', () => {
    const pages = Math.ceil(DetalheState.filtered.length / DetalheState.pageSize);
    if (DetalheState.page < pages) { DetalheState.page++; renderDetalheTabela(); }
  });
  if (pagSize) pagSize.addEventListener('change', () => {
    DetalheState.pageSize = parseInt(pagSize.value, 10);
    DetalheState.page = 1;
    renderDetalheTabela();
  });

  // Exportar CSV
  const btnExport = document.getElementById('btnExportCSV');
  if (btnExport) {
    btnExport.addEventListener('click', exportarCSV);
  }
}

function exportarCSV() {
  const rows = DetalheState.filtered;
  if (!rows.length) { showToast('Nenhum dado para exportar.', 'warning'); return; }

  const header = ['Colaborador','Função','Loja','Supervisor','Região','Período','Status'];
  const lines  = [header.join(';')];

  for (const r of rows) {
    lines.push([
      `"${r.colaborador}"`,
      `"${r.funcao}"`,
      `"${normLoja(r.loja)}"`,
      `"${r.supervisor}"`,
      `"${r.regiao}"`,
      `"${r.mes}/${r.ano}"`,
      `"${r.status}"`,
    ].join(';'));
  }

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `colaboradores_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`CSV exportado — ${rows.length} registros.`, 'success');
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ══════════════════════════════════════════════════════════════════════════════
function agrupar(arr, campoNome) {
  return arr.reduce((acc, r) => {
    const k = r[campoNome] || '(vazio)';
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function atualizarTimestamp() {
  if (State.lastUpdate)
    setText('lastUpdate', `Atualizado: ${State.lastUpdate.toLocaleString('pt-BR')}`);
}

function showState(state) {
  ['stateLoading', 'stateError', 'stateEmpty', 'stateDashboard'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const map = { loading: 'stateLoading', error: 'stateError', empty: 'stateEmpty', dashboard: 'stateDashboard' };
  const el  = document.getElementById(map[state]);
  if (el) el.style.display = state === 'dashboard' ? 'block' : 'flex';
}

function showToast(msg, tipo = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className  = `toast toast-${tipo}`;
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 4500);
}
