/**
 * Controlador Principal da Aplicação E-REDES PowerScope
 */

import { ERedesParser } from './parser.js';
import { ERedesAnalyzer } from './analyzer.js';
import { ERedesCharts } from './charts.js';
import { ERSERules } from './erseRules.js';

class ERedesApp {
  constructor() {
    this.rawDatasets = [];
    this.mergedDataset = null;
    this.filteredDataset = null;
    this.analysis = null;
    this.activeTab = 'tab-timeline';
    this.activeAggregationMode = 'daily';
    this.customPrices = JSON.parse(JSON.stringify(ERSERules.DEFAULT_PRICES));

    this.initDOM();
    this.bindEvents();
    this.autoLoadSampleIfExists();
  }

  initDOM() {
    // Dropzone e inputs
    this.dropzone = document.getElementById('dropzone');
    this.fileInput = document.getElementById('file-input');
    this.btnLoadSample = document.getElementById('btn-load-sample');
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.btnExportReport = document.getElementById('btn-export-report');
    this.filesBadge = document.getElementById('files-badge');

    // Metadados
    this.metaCpe = document.getElementById('meta-cpe');
    this.metaPeriod = document.getElementById('meta-period');
    this.metaRecords = document.getElementById('meta-records');
    this.metaQuality = document.getElementById('meta-quality');

    // Filtros
    this.filterMonth = document.getElementById('filter-month');
    this.filterDayType = document.getElementById('filter-day-type');

    // Cards KPI
    this.kpiKwhMedido = document.getElementById('kpi-kwh-medido');
    this.kpiKwhSub = document.getElementById('kpi-kwh-sub');
    this.kpiPeakKw = document.getElementById('kpi-peak-kw');
    this.kpiPeakSub = document.getElementById('kpi-peak-sub');
    this.kpiRecommendedKva = document.getElementById('kpi-recommended-kva');
    this.kpiRecommendedSub = document.getElementById('kpi-recommended-sub');
    this.kpiTariffVazio = document.getElementById('kpi-tariff-vazio');
    this.kpiTariffSub = document.getElementById('kpi-tariff-sub');
    this.kpiStandbyWatts = document.getElementById('kpi-standby-watts');
    this.kpiStandbySub = document.getElementById('kpi-standby-sub');
    this.kpiSolarCard = document.getElementById('kpi-solar-card');
    this.kpiSolarKwh = document.getElementById('kpi-solar-kwh');
    this.kpiSolarSub = document.getElementById('kpi-solar-sub');

    // Diagnósticos
    this.insightsContainer = document.getElementById('insights-container');

    // Tabela de Risco de Potência
    this.powerTableBody = document.getElementById('power-risk-table-body');

    // Simulador de Tarifários
    this.simTableBody = document.getElementById('simulator-table-body');
  }

  bindEvents() {
    // Drag & Drop
    if (this.dropzone) {
      ['dragenter', 'dragover'].forEach((eventName) => {
        this.dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropzone.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach((eventName) => {
        this.dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.dropzone.classList.remove('drag-over');
        });
      });

      this.dropzone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) this.handleFiles(files);
      });

      this.dropzone.addEventListener('click', () => {
        if (this.fileInput) this.fileInput.click();
      });
    }

    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) this.handleFiles(files);
      });
    }

    if (this.btnLoadSample) {
      this.btnLoadSample.addEventListener('click', () => this.loadSampleFile());
    }

    if (this.filterMonth) {
      this.filterMonth.addEventListener('change', () => this.applyFilters());
    }

    if (this.filterDayType) {
      this.filterDayType.addEventListener('change', () => this.applyFilters());
    }

    // Tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // Seletor de agregação diária vs mensal
    const aggDailyBtn = document.getElementById('btn-agg-daily');
    const aggMonthlyBtn = document.getElementById('btn-agg-monthly');
    if (aggDailyBtn && aggMonthlyBtn) {
      aggDailyBtn.addEventListener('click', () => {
        this.activeAggregationMode = 'daily';
        aggDailyBtn.classList.add('active');
        aggMonthlyBtn.classList.remove('active');
        this.renderActiveTabCharts();
      });
      aggMonthlyBtn.addEventListener('click', () => {
        this.activeAggregationMode = 'monthly';
        aggMonthlyBtn.classList.add('active');
        aggDailyBtn.classList.remove('active');
        this.renderActiveTabCharts();
      });
    }

    // Botões de zoom rápido da timeline
    document.querySelectorAll('[data-zoom-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const range = btn.getAttribute('data-zoom-range');
        this.applyTimelineZoom(range);
      });
    });

    // Exportações
    if (this.btnExportCsv) {
      this.btnExportCsv.addEventListener('click', () => this.exportCsv());
    }
    if (this.btnExportReport) {
      this.btnExportReport.addEventListener('click', () => window.print());
    }

    // Janela redimensionada
    window.addEventListener('resize', () => {
      ERedesCharts.resizeAll();
    });
  }

  /**
   * Processa ficheiros carregados pelo utilizador (.xlsx ou .csv)
   */
  async handleFiles(files) {
    const validFiles = files.filter(
      (f) =>
        f.name.endsWith('.xlsx') ||
        f.name.endsWith('.xls') ||
        f.name.endsWith('.csv') ||
        f.type.includes('excel') ||
        f.type.includes('spreadsheet') ||
        f.type.includes('csv')
    );

    if (validFiles.length === 0) {
      alert('Por favor carregue ficheiros Excel (.xlsx) ou CSV de Diagramas de Carga da E-REDES.');
      return;
    }

    this.showLoading(true);

    try {
      const parsedList = [];
      for (const file of validFiles) {
        if (file.name.endsWith('.csv')) {
          const text = await file.text();
          const parsed = ERedesParser.parseCSV(text, file.name);
          parsedList.push(parsed);
        } else {
          const buffer = await file.arrayBuffer();
          const parsed = ERedesParser.parseExcel(buffer, file.name);
          parsedList.push(parsed);
        }
      }

      this.rawDatasets = parsedList;
      this.mergedDataset = ERedesParser.mergeDatasets(parsedList);

      this.updateMonthFilterOptions();
      this.applyFilters();
      this.showToast(`${validFiles.length} ficheiro(s) carregado(s) com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao processar ficheiros: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Carrega ficheiro de exemplo local automaticamente se disponível
   */
  async loadSampleFile() {
    this.showLoading(true);
    try {
      const response = await fetch('./sample/Consumos_PT0002000000000000AA_Exemplo.xlsx');
      if (!response.ok) throw new Error('Ficheiro de exemplo não encontrado.');
      const buffer = await response.arrayBuffer();
      const parsed = ERedesParser.parseExcel(buffer, 'Consumos_PT0002000000000000AA_Exemplo.xlsx');
      this.rawDatasets = [parsed];
      this.mergedDataset = ERedesParser.mergeDatasets([parsed]);
      this.updateMonthFilterOptions();
      this.applyFilters();
      this.showToast('Diagrama de carga de exemplo carregado!');
    } catch (e) {
      console.warn('Não foi possível carregar via fetch (normal se ficheiro for aberto via file://)', e);
      // Se estiver em file://, avisa o utilizador
      this.showToast('Clique no seletor para carregar o seu ficheiro .xlsx da E-REDES.');
    } finally {
      this.showLoading(false);
    }
  }

  async autoLoadSampleIfExists() {
    // Tenta carregar automaticamente ao abrir a app
    try {
      await this.loadSampleFile();
    } catch (e) {
      // Ignora silenciosamente no primeiro carregamento
    }
  }

  /**
   * Atualiza as opções do seletor de meses com base nos dados presentes
   */
  updateMonthFilterOptions() {
    if (!this.filterMonth || !this.mergedDataset) return;

    const monthsSet = new Set();
    for (const rec of this.mergedDataset.records) {
      const key = `${rec.year}-${String(rec.month).padStart(2, '0')}`;
      monthsSet.add(key);
    }

    const sortedMonths = Array.from(monthsSet).sort();
    const currentVal = this.filterMonth.value;

    this.filterMonth.innerHTML = '<option value="all">Todo o Histórico</option>';
    sortedMonths.forEach((m) => {
      const [year, month] = m.split('-');
      const date = new Date(year, month - 1, 1);
      const label = date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = label.charAt(0).toUpperCase() + label.slice(1);
      this.filterMonth.appendChild(opt);
    });

    if (sortedMonths.includes(currentVal)) {
      this.filterMonth.value = currentVal;
    } else {
      this.filterMonth.value = 'all';
    }
  }

  /**
   * Aplica filtros selecionados pelo utilizador (Mês, Dias Úteis / Fim de semana)
   */
  applyFilters() {
    if (!this.mergedDataset) return;

    const selectedMonth = this.filterMonth ? this.filterMonth.value : 'all';
    const selectedDayType = this.filterDayType ? this.filterDayType.value : 'all';

    let filteredRecords = this.mergedDataset.records;

    if (selectedMonth !== 'all') {
      const [yearStr, monthStr] = selectedMonth.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      filteredRecords = filteredRecords.filter((r) => r.year === y && r.month === m);
    }

    if (selectedDayType === 'weekday') {
      filteredRecords = filteredRecords.filter((r) => r.dayOfWeek >= 1 && r.dayOfWeek <= 5);
    } else if (selectedDayType === 'weekend') {
      filteredRecords = filteredRecords.filter((r) => r.dayOfWeek === 0 || r.dayOfWeek === 6);
    }

    const uniqueDays = new Set(filteredRecords.map((r) => r.dateFormatted));

    this.filteredDataset = {
      ...this.mergedDataset,
      records: filteredRecords,
      totalRecords: filteredRecords.length,
      daysCount: uniqueDays.size,
      startDate: filteredRecords.length > 0 ? filteredRecords[0].dateFormatted : '',
      endDate: filteredRecords.length > 0 ? filteredRecords[filteredRecords.length - 1].dateFormatted : '',
    };

    // Executar análise profunda com as regras da ERSE
    this.analysis = ERedesAnalyzer.analyze(this.filteredDataset, this.customPrices);

    this.renderHeaderMetadata();
    this.renderKPICards();
    this.renderInsights();
    this.renderPowerRiskTable();
    this.renderSimulatorTable();
    this.renderActiveTabCharts();
  }

  renderHeaderMetadata() {
    if (!this.filteredDataset) return;
    if (this.metaCpe) this.metaCpe.textContent = this.filteredDataset.cpe;
    if (this.metaPeriod) {
      this.metaPeriod.textContent = `${this.filteredDataset.startDate || '-'} a ${this.filteredDataset.endDate || '-'} (${this.filteredDataset.daysCount} dias)`;
    }
    if (this.metaRecords) {
      this.metaRecords.textContent = `${this.filteredDataset.totalRecords.toLocaleString()} quartos de hora`;
    }
    if (this.metaQuality) {
      const realPct =
        this.mergedDataset.totalRecords > 0
          ? ((this.mergedDataset.realCount / this.mergedDataset.totalRecords) * 100).toFixed(0)
          : 100;
      this.metaQuality.textContent = `${realPct}% Real`;
      this.metaQuality.className = `badge ${realPct > 95 ? 'badge-success' : 'badge-warning'}`;
    }
    if (this.filesBadge) {
      const count = this.mergedDataset.sourceFiles ? this.mergedDataset.sourceFiles.length : 1;
      this.filesBadge.textContent = `${count} ficheiro(s)`;
    }
  }

  renderKPICards() {
    if (!this.analysis) return;

    // Consumo Total
    if (this.kpiKwhMedido) {
      this.kpiKwhMedido.textContent = `${this.analysis.totalKwhMedido.toLocaleString()} kWh`;
    }
    if (this.kpiKwhSub) {
      this.kpiKwhSub.textContent = `Média: ${this.analysis.averageDailyKwh} kWh/dia (~${Math.round(this.analysis.averageMonthlyKwh)} kWh/mês)`;
    }

    // Pico Máximo
    if (this.kpiPeakKw) {
      this.kpiPeakKw.textContent = `${this.analysis.peakPowerKw.toFixed(2)} kW`;
    }
    if (this.kpiPeakSub && this.analysis.peakRecord) {
      this.kpiPeakSub.textContent = `${this.analysis.peakRecord.dateFormatted} às ${this.analysis.peakRecord.timeFormatted}`;
    }

    // Potência Contratada Recomendada
    if (this.kpiRecommendedKva) {
      this.kpiRecommendedKva.textContent = `${this.analysis.recommendedTier.kva} kVA`;
    }
    if (this.kpiRecommendedSub) {
      this.kpiRecommendedSub.textContent = `Escalão seguro (${this.analysis.recommendedTier.amps}A). P99.9: ${this.analysis.p999Power.toFixed(2)} kW`;
    }

    // Repartição Tarifária (% Vazio)
    if (this.kpiTariffVazio) {
      const cycleName = this.analysis.bestBiCycle === 'semanal' ? 'Ciclo Semanal' : 'Ciclo Diário';
      this.kpiTariffVazio.textContent = `${this.analysis.bestBiVazioPct}% em Vazio`;
      if (this.kpiTariffSub) {
        this.kpiTariffSub.textContent = this.analysis.isBiHorarioAdvised
          ? `Bi-Horário (${cycleName}) Recomendado!`
          : 'Tarifa Simples mais segura';
      }
    }

    // Standby / Fantasma
    if (this.kpiStandbyWatts) {
      this.kpiStandbyWatts.textContent = `${this.analysis.standbyWatts} Watts`;
    }
    if (this.kpiStandbySub) {
      this.kpiStandbySub.textContent = `~${this.analysis.standbyMonthlyKwh} kWh/mês (~${this.analysis.standbyAnnualCostEur}€/ano em vigília)`;
    }

    // Autoconsumo / Solar (UPAC)
    if (this.kpiSolarCard) {
      if (this.analysis.hasSolar && this.analysis.totalKwhInjecaoMedida > 0) {
        this.kpiSolarCard.style.display = 'block';
        if (this.kpiSolarKwh) {
          this.kpiSolarKwh.textContent = `${this.analysis.totalKwhInjecaoMedida.toLocaleString()} kWh`;
        }
        if (this.kpiSolarSub) {
          this.kpiSolarSub.textContent = `Autoconsumo: ${this.analysis.totalKwhAutoconsumo} kWh aproveitados`;
        }
      } else {
        this.kpiSolarCard.style.display = 'none';
      }
    }
  }

  renderInsights() {
    if (!this.insightsContainer || !this.analysis) return;
    this.insightsContainer.innerHTML = '';

    const iconMap = {
      power: '⚡',
      tariff: '💰',
      solar: '☀️',
      standby: '🌙',
    };

    this.analysis.insights.forEach((item) => {
      const card = document.createElement('div');
      card.className = `insight-card insight-${item.status || 'info'}`;

      const icon = iconMap[item.type] || '💡';
      card.innerHTML = `
        <div class="insight-header">
          <span class="insight-icon">${icon}</span>
          <span class="insight-title">${item.title}</span>
        </div>
        <div class="insight-summary">${this.formatMarkdown(item.summary)}</div>
        <div class="insight-details">${this.formatMarkdown(item.details)}</div>
      `;

      this.insightsContainer.appendChild(card);
    });
  }

  formatMarkdown(text) {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  renderPowerRiskTable() {
    if (!this.powerTableBody || !this.analysis) return;
    this.powerTableBody.innerHTML = '';

    const tiers = this.analysis.tierRiskAnalysis.slice(0, 10);
    tiers.forEach((tier) => {
      const row = document.createElement('tr');
      const isRecommended = tier.kva === this.analysis.recommendedTier.kva;
      if (isRecommended) row.classList.add('table-row-highlight');

      const statusBadge = tier.isSafe
        ? `<span class="badge badge-success">Seguro (0 excedentes)</span>`
        : `<span class="badge badge-danger">${tier.exceedHours}h excedidas (${tier.exceedPct}%)</span>`;

      row.innerHTML = `
        <td><strong>${tier.kva} kVA</strong> ${isRecommended ? '<span class="badge badge-cyan">Recomendado</span>' : ''}</td>
        <td>${tier.amps} A</td>
        <td>${tier.phase === 'mono' ? 'Monofásico' : 'Trifásico/Mono'}</td>
        <td>${(tier.defaultTermEurDay * 365).toFixed(2)} €/ano</td>
        <td>${tier.exceedCount}</td>
        <td>${statusBadge}</td>
      `;

      this.powerTableBody.appendChild(row);
    });
  }

  renderSimulatorTable() {
    if (!this.simTableBody || !this.analysis) return;
    this.simTableBody.innerHTML = '';

    const sim = this.analysis.costSimulation;
    const items = [
      {
        name: 'Tarifa Simples',
        cost: sim.simples,
        diff: 0,
        status: 'Base de Comparação',
      },
      {
        name: 'Tarifa Bi-Horária (Ciclo Diário)',
        cost: sim.biDiario,
        diff: sim.simples - sim.biDiario,
        annualDiff: sim.annualSavingsBiDiario,
      },
      {
        name: 'Tarifa Bi-Horária (Ciclo Semanal)',
        cost: sim.biSemanal,
        diff: sim.simples - sim.biSemanal,
        annualDiff: sim.annualSavingsBiSemanal,
      },
      {
        name: 'Tarifa Tri-Horária',
        cost: sim.trihorario,
        diff: sim.simples - sim.trihorario,
        annualDiff: Math.round((sim.simples - sim.trihorario) * (365 / (this.analysis.daysCount || 1))),
      },
    ];

    items.forEach((item) => {
      const row = document.createElement('tr');
      const isWinner = item.cost === Math.min(...items.map((i) => i.cost));
      if (isWinner) row.classList.add('table-row-highlight');

      let savingLabel = '-';
      if (item.name !== 'Tarifa Simples') {
        if (item.annualDiff > 0) {
          savingLabel = `<span class="text-success font-bold">+${item.annualDiff} €/ano poupados</span>`;
        } else if (item.annualDiff < 0) {
          savingLabel = `<span class="text-danger font-bold">${item.annualDiff} €/ano de prejuízo</span>`;
        } else {
          savingLabel = `<span class="text-muted">Equivalente</span>`;
        }
      }

      row.innerHTML = `
        <td><strong>${item.name}</strong> ${isWinner ? '<span class="badge badge-success">Mais Económica</span>' : ''}</td>
        <td>${item.cost.toFixed(2)} €</td>
        <td>${savingLabel}</td>
      `;

      this.simTableBody.appendChild(row);
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-content').forEach((panel) => {
      panel.classList.toggle('active', panel.id === tabId);
    });

    // Renderizar os gráficos da aba visível e forçar resize
    setTimeout(() => {
      this.renderActiveTabCharts();
      ERedesCharts.resizeAll();
    }, 50);
  }

  renderActiveTabCharts() {
    if (!this.analysis || !this.filteredDataset) return;

    if (this.activeTab === 'tab-timeline') {
      ERedesCharts.renderTimelineChart('chart-timeline', this.filteredDataset, this.analysis);
    } else if (this.activeTab === 'tab-profile') {
      ERedesCharts.renderProfile24hChart('chart-profile24h', this.analysis.profile24h);
      ERedesCharts.renderHeatmap('chart-heatmap', this.filteredDataset);
    } else if (this.activeTab === 'tab-evolution') {
      ERedesCharts.renderAggregationChart('chart-evolution', this.analysis, this.activeAggregationMode);
    } else if (this.activeTab === 'tab-power') {
      ERedesCharts.renderLoadDurationCurve('chart-ldc', this.analysis);
    } else if (this.activeTab === 'tab-tariffs') {
      ERedesCharts.renderTariffDonut('chart-tariff-donut', this.analysis, this.analysis.bestBiCycle === 'semanal' ? 'bihorario_semanal' : 'bihorario_diario');
    }
  }

  applyTimelineZoom(range) {
    const chart = ERedesCharts.instances['chart-timeline'];
    if (!chart || !this.filteredDataset) return;

    const total = this.filteredDataset.records.length;
    let count = total;

    if (range === '24h') count = 96;
    else if (range === '7d') count = 96 * 7;
    else if (range === '30d') count = 96 * 30;
    else if (range === 'all') count = total;

    const pct = Math.min(100, Math.max(1, (count / total) * 100));

    chart.dispatchAction({
      type: 'dataZoom',
      start: 0,
      end: pct,
    });
  }

  exportCsv() {
    if (!this.analysis) return;
    const rows = [
      ['Data', 'Consumo_Rede_kWh', 'Injecao_Solar_kWh', 'Pico_Potencia_kW'],
      ...this.analysis.dailyList.map((d) => [
        d.date,
        d.totalKwh.toFixed(3),
        d.injecaoKwh.toFixed(3),
        d.peakKw.toFixed(3),
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `analise_e_redes_${this.analysis.cpe}_diario.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  showLoading(show) {
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3500);
  }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ERedesApp();
});
