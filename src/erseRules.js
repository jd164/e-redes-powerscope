/**
 * Regras Oficiais ERSE para Tarifários de Eletricidade em Portugal Continental
 * BTN - Baixa Tensão Normal (Potências <= 41.4 kVA)
 */

export const ERSERules = {
  // Determina se uma data está no Horário de Verão ou Inverno em Portugal Continental
  // Verão: Do último domingo de março ao último domingo de outubro
  isSummerTime(date) {
    const d = new Date(date);
    const year = d.getFullYear();

    // Último domingo de março
    const marchLastDay = new Date(Date.UTC(year, 2, 31));
    const marchSunday = 31 - marchLastDay.getUTCDay();
    const summerStart = new Date(Date.UTC(year, 2, marchSunday, 1, 0, 0));

    // Último domingo de outubro
    const octLastDay = new Date(Date.UTC(year, 9, 31));
    const octSunday = 31 - octLastDay.getUTCDay();
    const summerEnd = new Date(Date.UTC(year, 9, octSunday, 1, 0, 0));

    return d >= summerStart && d < summerEnd;
  },

  /**
   * Determina o período tarifário de um determinado momento
   * @param {Date} date - Objeto Date
   * @param {string} tariffType - 'bihorario' | 'trihorario' | 'simples'
   * @param {string} cycleType - 'diario' | 'semanal'
   * @returns {'vazio' | 'fora_vazio' | 'ponta' | 'cheias' | 'simples'}
   */
  getPeriod(date, tariffType = 'bihorario', cycleType = 'diario') {
    if (tariffType === 'simples') return 'simples';

    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;

    const hour = date.getHours();
    const minute = date.getMinutes();
    const totalMinutes = hour * 60 + minute;
    const isSummer = this.isSummerTime(date);

    // --- BI-HORÁRIO ---
    if (tariffType === 'bihorario') {
      if (cycleType === 'diario') {
        // Ciclo Diário: Vazio das 22h00 às 08h00 todos os dias
        const isVazio = totalMinutes >= 22 * 60 || totalMinutes < 8 * 60;
        return isVazio ? 'vazio' : 'fora_vazio';
      }

      // Ciclo Semanal
      if (isSunday) {
        // Domingos: Todo o dia é Vazio
        return 'vazio';
      }

      if (isWeekday) {
        // Dias úteis: Vazio das 00h00 às 07h00
        const isVazio = totalMinutes < 7 * 60;
        return isVazio ? 'vazio' : 'fora_vazio';
      }

      if (isSaturday) {
        if (isSummer) {
          // Sábado Verão: Vazio 00h00-09h00, 14h00-20h00, 22h00-24h00
          const isVazio =
            totalMinutes < 9 * 60 ||
            (totalMinutes >= 14 * 60 && totalMinutes < 20 * 60) ||
            totalMinutes >= 22 * 60;
          return isVazio ? 'vazio' : 'fora_vazio';
        } else {
          // Sábado Inverno: Vazio 00h00-09h30, 13h00-18h30, 22h00-24h00
          const isVazio =
            totalMinutes < 9 * 60 + 30 ||
            (totalMinutes >= 13 * 60 && totalMinutes < 18 * 60 + 30) ||
            totalMinutes >= 22 * 60;
          return isVazio ? 'vazio' : 'fora_vazio';
        }
      }
    }

    // --- TRI-HORÁRIO ---
    if (tariffType === 'trihorario') {
      if (cycleType === 'diario') {
        // Ciclo Diário Tri-horário
        // Vazio: 22h00 às 08h00
        if (totalMinutes >= 22 * 60 || totalMinutes < 8 * 60) return 'vazio';

        if (isSummer) {
          // Ponta Verão: 10h30-13h00 e 19h30-21h00
          const isPonta =
            (totalMinutes >= 10 * 60 + 30 && totalMinutes < 13 * 60) ||
            (totalMinutes >= 19 * 60 + 30 && totalMinutes < 21 * 60);
          return isPonta ? 'ponta' : 'cheias';
        } else {
          // Ponta Inverno: 09h00-10h30 e 18h00-20h30
          const isPonta =
            (totalMinutes >= 9 * 60 && totalMinutes < 10 * 60 + 30) ||
            (totalMinutes >= 18 * 60 && totalMinutes < 20 * 60 + 30);
          return isPonta ? 'ponta' : 'cheias';
        }
      }

      // Ciclo Semanal Tri-horário
      if (isSunday) return 'vazio';

      if (isSaturday) {
        // Sábado não tem horas de Ponta (apenas Cheias e Vazio)
        if (isSummer) {
          const isVazio =
            totalMinutes < 9 * 60 ||
            (totalMinutes >= 14 * 60 && totalMinutes < 20 * 60) ||
            totalMinutes >= 22 * 60;
          return isVazio ? 'vazio' : 'cheias';
        } else {
          const isVazio =
            totalMinutes < 9 * 60 + 30 ||
            (totalMinutes >= 13 * 60 && totalMinutes < 18 * 60 + 30) ||
            totalMinutes >= 22 * 60;
          return isVazio ? 'vazio' : 'cheias';
        }
      }

      if (isWeekday) {
        // Dias úteis: Vazio das 00h00 às 07h00
        if (totalMinutes < 7 * 60) return 'vazio';

        if (isSummer) {
          // Ponta Verão: 10h30-13h00 e 19h30-21h00
          const isPonta =
            (totalMinutes >= 10 * 60 + 30 && totalMinutes < 13 * 60) ||
            (totalMinutes >= 19 * 60 + 30 && totalMinutes < 21 * 60);
          return isPonta ? 'ponta' : 'cheias';
        } else {
          // Ponta Inverno: 09h00-10h30 e 18h00-20h30
          const isPonta =
            (totalMinutes >= 9 * 60 && totalMinutes < 10 * 60 + 30) ||
            (totalMinutes >= 18 * 60 && totalMinutes < 20 * 60 + 30);
          return isPonta ? 'ponta' : 'cheias';
        }
      }
    }

    return 'fora_vazio';
  },

  // Escalões de potência normalizados em Portugal (BTN)
  POWER_TIERS_KVA: [
    { kva: 1.15, amps: 5, phase: 'mono', defaultTermEurDay: 0.085 },
    { kva: 2.30, amps: 10, phase: 'mono', defaultTermEurDay: 0.125 },
    { kva: 3.45, amps: 15, phase: 'mono', defaultTermEurDay: 0.165 },
    { kva: 4.60, amps: 20, phase: 'mono', defaultTermEurDay: 0.215 },
    { kva: 5.75, amps: 25, phase: 'mono', defaultTermEurDay: 0.260 },
    { kva: 6.90, amps: 30, phase: 'mono', defaultTermEurDay: 0.315 },
    { kva: 10.35, amps: 45, phase: 'mono', defaultTermEurDay: 0.460 },
    { kva: 13.80, amps: 60, phase: 'mono/tri', defaultTermEurDay: 0.605 },
    { kva: 17.25, amps: 25, phase: 'tri', defaultTermEurDay: 0.745 },
    { kva: 20.70, amps: 30, phase: 'tri', defaultTermEurDay: 0.890 },
    { kva: 27.60, amps: 40, phase: 'tri', defaultTermEurDay: 1.180 },
    { kva: 34.50, amps: 50, phase: 'tri', defaultTermEurDay: 1.470 },
    { kva: 41.40, amps: 60, phase: 'tri', defaultTermEurDay: 1.760 },
  ],

  // Preços de referência médios no mercado liberalizado em Portugal (2025/2026)
  DEFAULT_PRICES: {
    simples: {
      kwh: 0.165,
    },
    bihorario_diario: {
      vazio: 0.112,
      fora_vazio: 0.198,
    },
    bihorario_semanal: {
      vazio: 0.110,
      fora_vazio: 0.196,
    },
    trihorario: {
      ponta: 0.255,
      cheias: 0.170,
      vazio: 0.108,
    },
  },
};
