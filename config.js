/**
 * config.js — Dashboard RH | Turnover (CORRIGIDO v2)
 * Duas abas separadas: DESLIGAMENTOS e ADMISSÕES
 */

const CONFIG = {

  // ─── URLs das duas abas do Google Sheets ─────────────────────────────────
  urlDesligamentos: `https://docs.google.com/spreadsheets/d/e/2PACX-1vR6VlmxFL-Bd-A1BwVyTX-n42xWXyEmwogWgSXwMGfFOTjHno1uphUwAFM_-y-SGxV2OEaChDdXsfs9/pub?gid=0&single=true&output=csv`,
  urlAdmissoes:     `https://docs.google.com/spreadsheets/d/e/2PACX-1vR6VlmxFL-Bd-A1BwVyTX-n42xWXyEmwogWgSXwMGfFOTjHno1uphUwAFM_-y-SGxV2OEaChDdXsfs9/pub?gid=108144115&single=true&output=csv`,

  // Fallback: usa window.EMBEDDED_DATA de data.js se o Sheets estiver inacessível
  localFallback: true,

  // ─── COLUNAS — ABA DESLIGAMENTOS ─────────────────────────────────────────
  // Cabeçalhos reais: COLABORADOR, SUPERVISOR, GERENTE, CARGO, MUNICÍPIO,
  // LOJA, MÊS, DATA_ADMISSÃO, DATA_DESLIGAMENTO, ULTIMO_DIA_TRABALHO,
  // VENCIMENTO_PAGAMENTO, STATUS_PAGAMENTO, ASO, DOCUMENTO,
  // TIPO_DESLIGAMENTO, STATUS_PROGRESSO, STATUS_PRAZO, COLABORADORES_ATIVOS, TEMPO_EMPRESA
  colDesligamentos: {
    colaborador:      ['colaborador', 'nome', 'funcionario'],
    supervisor:       ['supervisor', 'gestor', 'lider', 'coordenador'],
    cargo:            ['cargo', 'funcao', 'funcção', 'role', 'position'],
    municipio:        ['municipio', 'município', 'cidade', 'local', 'regiao', 'região'],
    loja:             ['loja', 'store', 'filial', 'unidade'],
    mes:              ['mes', 'mês', 'month', 'competencia', 'competência'],
    // ANO: não existe coluna ANO — o app.js extrai da dataDesligamento
    ano:              ['ano', 'year', 'exercicio'],
    dataDesligamento: ['data_desligamento', 'data_demissao', 'desligamento', 'dt_desligamento', 'data desligamento'],
    dataAdmissao:     ['data_admissao', 'data admissão', 'data_admissão', 'dt_admissao', 'admissao'],
  },

  // ─── COLUNAS — ABA ADMISSÕES ──────────────────────────────────────────────
  // Cabeçalhos reais: COLABORADOR, SUPERVISOR, GERENTE, CARGO, MUNICÍPIO,
  // LOJA, ADMISSÃO, MÊS, ASO, STATUS_ADMISSÕES, SOLICITAÇÃO,
  // VENC_CONTRATAÇÃO, EXP_30, EXP_90, COLABORADORES_ATIVOS
  colAdmissoes: {
    colaborador:        ['colaborador', 'nome', 'funcionario'],
    supervisor:         ['supervisor', 'gestor', 'lider', 'coordenador'],
    cargo:              ['cargo', 'funcao', 'funcção', 'role', 'position'],
    municipio:          ['municipio', 'município', 'cidade', 'local', 'regiao', 'região'],
    loja:               ['loja', 'store', 'filial', 'unidade'],
    // ANO: extraído da data de admissão pelo app.js
    ano:                ['ano', 'year', 'exercicio'],
    dataAdmissao:       ['admissao', 'admissão', 'data_admissao', 'data_admissão', 'dt_admissao'],
    mes:                ['mes', 'mês', 'month', 'competencia'],
    colaboradoresAtivos:['colaboradores_ativos', 'colaboradores ativos', 'ativos', 'headcount', 'efetivo'],
  },

  // ─── FÓRMULA DE TURNOVER ─────────────────────────────────────────────────
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
