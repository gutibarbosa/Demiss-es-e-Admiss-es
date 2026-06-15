/**
 * config.js — Dashboard RH | Desligamentos & Admissões
 * ─────────────────────────────────────────────────────────────────────────────
 * Integração via Google Sheets publicado como CSV (sem CORS, funciona no GitHub Pages)
 *
 * ✅ Google Sheets configurado e conectado.
 *    Planilha: DEMISSÕES / ADMISSÕES
 *    Aba DESLIGAMENTOS → gid=0
 *    Aba ADMISSÕES     → gid=108144115
 *
 * Para trocar a planilha: substitua urlDesligamentos e urlAdmissoes pelos novos links CSV.
 * Fallback automático: usa data.js se o Sheets estiver inacessível.
 */

const CONFIG = {

  // ─── URLs CSV do Google Sheets publicado ─────────────────────────────────
  // Cole aqui os links gerados em "Publicar na web" para cada aba.
  // Formato esperado: https://docs.google.com/spreadsheets/d/e/{ID_PUBLICADO}/pub?gid={GID}&single=true&output=csv
  //
  // ID da planilha (edição): 1qY5kOqLNe5znLK5gIY45ovjIhIQO9wOj242jaD0oTsA
  // O ID publicado (para CSV) é DIFERENTE — ele aparece no link gerado pelo "Publicar na web".
  urlDesligamentos: `https://docs.google.com/spreadsheets/d/e/2PACX-1vR6VlmxFL-Bd-A1BwVyTX-n42xWXyEmwogWgSXwMGfFOTjHno1uphUwAFM_-y-SGxV2OEaChDdXsfs9/pub?gid=0&single=true&output=csv`,
  urlAdmissoes:     `https://docs.google.com/spreadsheets/d/e/2PACX-1vR6VlmxFL-Bd-A1BwVyTX-n42xWXyEmwogWgSXwMGfFOTjHno1uphUwAFM_-y-SGxV2OEaChDdXsfs9/pub?gid=108144115&single=true&output=csv`,

  // Fallback automático: usa data.js quando as URLs acima estiverem vazias ou inacessíveis
  localFallback: true,

  // ─── MAPEAMENTO DE COLUNAS — DESLIGAMENTOS ───────────────────────────────
  // Detecta automaticamente o nome real da coluna na planilha.
  // Os nomes abaixo estão alinhados com os cabeçalhos reais do seu XLSX.
  colDesligamentos: {
    colaborador:        ['colaborador', 'nome', 'funcionario', 'employee'],
    supervisor:         ['supervisor', 'gestor', 'lider', 'coordenador'],
    gerente:            ['gerente', 'gerente_loja', 'manager', 'responsavel'],
    cargo:              ['cargo', 'funcao', 'funcção', 'role', 'position'],
    municipio:          ['municipio', 'município', 'cidade', 'local', 'localidade', 'regiao', 'região'],
    loja:               ['loja', 'store', 'filial', 'unidade', 'cod_loja'],
    mes:                ['mes', 'mês', 'month', 'competencia', 'competência'],
    dataAdmissao:       ['data_admissao', 'data admissão', 'data_admissão', 'dt_admissao', 'admissao'],
    dataDesligamento:   ['data_desligamento', 'data_demissao', 'desligamento', 'dt_desligamento', 'data desligamento'],
    ultimoDia:          ['ultimo_dia_trabalho', 'ultimo_dia', 'último dia trabalho', 'ultimo dia trabalhado'],
    vencimentoPgto:     ['vencimento_pagamento', 'vencimento pagamento', 'vencimento', 'dt_vencimento', 'prazo_pagamento'],
    statusPagamento:    ['status_pagamento', 'status pagamento', 'pagamento', 'situacao_pagamento'],
    aso:                ['aso', 'exame', 'exame_demissional', 'exame demissional'],
    documento:          ['documento', 'tipo_documento', 'doc'],
    tipoDesligamento:   ['tipo_desligamento', 'tipo desligamento', 'tipo', 'motivo', 'motivo_desligamento'],
    statusProgresso:    ['status_progresso', 'status progresso', 'processo', 'situacao_processo', 'status_processo'],
    statusPrazo:        ['status_prazo', 'status prazo', 'prazo', 'situacao_prazo'],
    colaboradoresAtivos:['colaboradores_ativos', 'colaboradores ativos', 'ativos', 'headcount', 'efetivo', 'quadro'],
    tempoEmpresa:       ['tempo_empresa', 'tempo empresa', 'tempo_de_empresa', 'antiguidade'],
  },

  // ─── MAPEAMENTO DE COLUNAS — ADMISSÕES ───────────────────────────────────
  // Alinhado com os cabeçalhos reais: COLABORADOR, SUPERVISOR, GERENTE, CARGO,
  // MUNICÍPIO, LOJA, ADMISSÃO, MÊS, ASO, STATUS_ADMISSÕES, SOLICITAÇÃO,
  // VENC_CONTRATAÇÃO, EXP_30, EXP_90, COLABORADORES_ATIVOS
  colAdmissoes: {
    colaborador:        ['colaborador', 'nome', 'funcionario', 'employee'],
    supervisor:         ['supervisor', 'gestor', 'lider', 'coordenador'],
    gerente:            ['gerente', 'gerente_loja', 'manager', 'responsavel'],
    cargo:              ['cargo', 'funcao', 'funcção', 'role', 'position'],
    municipio:          ['municipio', 'município', 'cidade', 'local', 'localidade', 'regiao', 'região'],
    loja:               ['loja', 'store', 'filial', 'unidade', 'cod_loja'],
    dataAdmissao:       ['admissao', 'admissão', 'data_admissao', 'data_admissão', 'dt_admissao'],
    mes:                ['mes', 'mês', 'month', 'competencia'],
    aso:                ['aso', 'exame', 'exame_admissional', 'exame admissional'],
    statusAdm:          ['status_admissoes', 'status_admissão', 'status admissoes', 'status_adm', 'situacao', 'status'],
    solicitacao:        ['solicitacao', 'solicitação', 'data_solicitacao', 'abertura'],
    vencContratacao:    ['venc_contratacao', 'venc_contratação', 'vencimento_contratacao', 'prazo_contratacao'],
    exp30:              ['exp_30', 'exp30', 'experiencia_30', '30_dias', 'venc_30'],
    exp90:              ['exp_90', 'exp90', 'experiencia_90', '90_dias', 'venc_90'],
    colaboradoresAtivos:['colaboradores_ativos', 'colaboradores ativos', 'ativos', 'headcount', 'efetivo'],
  },

  // ─── SEMÁFORO DE PRAZO ────────────────────────────────────────────────────
  semaforo: {
    diasAvisoAntecipado: 5,  // amarelo: vence em até 5 dias | vermelho: já venceu | verde: ok
  },

  /**
   * Calcula status do semáforo com base na data de vencimento.
   * @param {Date|null} dataVenc
   * @returns {'verde'|'amarelo'|'vermelho'|'sem_prazo'}
   */
  calcSemaforo(dataVenc) {
    if (!dataVenc || isNaN(dataVenc.getTime())) return 'sem_prazo';
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const venc = new Date(dataVenc); venc.setHours(0, 0, 0, 0);
    const dias = Math.ceil((venc - hoje) / 86400000);
    if (dias < 0)                                  return 'vermelho';
    if (dias <= this.semaforo.diasAvisoAntecipado) return 'amarelo';
    return 'verde';
  },

  // ─── FÓRMULA OFICIAL DE TURNOVER ─────────────────────────────────────────
  // Turnover (%) = ((Admissões + Desligamentos) / 2) ÷ Ativos × 100
  calcTurnover(admissoes, desligamentos, headcount) {
    if (!headcount || headcount <= 0) return null;
    return ((admissoes + desligamentos) / 2 / headcount) * 100;
  },

  // ─── ALIASES DE STATUS — PAGAMENTO PENDENTE ──────────────────────────────
  statusPagamentoPendente: [
    'pendente', 'aguardando', 'a pagar', 'nao pago', 'em aberto', 'aberto',
    'nao realizado', 'nao efetuado', 'atrasado', 'vence hoje', 'vence em breve',
  ],

  // ─── ALIASES DE STATUS — ASO PENDENTE ────────────────────────────────────
  statusAsoPendente: [
    'pendente', 'aguardando', 'nao realizado', 'nao efetuado',
    'em aberto', 'a realizar', 'nao feito', 'agendado',
  ],

  // ─── ALIASES DE STATUS ADMISSÃO — PENDENTES ──────────────────────────────
  statusAdmPendente: [
    'pendente', 'em andamento', 'aguardando', 'aberto',
    'nao concluido', 'incompleto', 'processando',
  ],

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
