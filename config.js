/**
 * config.js — Dashboard RH | Turnover
 * Corrigido: nomes de propriedades alinhados com app.js
 */

const CONFIG = {

  // ─── URLs CSV do Google Sheets publicado ─────────────────────────────────
  // app.js usa CONFIG.urlBaseTurnover e CONFIG.urlAtivos
  urlBaseTurnover: `https://docs.google.com/spreadsheets/d/e/2PACX-1vR6VlmxFL-Bd-A1BwVyTX-n42xWXyEmwogWgSXwMGfFOTjHno1uphUwAFM_-y-SGxV2OEaChDdXsfs9/pub?gid=0&single=true&output=csv`,
  urlAtivos:       `https://docs.google.com/spreadsheets/d/e/2PACX-1vR6VlmxFL-Bd-A1BwVyTX-n42xWXyEmwogWgSXwMGfFOTjHno1uphUwAFM_-y-SGxV2OEaChDdXsfs9/pub?gid=108144115&single=true&output=csv`,

  // Fallback automático: usa data.js quando as URLs estiverem inacessíveis
  localFallback: true,

  // ─── MAPEAMENTO DE COLUNAS — BASE_TURNOVER ────────────────────────────────
  // app.js usa CONFIG.colTurnover
  colTurnover: {
    colaborador: ['colaborador', 'nome', 'funcionario', 'employee'],
    supervisor:  ['supervisor', 'gestor', 'lider', 'coordenador'],
    gerente:     ['gerente', 'gerente_loja', 'manager', 'responsavel'],
    funcao:      ['cargo', 'funcao', 'funcção', 'role', 'position'],
    regiao:      ['municipio', 'município', 'cidade', 'local', 'localidade', 'regiao', 'região'],
    loja:        ['loja', 'store', 'filial', 'unidade', 'cod_loja'],
    mes:         ['mes', 'mês', 'month', 'competencia', 'competência'],
    ano:         ['ano', 'year', 'exercicio', 'exercício'],
    status:      [
      // Desligamentos
      'tipo_desligamento', 'tipo desligamento', 'tipo', 'motivo', 'motivo_desligamento',
      // Admissões
      'status_admissoes', 'status_admissão', 'status admissoes', 'status_adm', 'situacao', 'status',
    ],
  },

  // ─── MAPEAMENTO DE COLUNAS — ATIVOS ──────────────────────────────────────
  // app.js usa CONFIG.colAtivos
  colAtivos: {
    loja:   ['loja', 'store', 'filial', 'unidade', 'cod_loja'],
    ativos: ['colaboradores_ativos', 'colaboradores ativos', 'ativos', 'headcount', 'efetivo', 'ativos_atuais'],
  },

  // ─── ALIASES DE STATUS ────────────────────────────────────────────────────
  // app.js usa CONFIG.statusAdmissao e CONFIG.statusDemissao
  statusAdmissao: [
    'admissao', 'admissão', 'admitido', 'contratado', 'empregado',
    'entrada', 'novo', 'contratacao', 'ativo', 'realizado',
  ],
  statusDemissao: [
    'demissao', 'demissão', 'desligamento', 'desligado', 'demitido',
    'saida', 'saída', 'rescisao', 'rescisão', 'indenizado', 'trabalhado',
  ],

  // ─── FÓRMULA OFICIAL DE TURNOVER ─────────────────────────────────────────
  calcTurnover(admissoes, desligamentos, headcount) {
    if (!headcount || headcount <= 0) return null;
    return ((admissoes + desligamentos) / 2 / headcount) * 100;
  },

  // ─── PALETA VISUAL ────────────────────────────────────────────────────────
  colors: {
    bg:        '#0f172a',
    card:      '#1e293b',
    border:    '#334155',
    accent:    '#38bdf8',
    accentAlt: '#0ea5e9',
    success:   '#34d399',
    warning:   '#fbbf24',
    danger:    '#f87171',
    textPri:   '#f1f5f9',
    textSec:   '#94a3b8',
    chartBars: [
      '#38bdf8','#0ea5e9','#7dd3fc','#34d399','#a78bfa',
      '#fb923c','#f472b6','#fbbf24','#60a5fa','#4ade80',
    ],
  },
};
