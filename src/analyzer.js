/**
 * Módulo de Análise e Diagnóstico de Diagramas de Carga da E-REDES
 * Transforma registos de 15 minutos em inteligência de gestão de energia.
 */

import { ERSERules } from './erseRules.js';

export const ERedesAnalyzer = {
  /**
   * Executa a análise completa de um conjunto unificado de registos
   */
  analyze(dataset, customPrices = null) {
    if (!dataset || !dataset.records || dataset.records.length === 0) {
      return null;
    }

    const records = dataset.records;
    const prices = customPrices || ERSERules.DEFAULT_PRICES;

    // 1. Métricas Globais de Energia
    let totalKwhMedido = 0;
    let totalKwhRegistado = 0;
    let totalKwhInjecaoMedida = 0;
    let totalKwhInjecaoRegistada = 0;
    let totalKwhAutoconsumo = 0;

    let peakPowerKw = 0;
    let peakRecord = null;
    const powerValues = [];

    // Contadores para análise tarifária
    const tariffCounts = {
      bihorario_diario: { vazio: 0, fora_vazio: 0 },
      bihorario_semanal: { vazio: 0, fora_vazio: 0 },
      trihorario: { vazio: 0, cheias: 0, ponta: 0 },
    };

    // Coleções para standby (madrugada 02:00 às 05:00)
    const standbyPowers = [];

    // Coleções para perfil 24 horas (96 slots de 15 minutos)
    // 0: 00:15, 1: 00:30, ..., 95: 00:00 (ou 24:00)
    const profileSlots = Array.from({ length: 96 }, (_, i) => {
      const h = Math.floor(i / 4);
      const m = ((i % 4) + 1) * 15;
      const hourStr = String(m === 60 ? h + 1 : h).padStart(2, '0');
      const minStr = String(m === 60 ? 0 : m).padStart(2, '0');
      return {
        slotIndex: i,
        timeLabel: `${hourStr}:${minStr}`,
        weekdaySum: 0,
        weekdayCount: 0,
        weekendSum: 0,
        weekendCount: 0,
        allSum: 0,
        allCount: 0,
        solarInjecaoSum: 0,
      };
    });

    // Agrupamento diário e mensal
    const dailyMap = new Map();
    const monthlyMap = new Map();

    for (const rec of records) {
      const kw = rec.consumoMedidoKw;
      const kwh = rec.kwhConsumoMedido;
      const dateObj = new Date(rec.timestamp);

      totalKwhMedido += kwh;
      totalKwhRegistado += rec.kwhConsumoRegistado;
      totalKwhInjecaoMedida += rec.kwhInjecaoMedida;
      totalKwhInjecaoRegistada += rec.kwhInjecaoRegistada;
      totalKwhAutoconsumo += rec.kwhAutoconsumo;

      powerValues.push(kw);

      if (kw > peakPowerKw) {
        peakPowerKw = kw;
        peakRecord = rec;
      }

      // Períodos Tarifários ERSE
      const periodBiDiario = ERSERules.getPeriod(dateObj, 'bihorario', 'diario');
      tariffCounts.bihorario_diario[periodBiDiario] += kwh;

      const periodBiSemanal = ERSERules.getPeriod(dateObj, 'bihorario', 'semanal');
      tariffCounts.bihorario_semanal[periodBiSemanal] += kwh;

      const periodTri = ERSERules.getPeriod(dateObj, 'trihorario', 'diario');
      tariffCounts.trihorario[periodTri] += kwh;

      // Standby (madrugada: 02h00 às 05h00)
      if (rec.hour >= 2 && rec.hour < 5) {
        standbyPowers.push(kw);
      }

      // Slot 24h
      let slotIdx = rec.hour * 4 + Math.floor(rec.minute / 15) - 1;
      if (slotIdx < 0) slotIdx = 95; // 00:00 do dia seguinte é o fecho do 96º quarto
      if (slotIdx >= 0 && slotIdx < 96) {
        const slot = profileSlots[slotIdx];
        const isWeekend = rec.dayOfWeek === 0 || rec.dayOfWeek === 6;
        if (isWeekend) {
          slot.weekendSum += kw;
          slot.weekendCount++;
        } else {
          slot.weekdaySum += kw;
          slot.weekdayCount++;
        }
        slot.allSum += kw;
        slot.allCount++;
        slot.solarInjecaoSum += rec.injecaoMedidaKw;
      }

      // Agrupamento Diário
      const dayKey = rec.dateFormatted;
      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, {
          date: dayKey,
          dayOfWeek: rec.dayOfWeek,
          totalKwh: 0,
          peakKw: 0,
          injecaoKwh: 0,
          autoconsumoKwh: 0,
          vazioKwh: 0,
          quartersCount: 0,
        });
      }
      const dayData = dailyMap.get(dayKey);
      dayData.totalKwh += kwh;
      dayData.injecaoKwh += rec.kwhInjecaoMedida;
      dayData.autoconsumoKwh += rec.kwhAutoconsumo;
      if (kw > dayData.peakKw) dayData.peakKw = kw;
      if (periodBiDiario === 'vazio') dayData.vazioKwh += kwh;
      dayData.quartersCount++;

      // Agrupamento Mensal
      const monthKey = `${rec.year}-${String(rec.month).padStart(2, '0')}`;
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          monthKey,
          year: rec.year,
          month: rec.month,
          totalKwh: 0,
          peakKw: 0,
          injecaoKwh: 0,
          autoconsumoKwh: 0,
          quartersCount: 0,
          daysSet: new Set(),
        });
      }
      const monthData = monthlyMap.get(monthKey);
      monthData.totalKwh += kwh;
      monthData.injecaoKwh += rec.kwhInjecaoMedida;
      monthData.autoconsumoKwh += rec.kwhAutoconsumo;
      if (kw > monthData.peakKw) monthData.peakKw = kw;
      monthData.quartersCount++;
      monthData.daysSet.add(dayKey);
    }

    // Ordenar valores de potência para percentis e curva monótona
    powerValues.sort((a, b) => a - b);
    const totalPoints = powerValues.length;
    const p50Power = powerValues[Math.floor(totalPoints * 0.5)] || 0;
    const p90Power = powerValues[Math.floor(totalPoints * 0.9)] || 0;
    const p95Power = powerValues[Math.floor(totalPoints * 0.95)] || 0;
    const p99Power = powerValues[Math.floor(totalPoints * 0.99)] || 0;
    const p999Power = powerValues[Math.floor(totalPoints * 0.999)] || 0;
    const averagePowerKw = totalPoints > 0 ? (totalKwhMedido * 4) / totalPoints : 0;

    // 2. Análise de Potência Contratada Recomendada (kVA)
    const powerTiers = ERSERules.POWER_TIERS_KVA;
    // O disjuntor / limitador pode disparar se a potência exceder o contratado
    // Em Portugal, o recomendado seguro é o escalão imediatamente acima do pico real
    let recommendedTier = powerTiers.find((t) => t.kva >= peakPowerKw) || powerTiers[powerTiers.length - 1];
    // Se o pico máximo for apenas 1 ou 2 quartos de hora isolados no ano todo, avalia o p99.9
    let tightTier = powerTiers.find((t) => t.kva >= p999Power) || recommendedTier;

    // Calcular risco para cada escalão
    const tierRiskAnalysis = powerTiers.map((tier) => {
      const exceedCount = powerValues.filter((v) => v > tier.kva).length;
      const exceedHours = exceedCount * 0.25;
      const exceedPct = totalPoints > 0 ? (exceedCount / totalPoints) * 100 : 0;
      return {
        ...tier,
        exceedCount,
        exceedHours,
        exceedPct: Number(exceedPct.toFixed(3)),
        isSafe: exceedCount === 0,
      };
    });

    // 3. Consumo Standby / Fantasma (Baseload)
    standbyPowers.sort((a, b) => a - b);
    const standbyCount = standbyPowers.length;
    const standbyMinKw = standbyCount > 0 ? standbyPowers[0] : 0;
    const standbyMedianKw = standbyCount > 0 ? standbyPowers[Math.floor(standbyCount * 0.5)] : 0;
    const standbyWatts = Math.round(standbyMedianKw * 1000);
    // Projeções
    const standbyMonthlyKwh = (standbyWatts / 1000) * 24 * 30.41;
    const standbyAnnualKwh = (standbyWatts / 1000) * 8760;
    const standbyAnnualCostEur = standbyAnnualKwh * (prices.simples.kwh || 0.165);

    // 4. Análise de Tarifários ERSE
    const biDiarioVazioPct = totalKwhMedido > 0 ? (tariffCounts.bihorario_diario.vazio / totalKwhMedido) * 100 : 0;
    const biSemanalVazioPct = totalKwhMedido > 0 ? (tariffCounts.bihorario_semanal.vazio / totalKwhMedido) * 100 : 0;

    // Decisão da regra de ouro portuguesa: compensa Bi-horário se Vazio > 35%
    const isBiHorarioAdvised = Math.max(biDiarioVazioPct, biSemanalVazioPct) >= 35.0;
    const bestBiCycle = biSemanalVazioPct > biDiarioVazioPct ? 'semanal' : 'diario';
    const bestBiVazioPct = Math.max(biDiarioVazioPct, biSemanalVazioPct);

    // 5. Simulação de Custos de Fatura (€)
    const daysCount = dataset.daysCount || 1;
    const defaultPowerTier = recommendedTier;
    const powerTermDailyEur = defaultPowerTier.defaultTermEurDay;
    const totalPowerTermCost = powerTermDailyEur * daysCount;

    // Custo na Tarifa Simples
    const costSimplesEnergy = totalKwhMedido * prices.simples.kwh;
    const totalSimples = costSimplesEnergy + totalPowerTermCost;

    // Custo no Bi-Horário Ciclo Diário
    const costBiDiarioEnergy =
      tariffCounts.bihorario_diario.vazio * prices.bihorario_diario.vazio +
      tariffCounts.bihorario_diario.fora_vazio * prices.bihorario_diario.fora_vazio;
    const totalBiDiario = costBiDiarioEnergy + totalPowerTermCost;

    // Custo no Bi-Horário Ciclo Semanal
    const costBiSemanalEnergy =
      tariffCounts.bihorario_semanal.vazio * prices.bihorario_semanal.vazio +
      tariffCounts.bihorario_semanal.fora_vazio * prices.bihorario_semanal.fora_vazio;
    const totalBiSemanal = costBiSemanalEnergy + totalPowerTermCost;

    // Custo no Tri-Horário
    const costTriEnergy =
      tariffCounts.trihorario.vazio * prices.trihorario.vazio +
      tariffCounts.trihorario.cheias * prices.trihorario.cheias +
      tariffCounts.trihorario.ponta * prices.trihorario.ponta;
    const totalTri = costTriEnergy + totalPowerTermCost;

    // Poupanças anuais projetadas face à tarifa simples
    const factorToYear = daysCount > 0 ? 365 / daysCount : 1;
    const annualSavingsBiDiario = (totalSimples - totalBiDiario) * factorToYear;
    const annualSavingsBiSemanal = (totalSimples - totalBiSemanal) * factorToYear;

    // 6. Perfil 24 Horas Calculado (Médias em kW)
    const profile24h = profileSlots.map((slot) => ({
      timeLabel: slot.timeLabel,
      weekdayKw: slot.weekdayCount > 0 ? Number((slot.weekdaySum / slot.weekdayCount).toFixed(3)) : 0,
      weekendKw: slot.weekendCount > 0 ? Number((slot.weekendSum / slot.weekendCount).toFixed(3)) : 0,
      allKw: slot.allCount > 0 ? Number((slot.allSum / slot.allCount).toFixed(3)) : 0,
      solarInjecaoKw: slot.allCount > 0 ? Number((slot.solarInjecaoSum / slot.allCount).toFixed(3)) : 0,
    }));

    // 7. Curva Monótona de Carga (Load Duration Curve)
    // Amostrada para até 300 pontos para alta performance de renderização
    const sortedDescending = [...powerValues].reverse();
    const ldcSampleCount = Math.min(300, sortedDescending.length);
    const ldcStep = Math.max(1, Math.floor(sortedDescending.length / ldcSampleCount));
    const loadDurationCurve = [];
    for (let i = 0; i < sortedDescending.length; i += ldcStep) {
      const hoursExceeded = Number((i * 0.25).toFixed(1));
      const pctTime = Number(((i / sortedDescending.length) * 100).toFixed(1));
      loadDurationCurve.push({
        powerKw: sortedDescending[i],
        hoursExceeded,
        pctTime,
      });
    }

    // 8. Diagnósticos em Linguagem Clara
    const insights = [];

    // Diagnóstico Potência
    if (peakPowerKw > 0) {
      insights.push({
        type: 'power',
        title: 'Potência Contratada Recomendada',
        status: 'info',
        summary: `O seu pico máximo registado foi de **${peakPowerKw.toFixed(2)} kW** em ${peakRecord ? `${peakRecord.dateFormatted} às ${peakRecord.timeFormatted}` : 'data não indicada'}.`,
        details: `Recomendamos contratar um escalão de pelo menos **${recommendedTier.kva} kVA** (${recommendedTier.amps}A). Se tiver atualmente 10.35 kVA ou superior, poderá reduzir para ${recommendedTier.kva} kVA e poupar cerca de **${Math.round((0.46 - recommendedTier.defaultTermEurDay) * 365)}€ por ano** no termo fixo de potência com toda a segurança.`,
      });
    }

    // Diagnóstico Tarifário
    if (isBiHorarioAdvised) {
      const savingsVal = Math.max(annualSavingsBiDiario, annualSavingsBiSemanal);
      const chosenCycle = bestBiCycle === 'semanal' ? 'Bi-Horário Ciclo Semanal' : 'Bi-Horário Ciclo Diário';
      insights.push({
        type: 'tariff',
        title: 'Tarifário Bi-Horário Recomendado!',
        status: 'success',
        summary: `Consome **${bestBiVazioPct.toFixed(1)}%** da sua eletricidade durante as horas de vazio (acima do patamar de rentabilidade de 35%).`,
        details: `A opção mais vantajosa para o seu perfil é a **${chosenCycle}**, proporcionando uma poupança estimada de cerca de **${Math.round(savingsVal)}€ por ano** comparativamente à Tarifa Simples.`,
      });
    } else {
      insights.push({
        type: 'tariff',
        title: 'Tarifa Simples é a mais Segura',
        status: 'neutral',
        summary: `O seu consumo em horas de vazio é de **${bestBiVazioPct.toFixed(1)}%** (abaixo dos 35% onde o Bi-Horário começa a compensar).`,
        details: `Para o seu padrão de utilização atual, a Tarifa Simples evita pagar o custo agravado das horas de fora de vazio. Se conseguir desviar consumos pesados (máquinas de lavar, carregamento de VE) para a noite ou fins de semana, o Bi-Horário poderá passar a ser vantajoso.`,
      });
    }

    // Diagnóstico Solar / UPAC
    if (dataset.hasSolar && totalKwhInjecaoMedida > 0) {
      const totalSolarGen = totalKwhAutoconsumo + totalKwhInjecaoMedida;
      const selfConsumptionPct = totalSolarGen > 0 ? (totalKwhAutoconsumo / totalSolarGen) * 100 : 0;
      insights.push({
        type: 'solar',
        title: 'Autoconsumo Solar e Injeção Detetados (UPAC)',
        status: 'solar',
        summary: `Injetou **${totalKwhInjecaoMedida.toFixed(1)} kWh** de excedente solar na rede e aproveitou diretamente **${totalKwhAutoconsumo.toFixed(1)} kWh** em autoconsumo instantâneo.`,
        details: `A sua taxa de aproveitamento direto é de **${selfConsumptionPct.toFixed(1)}%**. Considerar o desfasamento de consumos (termoacumulador, lavagens) para as 11h-16h ou instalação de bateria poderá aumentar a sua poupança e evitar a perda de excedentes injetados a preços baixos ou sem remuneração.`,
      });
    }

    // Diagnóstico Standby
    if (standbyWatts > 0) {
      insights.push({
        type: 'standby',
        title: 'Consumo Fantasma / Standby Médio',
        status: 'warning',
        summary: `A sua instalação mantém uma carga contínua de cerca de **${standbyWatts} Watts** durante a madrugada (02h00 às 05h00).`,
        details: `Este consumo passivo constante representa cerca de **${Math.round(standbyMonthlyKwh)} kWh/mês** e um encargo de aproximadamente **${Math.round(standbyAnnualCostEur)}€ por ano** só para alimentar equipamentos em standby, frigorífico, routers e dispositivos ligados.`,
      });
    }

    return {
      cpe: dataset.cpe,
      daysCount,
      startDate: dataset.startDate,
      endDate: dataset.endDate,
      totalRecords: records.length,
      totalKwhMedido: Number(totalKwhMedido.toFixed(2)),
      totalKwhRegistado: Number(totalKwhRegistado.toFixed(2)),
      totalKwhInjecaoMedida: Number(totalKwhInjecaoMedida.toFixed(2)),
      totalKwhInjecaoRegistada: Number(totalKwhInjecaoRegistada.toFixed(2)),
      totalKwhAutoconsumo: Number(totalKwhAutoconsumo.toFixed(2)),
      averageDailyKwh: Number((totalKwhMedido / daysCount).toFixed(2)),
      averageMonthlyKwh: Number(((totalKwhMedido / daysCount) * 30.41).toFixed(2)),

      // Potência
      peakPowerKw: Number(peakPowerKw.toFixed(3)),
      peakRecord,
      p50Power: Number(p50Power.toFixed(3)),
      p90Power: Number(p90Power.toFixed(3)),
      p95Power: Number(p95Power.toFixed(3)),
      p99Power: Number(p99Power.toFixed(3)),
      p999Power: Number(p999Power.toFixed(3)),
      averagePowerKw: Number(averagePowerKw.toFixed(3)),
      recommendedTier,
      tightTier,
      tierRiskAnalysis,

      // Standby
      standbyWatts,
      standbyMonthlyKwh: Math.round(standbyMonthlyKwh),
      standbyAnnualKwh: Math.round(standbyAnnualKwh),
      standbyAnnualCostEur: Math.round(standbyAnnualCostEur),

      // Tarifários
      tariffCounts: {
        bihorario_diario: {
          vazio: Number(tariffCounts.bihorario_diario.vazio.toFixed(2)),
          fora_vazio: Number(tariffCounts.bihorario_diario.fora_vazio.toFixed(2)),
          vazioPct: Number(biDiarioVazioPct.toFixed(1)),
        },
        bihorario_semanal: {
          vazio: Number(tariffCounts.bihorario_semanal.vazio.toFixed(2)),
          fora_vazio: Number(tariffCounts.bihorario_semanal.fora_vazio.toFixed(2)),
          vazioPct: Number(biSemanalVazioPct.toFixed(1)),
        },
        trihorario: {
          vazio: Number(tariffCounts.trihorario.vazio.toFixed(2)),
          cheias: Number(tariffCounts.trihorario.cheias.toFixed(2)),
          ponta: Number(tariffCounts.trihorario.ponta.toFixed(2)),
        },
      },
      isBiHorarioAdvised,
      bestBiCycle,
      bestBiVazioPct: Number(bestBiVazioPct.toFixed(1)),

      // Custos e Simulações
      costSimulation: {
        simples: Number(totalSimples.toFixed(2)),
        biDiario: Number(totalBiDiario.toFixed(2)),
        biSemanal: Number(totalBiSemanal.toFixed(2)),
        trihorario: Number(totalTri.toFixed(2)),
        annualSavingsBiDiario: Math.round(annualSavingsBiDiario),
        annualSavingsBiSemanal: Math.round(annualSavingsBiSemanal),
      },

      // Perfis e Séries
      profile24h,
      loadDurationCurve,
      dailyList: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      monthlyList: Array.from(monthlyMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
      insights,
      hasSolar: dataset.hasSolar,
    };
  },
};
