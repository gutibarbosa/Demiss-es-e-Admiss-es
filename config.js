/**
 * config.js — Dashboard RH | Desligamentos & Admissões
 * ─────────────────────────────────────────────────────────────────────────────
 * Integração via Google Sheets publicado como CSV (sem CORS, funciona no GitHub Pages)
 * Publicar: Arquivo → Compartilhar → Publicar na web → selecionar aba → CSV
 *
 * ABAS NECESSÁRIAS:
 *   1. DESLIGAMENTOS  — movimentações de saída + headcount por loja
 *   2. ADMISSÕES      — movimentações de entrada + controle de experiência
 */

const CONFIG = {

  // ─── URLs CSV do Google Sheets publicado ─────────────────────────────────
  // Substitua pelo ID publicado da sua planilha e pelos GIDs de cada aba.
  // Para encontrar o GID: abra a aba desejada → veja o final da URL (...#gid=XXXXXXX)
  // Formato: https://docs.google.com/spreadsheets/d/e/{ID_PUBLICADO}/pub?gid={GID}&single=true&output=csv
  urlDesligamentos: `https://docs.google.com/spreadsheets/d/e/SEU_ID_PUBLICADO/pub?gid=0&single=true&output=csv`,
  urlAdmissoes:     `https://docs.google.com/spreadsheets/d/e/SEU_ID_PUBLICADO/pub?gid=1&single=true&output=csv`,

  // Fallback para dados embutidos em data.js se as abas do Sheets falharem
  localFallback: true,

  // ─── MAPEAMENTO DE COLUNAS — DESLIGAMENTOS ───────────────────────────────
  // Cada chave lista os possíveis nomes da coluna na planilha (sem acento, lowercase)
  // O sistema detecta automaticamente qual nome está sendo usado.
  colDesligamentos: {
    colaborador:        ['colaborador', 'nome', 'funcionario', 'employee'],
    supervisor:         ['supervisor', 'gestor', 'lider', 'coordenador'],
    gerente:            ['gerente', 'gerente_loja', 'manager', 'responsavel'],
    cargo:              ['cargo', 'funcao', 'funcção', 'role', 'position', 'funcao'],
    municipio:          ['municipio', 'município', 'cidade', 'local', 'localidade', 'regiao', 'região'],
    loja:               ['loja', 'store', 'filial', 'unidade', 'cod_loja'],
    dataAdmissao:       ['data_admissao', 'data admissao', 'admissao', 'dt_admissao', 'data_admissão', 'data admissão'],
    dataDesligamento:   ['data_desligamento', 'data desligamento', 'desligamento', 'dt_desligamento', 'data_demissao', 'data demissao'],
    ultimoDia:          ['ultimo_dia', 'último dia', 'ultimo dia trabalhado', 'último dia trabalhado', 'ultimo_dia_trabalhado'],
    vencimentoPgto:     ['vencimento_pagamento', 'vencimento pagamento', 'vencimento', 'dt_vencimento', 'prazo_pagamento'],
    statusPagamento:    ['status_pagamento', 'status pagamento', 'pagamento', 'situacao_pagamento'],
    aso:                ['aso', 'exame', 'exame_demissional', 'exame demissional'],
    tipoDesligamento:   ['tipo_desligamento', 'tipo desligamento', 'tipo', 'motivo', 'motivo_desligamento'],
    statusProcesso:     ['status_processo', 'status processo', 'processo', 'situacao_processo'],
    statusPrazo:        ['status_prazo', 'status prazo', 'prazo', 'situacao_prazo'],
    colaboradoresAtivos:['colaboradores_ativos', 'colaboradores ativos', 'ativos', 'headcount', 'efetivo', 'quadro', 'ativos_atuais'],
    tempoEmpresa:       ['tempo_empresa', 'tempo empresa', 'tempo_de_empresa', 'antiguidade'],
  },

  // ─── MAPEAMENTO DE COLUNAS — ADMISSÕES ───────────────────────────────────
  colAdmissoes: {
    colaborador:        ['colaborador', 'nome', 'funcionario', 'employee'],
    supervisor:         ['supervisor', 'gestor', 'lider', 'coordenador'],
    gerente:            ['gerente', 'gerente_loja', 'manager', 'responsavel'],
    cargo:              ['cargo', 'funcao', 'funcção', 'role', 'position'],
    municipio:          ['municipio', 'município', 'cidade', 'local', 'localidade', 'regiao', 'região'],
    loja:               ['loja', 'store', 'filial', 'unidade', 'cod_loja'],
    dataAdmissao:       ['admissao', 'admissão', 'data_admissao', 'data admissao', 'dt_admissao', 'data_admissão'],
    solicitacao:        ['solicitacao', 'solicitação', 'data_solicitacao', 'data solicitacao', 'abertura'],
    vencimentoContrat:  ['vencimento_contratacao', 'vencimento contratacao', 'vencimento_contratação', 'prazo_contratacao', 'prazo contratacao'],
    exp30:              ['exp_30', 'exp30', 'experiencia_30', 'experiência 30', '30_dias', 'venc_30'],
    exp90:              ['exp_90', 'exp90', 'experiencia_90', 'experiência 90', '90_dias', 'venc_90'],
    aso:                ['aso', 'exame', 'exame_admissional', 'exame admissional'],
    statusAdm:          ['status_adm', 'status adm', 'status_admissao', 'status admissao', 'situacao', 'status'],
    tempoEmpresaAtual:  ['tempo_empresa_atual', 'tempo empresa atual', 'tempo_atual', 'antiguidade_atual'],
  },

  // ─── SEMÁFORO DE PRAZO ────────────────────────────────────────────────────
  // Define os limites em dias para classificação de status de prazo
  semaforo: {
    diasAvisoAntecipado: 5,   // amarelo: vence em até N dias
    // vermelho: já venceu (data < hoje)
    // verde:    vence em mais de N dias
  },

  /**
   * Calcula o status do semáforo com base na data de vencimento.
   * @param {Date|null} dataVenc — data de vencimento parseada
   * @returns {'verde'|'amarelo'|'vermelho'|'sem_prazo'}
   */
  calcSemaforo(dataVenc) {
    if (!dataVenc || isNaN(dataVenc.getTime())) return 'sem_prazo';
    const hoje    = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc    = new Date(dataVenc);
    venc.setHours(0, 0, 0, 0);
    const diffMs  = venc - hoje;
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDias < 0)                              return 'vermelho';  // vencido
    if (diffDias <= this.semaforo.diasAvisoAntecipado) return 'amarelo';  // vencendo
    return 'verde';                                                     // no prazo
  },

  // ─── FÓRMULA OFICIAL DE TURNOVER ─────────────────────────────────────────
  // Turnover (%) = ((Admissões + Desligamentos) / 2) ÷ Ativos × 100
  calcTurnover(admissoes, desligamentos, headcount) {
    if (!headcount || headcount <= 0) return null;
    return ((admissoes + desligamentos) / 2 / headcount) * 100;
  },

  // ─── ALIASES DE STATUS — PAGAMENTO ───────────────────────────────────────
  // Valores que indicam pagamento ainda pendente (normalizado, sem acento)
  statusPagamentoPendente: [
    'pendente', 'aguardando', 'a pagar', 'nao pago', 'em aberto', 'aberto',
    'nao realizado', 'nao efetuado', 'aguarda', 'atrasado',
  ],

  // ─── ALIASES DE STATUS — ASO PENDENTE ────────────────────────────────────
  statusAsoPendente: [
    'pendente', 'aguardando', 'nao realizado', 'nao efetuado', 'nao agendado',
    'em aberto', 'aberto', 'a realizar', 'nao feito',
  ],

  // ─── ALIASES DE STATUS ADMISSÃO — PENDENTES ──────────────────────────────
  statusAdmPendente: [
    'pendente', 'em andamento', 'aguardando', 'aberto', 'em aberto',
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
