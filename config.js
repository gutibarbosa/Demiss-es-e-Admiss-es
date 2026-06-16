/**
 * config.js — Dashboard RH | Turnover (CORRIGIDO v3)
 * Duas abas separadas: DESLIGAMENTOS e ADMISSÕES
 * v3: suporte a STATUS_DESLIGAMENTO / STATUS_ADMISSÕES + lógica de progresso
 */

const CONFIG = {

  // ─── URLs das duas abas do Google Sheets ─────────────────────────────────
  urlDesligamentos: `https://docs.google.com/spreadsheets/d/e/2PACX-1vR6VlmxFL-Bd-A1BwVyTX-n42xWXyEmwogWgSXwMGfFOTjHno1uphUwAFM_-y-SGxV2OEaChDdXsfs9/pub?gid=0&single=true&output=csv`,
  urlAdmissoes:     `https://docs.google.com/spreadsheets/d/e/2PACX-1vR6VlmxFL-Bd-A1BwVyTX-n42xWXyEmwogWgSXwMGfFOTjHno1uphUwAFM_-y-SGxV2OEaChDdXsfs9/pub?gid=108144115&single=true&output=csv`,

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
    ano:              ['ano', 'year', 'exercicio'],
    dataDesligamento: ['data_desligamento', 'data_demissao', 'desligamento', 'dt_desligamento', 'data desligamento'],
    dataAdmissao:     ['data_admissao', 'data admissão', 'data_admissão', 'dt_admissao', 'admissao'],
    // ── Campos de acompanhamento operacional ──
    // Captura STATUS_DESLIGAMENTO e variantes
    statusProcesso:   ['status_desligamento', 'status_demissao', 'status_processo',
                       'status_pagamento', 'status_prazo'],
    // Data de referência para calcular "Dias em Aberto"
    dataReferencia:   ['ultimo_dia_trabalho', 'data_desligamento', 'data_demissao',
                       'dt_desligamento', 'vencimento_pagamento'],
  },

  // ─── COLUNAS — ABA ADMISSÕES ──────────────────────────────────────────────
  // Cabeçalhos reais: COLABORADOR, SUPERVISOR, GERENTE, CARGO, MUNICÍPIO,
  // LOJA, ADMISSÃO, MÊS, ASO, STATUS_ADMISSÕES, SOLICITAÇÃO,
  // VENC_CONTRATAÇÃO, EXP_30, EXP_90, COLABORADORES_ATIVOS
  colAdmissoes: {
    colaborador:         ['colaborador', 'nome', 'funcionario'],
    supervisor:          ['supervisor', 'gestor', 'lider', 'coordenador'],
    cargo:               ['cargo', 'funcao', 'funcção', 'role', 'position'],
    municipio:           ['municipio', 'município', 'cidade', 'local', 'regiao', 'região'],
    loja:                ['loja', 'store', 'filial', 'unidade'],
    ano:                 ['ano', 'year', 'exercicio'],
    dataAdmissao:        ['admissao', 'admissão', 'data_admissao', 'data_admissão', 'dt_admissao'],
    mes:                 ['mes', 'mês', 'month', 'competencia'],
    colaboradoresAtivos: ['colaboradores_ativos', 'colaboradores ativos', 'ativos', 'headcount', 'efetivo'],
    // ── Campos de acompanhamento operacional ──
    // Captura STATUS_ADMISSÕES e variantes
    statusProcesso:      ['status_admissoes', 'status_admissão', 'status_admissao',
                          'status_processo', 'status'],
    // Data de referência para calcular "Dias em Aberto"
    dataReferencia:      ['solicitacao', 'solicitação', 'admissao', 'admissão',
                          'data_admissao', 'data_admissão', 'venc_contratacao'],
  },

  // ─── LÓGICA DE PROGRESSO DO PROCESSO ─────────────────────────────────────
  // Recebe o texto bruto do campo e devolve { categoria, label, pct, icone }
  // categoria: 'EM_ANDAMENTO' | 'PENDENTE' | 'FINALIZADO' | 'TRAVADO' | null
  interpretarStatus(rawStatus) {
    if (!rawStatus || !String(rawStatus).trim()) {
      return { categoria: null, label: '—', pct: 0, icone: '⚪' };
    }

    const orig = String(rawStatus).trim();
    const s = orig.toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // FINALIZADO
    if (/FINALIZ|CONCLU|ENCERR|COMPLETO|PAGO\b|ASSINADO|HOMOLOGAD/.test(s))
      return { categoria: 'FINALIZADO', label: orig, pct: 100, icone: '🟢' };

    // TRAVADO
    if (/TRAVADO|BLOQUEADO|IMPEDIDO|CANCELADO|RECUSADO/.test(s))
      return { categoria: 'TRAVADO', label: orig, pct: 20, icone: '🔴' };

    // PENDENTE — subtipos comuns
    if (/PAGAMENTO|PAGAR/.test(s))
      return { categoria: 'PENDENTE', label: orig, pct: 80, icone: '🔴' };
    if (/DOCUMENTO|DOC\b/.test(s))
      return { categoria: 'PENDENTE', label: orig, pct: 15, icone: '🔴' };
    if (/PENDENTE|AGUARDANDO|AGUARD|A FAZER|ABERTO|NAO INICIADO|SOLICITADO/.test(s))
      return { categoria: 'PENDENTE', label: orig, pct: 15, icone: '🔴' };

    // EM ANDAMENTO — com % diferentes por subtipo
    if (/ASSINATURA/.test(s))
      return { categoria: 'EM_ANDAMENTO', label: orig, pct: 70, icone: '🟠' };
    if (/EXAME|ASO|MEDICO/.test(s))
      return { categoria: 'EM_ANDAMENTO', label: orig, pct: 50, icone: '🟠' };
    if (/INICIADO/.test(s))
      return { categoria: 'EM_ANDAMENTO', label: orig, pct: 25, icone: '🟡' };
    if (/ANDAMENTO|EM PROG/.test(s))
      return { categoria: 'EM_ANDAMENTO', label: orig, pct: 55, icone: '🟠' };

    // Fallback: texto presente mas não reconhecido → em andamento
    return { categoria: 'EM_ANDAMENTO', label: orig, pct: 40, icone: '🟠' };
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
