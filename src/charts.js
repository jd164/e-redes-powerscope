/**
 * Módulo de Visualizações Gráficas Interativas com Apache ECharts
 * Otimizado para alto desempenho com dezenas de milhares de pontos temporais.
 */

export const ERedesCharts = {
  instances: {},

  // Cores do Design System Dark Moderno
  themeColors: {
    bg: 'transparent',
    text: '#94a3b8',
    textHeading: '#f8fafc',
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#06b6d4',      // Ciano Elétrico
    primaryGlow: 'rgba(6, 182, 212, 0.25)',
    secondary: '#3b82f6',    // Azul Real
    accent: '#8b5cf6',       // Roxo Violeta
    solar: '#f59e0b',        // Âmbar / Dourado Solar
    solarGlow: 'rgba(245, 158, 11, 0.2)',
    success: '#10b981',      // Esmeralda / Vazio
    warning: '#f97316',      // Laranja / Cheias
    danger: '#ef4444',       // Vermelho / Ponta
  },

  /**
   * Inicializa ou reaproveita instância do ECharts num container
   */
  getOrCreateChart(domId) {
    const el = document.getElementById(domId);
    if (!el) return null;
    if (this.instances[domId]) {
      this.instances[domId].dispose();
    }
    const chart = window.echarts.init(el, 'dark', { renderer: 'canvas' });
    this.instances[domId] = chart;
    return chart;
  },

  /**
   * Redimensiona todos os gráficos ativos
   */
  resizeAll() {
    Object.values(this.instances).forEach((chart) => {
      if (chart && !chart.isDisposed()) {
        chart.resize();
      }
    });
  },

  /**
   * 1. Gráfico de Carga Contínua a 15 Minutos (Timeline com DataZoom e Picos)
   */
  renderTimelineChart(domId, dataset, analysis) {
    const chart = this.getOrCreateChart(domId);
    if (!chart || !dataset || !dataset.records.length) return;

    const times = [];
    const consumoMedido = [];
    const injecaoMedida = [];
    const consumoRegistado = [];

    for (const rec of dataset.records) {
      times.push(`${rec.dateFormatted} ${rec.timeFormatted}`);
      consumoMedido.push(rec.consumoMedidoKw);
      injecaoMedida.push(rec.injecaoMedidaKw);
      if (dataset.hasSolar) {
        consumoRegistado.push(rec.consumoRegistadoKw);
      }
    }

    const series = [
      {
        name: 'Consumo Líquido (kW)',
        type: 'line',
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 2, color: this.themeColors.primary },
        areaStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(6, 182, 212, 0.35)' },
            { offset: 1, color: 'rgba(6, 182, 212, 0.01)' },
          ]),
        },
        data: consumoMedido,
        markPoint: {
          data: [
            {
              type: 'max',
              name: 'Pico Máximo',
              itemStyle: { color: this.themeColors.danger },
              label: {
                formatter: (p) => `${p.value.toFixed(2)} kW`,
                color: '#ffffff',
                fontWeight: 'bold',
              },
            },
          ],
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: analysis.recommendedTier.kva,
              name: `Recomendado (${analysis.recommendedTier.kva} kVA)`,
              lineStyle: { color: this.themeColors.success, type: 'dashed', width: 2 },
              label: {
                formatter: `Escalão Recomendado: ${analysis.recommendedTier.kva} kVA`,
                position: 'end',
                color: this.themeColors.success,
              },
            },
          ],
        },
      },
    ];

    if (dataset.hasSolar && analysis.totalKwhInjecaoMedida > 0) {
      series.push({
        name: 'Injeção Solar (kW)',
        type: 'line',
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 1.5, color: this.themeColors.solar },
        areaStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245, 158, 11, 0.3)' },
            { offset: 1, color: 'rgba(245, 158, 11, 0.01)' },
          ]),
        },
        data: injecaoMedida,
      });
    }

    if (dataset.hasSolar) {
      series.push({
        name: 'Consumo Bruto (kW)',
        type: 'line',
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 1, color: this.themeColors.accent, type: 'dotted' },
        data: consumoRegistado,
      });
    }

    const option = {
      backgroundColor: this.themeColors.bg,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#1e293b' } },
        formatter: (params) => {
          let html = `<div style="font-weight:600;margin-bottom:4px;color:#f8fafc;">${params[0].axisValue}</div>`;
          params.forEach((item) => {
            const valKw = item.value !== undefined ? Number(item.value).toFixed(3) : 0;
            const valKwh = (valKw * 0.25).toFixed(3);
            html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;">
              <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px;"></span>${item.seriesName}:</span>
              <span style="font-weight:600;color:#f8fafc;">${valKw} kW <span style="font-size:11px;color:#94a3b8;">(${valKwh} kWh)</span></span>
            </div>`;
          });
          return html;
        },
      },
      legend: {
        data: series.map((s) => s.name),
        textStyle: { color: this.themeColors.text },
        top: 0,
      },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: times,
        axisLine: { lineStyle: { color: this.themeColors.border } },
        axisLabel: { color: this.themeColors.text, hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        name: 'Potência (kW)',
        nameTextStyle: { color: this.themeColors.text },
        axisLine: { lineStyle: { color: this.themeColors.border } },
        splitLine: { lineStyle: { color: this.themeColors.border } },
        axisLabel: { color: this.themeColors.text },
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: Math.min(100, (96 * 7 * 100) / dataset.records.length || 100), // Foco inicial nos primeiros 7 dias
        },
        {
          type: 'slider',
          bottom: 10,
          borderColor: this.themeColors.border,
          fillerColor: 'rgba(6, 182, 212, 0.2)',
          handleStyle: { color: this.themeColors.primary },
          textStyle: { color: this.themeColors.text },
          start: 0,
          end: Math.min(100, (96 * 7 * 100) / dataset.records.length || 100),
        },
      ],
      series,
    };

    chart.setOption(option);
  },

  /**
   * 2. Gráfico de Perfil Médio 24 Horas (Dias Úteis vs Fins de Semana + Solar)
   */
  renderProfile24hChart(domId, profileData) {
    const chart = this.getOrCreateChart(domId);
    if (!chart || !profileData || !profileData.length) return;

    const times = profileData.map((p) => p.timeLabel);
    const weekday = profileData.map((p) => p.weekdayKw);
    const weekend = profileData.map((p) => p.weekendKw);
    const solar = profileData.map((p) => p.solarInjecaoKw);

    const option = {
      backgroundColor: this.themeColors.bg,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter: (params) => {
          let html = `<div style="font-weight:600;margin-bottom:4px;color:#f8fafc;">Hora: ${params[0].axisValue}</div>`;
          params.forEach((item) => {
            html += `<div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0;">
              <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color};margin-right:6px;"></span>${item.seriesName}:</span>
              <span style="font-weight:bold;color:#f8fafc;">${item.value} kW</span>
            </div>`;
          });
          return html;
        },
      },
      legend: {
        data: ['Dias Úteis (Seg-Sex)', 'Fim de Semana (Sáb-Dom)', 'Excedente Solar Médio'],
        textStyle: { color: this.themeColors.text },
        top: 0,
      },
      grid: { left: '3%', right: '3%', bottom: '5%', top: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: times,
        axisLine: { lineStyle: { color: this.themeColors.border } },
        axisLabel: {
          color: this.themeColors.text,
          interval: 7, // mostra etiquetas a cada 2 horas
        },
      },
      yAxis: {
        type: 'value',
        name: 'Média (kW)',
        nameTextStyle: { color: this.themeColors.text },
        splitLine: { lineStyle: { color: this.themeColors.border } },
        axisLabel: { color: this.themeColors.text },
      },
      series: [
        {
          name: 'Dias Úteis (Seg-Sex)',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: this.themeColors.primary },
          data: weekday,
        },
        {
          name: 'Fim de Semana (Sáb-Dom)',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2.5, color: this.themeColors.secondary },
          data: weekend,
        },
        {
          name: 'Excedente Solar Médio',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: this.themeColors.solar },
          areaStyle: {
            color: 'rgba(245, 158, 11, 0.15)',
          },
          data: solar,
        },
      ],
    };

    chart.setOption(option);
  },

  /**
   * 3. Heatmap de Intensidade (24 Horas x Dias)
   */
  renderHeatmap(domId, dataset) {
    const chart = this.getOrCreateChart(domId);
    if (!chart || !dataset || !dataset.records.length) return;

    // Obter dias únicos
    const days = Array.from(new Set(dataset.records.map((r) => r.dateFormatted))).sort();
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    // Criar mapa para cálculo da média horária em cada dia
    const matrix = {};
    let maxKw = 0;

    for (const rec of dataset.records) {
      const dayIdx = days.indexOf(rec.dateFormatted);
      if (dayIdx === -1) continue;
      const hour = rec.hour;
      const key = `${dayIdx}-${hour}`;
      if (!matrix[key]) matrix[key] = { sum: 0, count: 0 };
      matrix[key].sum += rec.consumoMedidoKw;
      matrix[key].count++;
    }

    const dataPoints = [];
    for (let d = 0; d < days.length; d++) {
      for (let h = 0; h < 24; h++) {
        const item = matrix[`${d}-${h}`];
        const val = item && item.count > 0 ? Number((item.sum / item.count).toFixed(2)) : 0;
        if (val > maxKw) maxKw = val;
        dataPoints.push([d, h, val]);
      }
    }

    const option = {
      backgroundColor: this.themeColors.bg,
      tooltip: {
        position: 'top',
        formatter: (p) => {
          const dName = days[p.data[0]];
          const hName = hours[p.data[1]];
          return `<div style="font-weight:600;margin-bottom:2px;color:#f8fafc;">${dName} às ${hName}</div>
                  <div style="color:#f8fafc;">Consumo Médio: <b>${p.data[2]} kW</b></div>`;
        },
      },
      grid: { left: '3%', right: '5%', bottom: '15%', top: '5%', containLabel: true },
      xAxis: {
        type: 'category',
        data: days,
        splitArea: { show: true },
        axisLabel: {
          color: this.themeColors.text,
          interval: Math.max(1, Math.floor(days.length / 12)),
          rotate: 30,
        },
      },
      yAxis: {
        type: 'category',
        data: hours,
        splitArea: { show: true },
        axisLabel: { color: this.themeColors.text },
      },
      visualMap: {
        min: 0,
        max: Math.max(3, Math.ceil(maxKw)),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: ['#0f172a', '#1e3a8a', '#06b6d4', '#eab308', '#ef4444'],
        },
        textStyle: { color: this.themeColors.text },
      },
      series: [
        {
          name: 'Consumo Médio Horário',
          type: 'heatmap',
          data: dataPoints,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
              borderColor: '#ffffff',
              borderWidth: 1,
            },
          },
        },
      ],
    };

    chart.setOption(option);
  },

  /**
   * 4. Gráfico de Evolução Diária / Mensal (Consumo, Injeção e Pico)
   */
  renderAggregationChart(domId, analysis, mode = 'daily') {
    const chart = this.getOrCreateChart(domId);
    if (!chart) return;

    const list = mode === 'monthly' ? analysis.monthlyList : analysis.dailyList;
    if (!list || !list.length) return;

    const categories = list.map((item) => (mode === 'monthly' ? item.monthKey : item.date));
    const consumoKwh = list.map((item) => Number(item.totalKwh.toFixed(1)));
    const injecaoKwh = list.map((item) => Number(item.injecaoKwh.toFixed(1)));
    const peakKw = list.map((item) => Number(item.peakKw.toFixed(2)));

    const option = {
      backgroundColor: this.themeColors.bg,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      legend: {
        data: ['Consumo da Rede (kWh)', 'Injeção Solar (kWh)', 'Pico de Potência (kW)'],
        textStyle: { color: this.themeColors.text },
        top: 0,
      },
      grid: { left: '3%', right: '4%', bottom: '10%', top: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { lineStyle: { color: this.themeColors.border } },
        axisLabel: {
          color: this.themeColors.text,
          rotate: mode === 'daily' && categories.length > 20 ? 45 : 0,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Energia (kWh)',
          nameTextStyle: { color: this.themeColors.text },
          splitLine: { lineStyle: { color: this.themeColors.border } },
          axisLabel: { color: this.themeColors.text },
        },
        {
          type: 'value',
          name: 'Pico (kW)',
          nameTextStyle: { color: this.themeColors.text },
          splitLine: { show: false },
          axisLabel: { color: this.themeColors.text },
        },
      ],
      series: [
        {
          name: 'Consumo da Rede (kWh)',
          type: 'bar',
          itemStyle: { color: this.themeColors.primary, borderRadius: [4, 4, 0, 0] },
          data: consumoKwh,
        },
        {
          name: 'Injeção Solar (kWh)',
          type: 'bar',
          itemStyle: { color: this.themeColors.solar, borderRadius: [4, 4, 0, 0] },
          data: injecaoKwh,
        },
        {
          name: 'Pico de Potência (kW)',
          type: 'line',
          yAxisIndex: 1,
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { width: 2, color: this.themeColors.danger },
          itemStyle: { color: this.themeColors.danger },
          data: peakKw,
        },
      ],
    };

    chart.setOption(option);
  },

  /**
   * 5. Gráfico Donut de Repartição Tarifária
   */
  renderTariffDonut(domId, analysis, tariffMode = 'bihorario_semanal') {
    const chart = this.getOrCreateChart(domId);
    if (!chart) return;

    let data = [];
    if (tariffMode === 'bihorario_diario') {
      const counts = analysis.tariffCounts.bihorario_diario;
      data = [
        { value: counts.vazio, name: 'Horas de Vazio', itemStyle: { color: this.themeColors.success } },
        { value: counts.fora_vazio, name: 'Horas Fora de Vazio', itemStyle: { color: this.themeColors.warning } },
      ];
    } else if (tariffMode === 'bihorario_semanal') {
      const counts = analysis.tariffCounts.bihorario_semanal;
      data = [
        { value: counts.vazio, name: 'Horas de Vazio', itemStyle: { color: this.themeColors.success } },
        { value: counts.fora_vazio, name: 'Horas Fora de Vazio', itemStyle: { color: this.themeColors.warning } },
      ];
    } else if (tariffMode === 'trihorario') {
      const counts = analysis.tariffCounts.trihorario;
      data = [
        { value: counts.vazio, name: 'Horas de Vazio', itemStyle: { color: this.themeColors.success } },
        { value: counts.cheias, name: 'Horas de Cheias', itemStyle: { color: this.themeColors.warning } },
        { value: counts.ponta, name: 'Horas de Ponta', itemStyle: { color: this.themeColors.danger } },
      ];
    }

    const option = {
      backgroundColor: this.themeColors.bg,
      tooltip: {
        trigger: 'item',
        formatter: '{b}: <b>{c} kWh</b> ({d}%)',
      },
      legend: {
        bottom: '0%',
        left: 'center',
        textStyle: { color: this.themeColors.text },
      },
      series: [
        {
          name: 'Período Tarifário',
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#0f172a',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            color: '#f8fafc',
          },
          data,
        },
      ],
    };

    chart.setOption(option);
  },

  /**
   * 6. Curva Monótona de Carga (Load Duration Curve)
   */
  renderLoadDurationCurve(domId, analysis) {
    const chart = this.getOrCreateChart(domId);
    if (!chart || !analysis.loadDurationCurve) return;

    const data = analysis.loadDurationCurve.map((item) => [item.pctTime, item.powerKw]);

    const markLines = [
      { yAxis: 3.45, name: '3.45 kVA', lineStyle: { color: '#64748b', type: 'dashed' } },
      { yAxis: 6.90, name: '6.90 kVA', lineStyle: { color: '#0284c7', type: 'dashed' } },
      { yAxis: 10.35, name: '10.35 kVA', lineStyle: { color: '#d97706', type: 'dashed' } },
      {
        yAxis: analysis.recommendedTier.kva,
        name: `Recomendado (${analysis.recommendedTier.kva} kVA)`,
        lineStyle: { color: this.themeColors.success, width: 2 },
      },
    ];

    const option = {
      backgroundColor: this.themeColors.bg,
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const p = params[0];
          return `<div style="font-weight:600;color:#f8fafc;">Duração: ${p.data[0]}% do tempo</div>
                  <div style="color:#f8fafc;">Potência: <b>${p.data[1]} kW</b></div>`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
      xAxis: {
        type: 'value',
        name: '% do Tempo',
        min: 0,
        max: 100,
        axisLine: { lineStyle: { color: this.themeColors.border } },
        axisLabel: { color: this.themeColors.text, formatter: '{value}%' },
      },
      yAxis: {
        type: 'value',
        name: 'Potência (kW)',
        axisLine: { lineStyle: { color: this.themeColors.border } },
        splitLine: { lineStyle: { color: this.themeColors.border } },
        axisLabel: { color: this.themeColors.text },
      },
      series: [
        {
          name: 'Curva Monótona',
          type: 'line',
          showSymbol: false,
          lineStyle: { width: 2, color: this.themeColors.primary },
          areaStyle: {
            color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(6, 182, 212, 0.3)' },
              { offset: 1, color: 'rgba(6, 182, 212, 0.01)' },
            ]),
          },
          data,
          markLine: {
            silent: true,
            symbol: 'none',
            data: markLines,
          },
        },
      ],
    };

    chart.setOption(option);
  },
};
