/**
 * Parser para Diagramas de Carga da E-REDES (Excel .xlsx e CSV)
 * Suporta ficheiros de 1 mês, múltiplos meses ou anos completos.
 */

// Se estiver em ambiente Node.js, usa o módulo; no browser, usa a variável global XLSX
const getXLSX = () => {
  if (typeof window !== 'undefined' && window.XLSX) return window.XLSX;
  try {
    return require('xlsx');
  } catch (e) {
    return null;
  }
};

export const ERedesParser = {
  // Regex para extrair CPE padrão português (ex: PT0002000000000000AA)
  CPE_REGEX: /PT\d{16}[A-Z]{2}/i,

  /**
   * Converte valor com vírgula ou numérico para float seguro
   */
  parseNumber(val) {
    if (val === null || val === undefined || val === '') return 0.0;
    if (typeof val === 'number') return isNaN(val) ? 0.0 : val;
    const str = String(val).trim().replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0.0 : num;
  },

  /**
   * Extrai CPE do nome do ficheiro ou do conteúdo
   */
  extractCPE(filename, rawRows = []) {
    if (filename) {
      const match = filename.match(this.CPE_REGEX);
      if (match) return match[0].toUpperCase();
    }
    for (const row of rawRows.slice(0, 20)) {
      if (Array.isArray(row)) {
        for (const cell of row) {
          if (cell && typeof cell === 'string') {
            const match = cell.match(this.CPE_REGEX);
            if (match) return match[0].toUpperCase();
          }
        }
      }
    }
    return 'CPE Desconhecido';
  },

  /**
   * Converte strings de data e hora para objeto Date e chave ISO
   */
  parseDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;

    let dStr = String(dateStr).trim();
    let tStr = String(timeStr).trim();

    // Lidar com datas Excel numéricas (se vier em dias desde 1900)
    if (!isNaN(dStr) && Number(dStr) > 40000 && !dStr.includes('/') && !dStr.includes('-')) {
      const excelDate = new Date(Math.round((Number(dStr) - 25569) * 86400 * 1000));
      dStr = excelDate.toISOString().split('T')[0];
    }

    // Normalizar separadores de data
    let parts = [];
    if (dStr.includes('/')) {
      parts = dStr.split('/');
    } else if (dStr.includes('-')) {
      parts = dStr.split('-');
    }

    let year, month, day;
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else if (parts[2].length === 4) {
        // DD/MM/YYYY
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }
    }

    if (!year || !month || !day) {
      const parsed = new Date(dStr);
      if (!isNaN(parsed.getTime())) {
        year = parsed.getFullYear();
        month = parsed.getMonth() + 1;
        day = parsed.getDate();
      } else {
        return null;
      }
    }

    // Normalizar hora e minuto
    const timeParts = tStr.split(':');
    let hours = parseInt(timeParts[0], 10) || 0;
    let minutes = parseInt(timeParts[1], 10) || 0;

    // Em ficheiros E-REDES, 00:00 do dia seguinte representa o fim do dia anterior
    // Se for 00:00 e corresponder ao fecho de 24h, ajustamos o objeto Date
    const pad = (n) => String(n).padStart(2, '0');
    const dateFormatted = `${year}-${pad(month)}-${pad(day)}`;
    const timeFormatted = `${pad(hours)}:${pad(minutes)}`;

    // Criar Date local
    const dateObj = new Date(year, month - 1, day, hours, minutes, 0, 0);

    return {
      dateObj,
      dateFormatted,
      timeFormatted,
      isoKey: `${dateFormatted}T${timeFormatted}:00`,
      year,
      month,
      day,
      hours,
      minutes,
    };
  },

  /**
   * Processa uma folha ou lista de linhas brutas
   */
  processRawRows(rawRows, filename = '') {
    if (!rawRows || rawRows.length < 2) {
      throw new Error('O ficheiro não contém linhas de dados suficientes.');
    }

    // Localizar a linha de cabeçalho (que contenha 'Data' e 'Hora' ou 'Consumo')
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(rawRows.length, 30); r++) {
      const row = rawRows[r];
      if (Array.isArray(row)) {
        const rowStr = row.map((c) => (c ? String(c).toLowerCase() : '')).join(' ');
        if (rowStr.includes('data') && (rowStr.includes('hora') || rowStr.includes('consumo'))) {
          headerRowIdx = r;
          break;
        }
      }
    }

    if (headerRowIdx === -1) {
      throw new Error('Não foi possível identificar a linha de cabeçalho dos dados E-REDES.');
    }

    const headers = rawRows[headerRowIdx].map((h) => (h ? String(h).trim() : ''));
    const cpe = this.extractCPE(filename, rawRows);

    // Mapear colunas pelo nome
    let colData = -1;
    let colHora = -1;
    let colConsumoMedido = -1;
    let colInjecaoMedida = -1;
    let colConsumoRegistado = -1;
    let colInjecaoRegistada = -1;
    let colEstado = -1;

    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase();
      if (h === 'data') colData = i;
      else if (h === 'hora') colHora = i;
      else if (h.includes('consumo medido') || (h.includes('consumo') && h.includes('ic'))) colConsumoMedido = i;
      else if (h.includes('inje') && (h.includes('medida') || h.includes('ic'))) colInjecaoMedida = i;
      else if (h.includes('consumo registado') || h.includes('consumo ativo')) colConsumoRegistado = i;
      else if (h.includes('inje') && h.includes('registada')) colInjecaoRegistada = i;
      else if (h.includes('estado') && colEstado === -1) colEstado = i;
    }

    // Fallbacks baseados na estrutura padrão E-REDES (se cabeçalhos forem ligeiramente truncados)
    if (colData === -1) colData = 0;
    if (colHora === -1) colHora = 1;
    if (colConsumoMedido === -1) colConsumoMedido = 2;
    if (colInjecaoMedida === -1 && headers.length > 4) colInjecaoMedida = 4;
    if (colConsumoRegistado === -1 && headers.length > 6) colConsumoRegistado = 6;
    if (colInjecaoRegistada === -1 && headers.length > 8) colInjecaoRegistada = 8;

    const records = [];
    let hasSolar = false;
    let realCount = 0;
    let estimatedCount = 0;

    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || !row[colData]) continue;

      const dateStr = row[colData];
      const timeStr = row[colHora] || '00:00';

      const dt = this.parseDateTime(dateStr, timeStr);
      if (!dt) continue;

      const consumoMedido = this.parseNumber(row[colConsumoMedido]);
      const injecaoMedida = colInjecaoMedida !== -1 ? this.parseNumber(row[colInjecaoMedida]) : 0.0;
      const consumoRegistado = colConsumoRegistado !== -1 ? this.parseNumber(row[colConsumoRegistado]) : consumoMedido;
      const injecaoRegistada = colInjecaoRegistada !== -1 ? this.parseNumber(row[colInjecaoRegistada]) : injecaoMedida;

      const estado = colEstado !== -1 && row[colEstado] ? String(row[colEstado]).trim() : 'Real';
      if (estado.toLowerCase().includes('estim')) {
        estimatedCount++;
      } else {
        realCount++;
      }

      if (injecaoMedida > 0 || injecaoRegistada > 0 || (consumoRegistado > consumoMedido && consumoMedido >= 0)) {
        hasSolar = true;
      }

      // Potência em kW a 15 min -> Energia em kWh = kW * 0.25
      const kwhConsumoMedido = consumoMedido * 0.25;
      const kwhInjecaoMedida = injecaoMedida * 0.25;
      const kwhConsumoRegistado = consumoRegistado * 0.25;
      const kwhInjecaoRegistada = injecaoRegistada * 0.25;

      records.push({
        timestamp: dt.dateObj.getTime(),
        dateFormatted: dt.dateFormatted,
        timeFormatted: dt.timeFormatted,
        isoKey: dt.isoKey,
        year: dt.year,
        month: dt.month,
        day: dt.day,
        hour: dt.hours,
        minute: dt.minutes,
        dayOfWeek: dt.dateObj.getDay(),
        consumoMedidoKw: consumoMedido,
        injecaoMedidaKw: injecaoMedida,
        consumoRegistadoKw: consumoRegistado,
        injecaoRegistadaKw: injecaoRegistada,
        kwhConsumoMedido,
        kwhInjecaoMedida,
        kwhConsumoRegistado,
        kwhInjecaoRegistada,
        // Autoconsumo solar instantâneo compensado
        kwhAutoconsumo: Math.max(0, kwhConsumoRegistado - kwhConsumoMedido),
        estado,
        sourceFile: filename,
      });
    }

    return {
      cpe,
      filename,
      records,
      hasSolar,
      realCount,
      estimatedCount,
    };
  },

  /**
   * Lê ficheiro Excel (.xlsx / .xls) a partir de um ArrayBuffer ou Uint8Array
   */
  parseExcel(arrayBuffer, filename = '') {
    const XLSX = getXLSX();
    if (!XLSX) throw new Error('Biblioteca XLSX (SheetJS) não está disponível.');

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

    return this.processRawRows(rawRows, filename);
  },

  /**
   * Lê ficheiro de texto CSV
   */
  parseCSV(csvText, filename = '') {
    if (!csvText) throw new Error('Conteúdo CSV vazio.');

    // Detetar delimitador (; ou , ou \t)
    const firstLines = csvText.split(/\r?\n/).slice(0, 15).join('\n');
    const countSemi = (firstLines.match(/;/g) || []).length;
    const countComma = (firstLines.match(/,/g) || []).length;
    const delimiter = countSemi >= countComma ? ';' : ',';

    const lines = csvText.split(/\r?\n/);
    const rawRows = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      // Tratar aspas simples e duplas
      const parts = line.split(delimiter).map((p) => p.replace(/^["']|["']$/g, '').trim());
      rawRows.push(parts);
    }

    return this.processRawRows(rawRows, filename);
  },

  /**
   * Combina múltiplos ficheiros (ex: vários meses de um ano)
   * Elimina sobreposições/duplicados por data e hora, ordenando cronologicamente.
   */
  mergeDatasets(parsedDatasets) {
    if (!parsedDatasets || parsedDatasets.length === 0) return null;

    let primaryCPE = '';
    const recordsMap = new Map();
    let totalReal = 0;
    let totalEstimated = 0;
    let anySolar = false;
    const sourceFiles = [];

    for (const ds of parsedDatasets) {
      if (!primaryCPE && ds.cpe && ds.cpe !== 'CPE Desconhecido') {
        primaryCPE = ds.cpe;
      }
      if (ds.filename && !sourceFiles.includes(ds.filename)) {
        sourceFiles.push(ds.filename);
      }
      if (ds.hasSolar) anySolar = true;
      totalReal += ds.realCount || 0;
      totalEstimated += ds.estimatedCount || 0;

      for (const rec of ds.records) {
        // Usar chave única de data e hora para deduplicação
        const key = `${rec.dateFormatted} ${rec.timeFormatted}`;
        if (!recordsMap.has(key)) {
          recordsMap.set(key, rec);
        } else {
          // Se já existia, manter preferencialmente o registo 'Real' face a 'Estimado'
          const existing = recordsMap.get(key);
          if (existing.estado.toLowerCase().includes('estim') && !rec.estado.toLowerCase().includes('estim')) {
            recordsMap.set(key, rec);
          }
        }
      }
    }

    // Ordenar cronologicamente
    const combinedRecords = Array.from(recordsMap.values()).sort((a, b) => a.timestamp - b.timestamp);

    const startDate = combinedRecords.length > 0 ? combinedRecords[0].dateFormatted : '';
    const endDate = combinedRecords.length > 0 ? combinedRecords[combinedRecords.length - 1].dateFormatted : '';

    // Contagem de dias distintos
    const uniqueDays = new Set(combinedRecords.map((r) => r.dateFormatted));

    return {
      cpe: primaryCPE || 'CPE Desconhecido',
      sourceFiles,
      records: combinedRecords,
      totalRecords: combinedRecords.length,
      daysCount: uniqueDays.size,
      startDate,
      endDate,
      hasSolar: anySolar,
      realCount: totalReal,
      estimatedCount: totalEstimated,
    };
  },
};
