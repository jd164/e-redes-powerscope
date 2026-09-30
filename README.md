# ⚡ E-REDES PowerScope

> **Analisador & Intérprete Inteligente de Diagramas de Carga da E-REDES (15 min)**  
> Otimização de potência contratada (kVA), simulação de tarifários ERSE e monitorização de autoconsumo solar fotovoltaico (UPAC) em Portugal Continental.

[![Live Demo](https://img.shields.io/badge/Demo_Online-GitHub_Pages-22c55e?style=for-the-badge&logo=github)](https://jd164.github.io/e-redes-powerscope/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)
[![Privacy: 100% Local](https://img.shields.io/badge/Privacidade-100%25_No_Browser-emerald?style=for-the-badge&logo=shield)](#-privacidade-e-seguran%C3%A7a)
[![JavaScript](https://img.shields.io/badge/Vanilla_JS-ES6+-f59e0b?style=for-the-badge&logo=javascript)](https://developer.mozilla.org/)

<img width="1440" height="1891" alt="imagem" src="https://github.com/user-attachments/assets/0dd0f440-cd16-4a40-8fe8-d73b2f766e3b" />

---

## 🌐 Experimentar Online (Sem Instalação)

Aceda à versão web pronta a usar no GitHub Pages:  
👉 **[https://jd164.github.io/e-redes-powerscope/](https://jd164.github.io/e-redes-powerscope/)**

> Não tem um ficheiro à mão? Clique no botão **"Carregar Exemplo (Agosto)"** diretamente na aplicação para ver uma demonstração completa com dados reais anonimizados!

---

## 📖 O que é o E-REDES PowerScope?

Em Portugal Continental, a distribuidora **E-REDES** disponibiliza no seu Balcão Digital os diagramas de carga das habitações a cada **15 minutos** (quartos de hora). No entanto, estes ficheiros Excel (`.xlsx`) ou CSV contêm milhares de linhas de leituras brutas que são difíceis de interpretar sem ferramentas especializadas.

O **E-REDES PowerScope** foi concebido para transformar esses ficheiros brutos num painel analítico interativo, fornecendo diagnósticos práticos e recomendações financeiras imediatas:
- **Tenho potência contratada a mais?** Posso baixar de escalão e poupar no termo fixo?
- **Compensa mudar para tarifa Bi-Horária ou Tri-Horária?**
- **Quanto estou a gastar em consumo fantasma (standby)?**
- **Qual a taxa de aproveitamento dos meus painéis solares?**

---

## ✨ Principais Funcionalidades

### 1. ⚡ Otimização da Potência Contratada (kVA)
- Identifica o **pico máximo absoluto (kW)** e os percentis estatísticos **p99.9** e **p99**.
- Avalia o risco de disparo do disjuntor/contador face aos escalões regulados em Portugal:  
  `1.15`, `2.30`, `3.45`, `4.60`, `5.75`, `6.90`, `10.35`, `13.80`, `17.25`, `20.70 kVA`.
- Matriz de risco detalhada (seguro, tolerável ou perigo de corte).
- Estimativa da **poupança anual (€)** no termo de potência caso baixe de escalão com segurança.

### 2. 🕒 Simulador Tarifário ERSE (Simples vs Bi-Horário vs Tri-Horário)
- Classificação quarto a quarto de hora segundo a regulamentação oficial da **ERSE** para Portugal Continental.
- Tratamento automático do **Horário de Verão** e **Horário de Inverno**.
- Suporte a **Ciclo Diário** e **Ciclo Semanal**.
- Aplicação da regra dos **> 35% de consumo em Horas de Vazio** para comprovar a viabilidade económica da tarifa bi-horária.
- Simulação comparativa de fatura anual estimada.

### 3. ☀️ Análise de Autoconsumo Solar Fotovoltaico (UPAC)
- Diferenciação rigorosa entre:
  - **Consumo Medido Líquido na IC** (após saldamento instantâneo a 15 min).
  - **Consumo Registado** no contador.
- Cálculo da energia solar autoconsumida instantaneamente na habitação.
- Quantificação do excedente solar exportado/injetado na rede pública.

### 4. 🌙 Deteção de Carga de Fundo / Standby (Baseload)
- Análise da potência mínima contínua durante a madrugada (**02h00 às 05h00**), período sem produção solar e com a habitação em repouso.
- Identificação da carga de base (frigorífico, routers, boxes, eletrodomésticos em espera).
- Projeção do custo financeiro mensal e anual do consumo fantasma.

### 5. 📊 6 Gráficos Interativos de Alto Desempenho (Apache ECharts)
1. **Diagrama de Carga Contínuo**: Linha temporal com *dataZoom*, deteção de picos e linha de referência da potência recomendada.
2. **Perfil Médio das 24 Horas**: Comparação entre dias úteis, fins de semana e injeção solar.
3. **Heatmap de Intensidade (24h x Dias)**: Visão panorâmica dos hábitos de consumo e picos invulgares.
4. **Evolução Mensal & Diária**: Barras de consumo vs injeção solar e linha de picos de potência.
5. **Curva Monótona de Carga (Load Duration Curve)**: Percentagem de tempo acima de cada limiar de potência.
6. **Repartição Tarifária em Donut**: Percentagem de consumo em Vazio, Ponta e Cheias.

### 6. 📄 Exportação e Relatórios
- **Exportar CSV**: Resumo agregado diário pronto para Excel ou Power BI.
- **Relatório PDF**: Impressão limpa otimizada para folhas A4 e documentação técnica.

---

## 🔒 Privacidade e Segurança (Privacy by Design)

- **100% Processamento Local (Client-Side)**: O processamento dos ficheiros Excel/CSV e os cálculos dos algoritmos correm exclusivamente no motor JavaScript do seu navegador.
- **Zero Fuga de Dados**: Nenhum ficheiro, dado de consumo, perfil horário ou identificador de instalação (CPE) é enviado para servidores externos.
- Pode utilizar a ferramenta mesmo em modo offline ou sem ligação à internet.

---

## 📋 Como Obter os Ficheiros no Balcão Digital E-REDES

1. Aceda ao portal da **E-REDES** em [balcaodigital.e-redes.pt](https://balcaodigital.e-redes.pt/).
2. Faça login na sua área reservada.
3. Aceda ao menu **Consumos e Produção** > **Consultar Diagramas de Carga**.
4. Selecione o período pretendido (1 mês, múltiplos meses ou até 1 ano) com intervalo de **15 minutos**.
5. Clique em **Descarregar Excel (.xlsx)**.
6. Arraste o ficheiro descarregado diretamente para o **E-REDES PowerScope**!

---

## 🚀 Como Executar Localmente

### Opção 1: Duplo Clique (Windows)
Basta clicar duas vezes no ficheiro:
```text
iniciar_app.bat
```
O servidor local iniciará e o navegador abrirá automaticamente em `http://localhost:3333`.

### Opção 2: Python
```bash
python serve.py
```
Abra o navegador em `http://localhost:3333`.

### Opção 3: Node.js / NPM
```bash
npm start
```

### Opção 4: Abertura Direta
Pode simplesmente abrir o ficheiro `index.html` em qualquer navegador web moderno (Chrome, Firefox, Safari, Edge).

---

## 📂 Estrutura do Projeto

```text
e-redes/
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD para deploy automático no GitHub Pages
├── lib/
│   ├── echarts.min.js        # Motor gráfico Apache ECharts v6
│   └── xlsx.full.min.js      # Leitor de folhas Excel SheetJS
├── sample/
│   └── Consumos_..._Exemplo.xlsx # Ficheiro de demonstração anonimizado
├── src/
│   ├── analyzer.js           # Algoritmos de cálculo (picos, percentis, standby, solar)
│   ├── app.js                # Orquestrador da interface e eventos
│   ├── charts.js             # Configuração e renderização dos gráficos ECharts
│   ├── erseRules.js          # Regras tarifárias oficiais ERSE e preços padrão
│   └── parser.js             # Leitura e parsing de ficheiros Excel e CSV
├── index.html                # Interface gráfica principal (HTML5 semântico)
├── index.css                 # Design System moderno, responsivo e dark-themed
├── iniciar_app.bat            # Atalho de execução para Windows
├── package.json              # Configuração do projeto e dependências
├── serve.py                  # Servidor HTTP local leve em Python
└── README.md                 # Documentação do projeto
```

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3**: Interface limpa, responsiva, com suporte a modo escuro e glassmorphism.
- **JavaScript Moderno (ES6+ Modules)**: Arquitetura modular sem necessidade de bundlers complexos (zero-build).
- **[Apache ECharts](https://echarts.apache.org/)**: Visualizações interativas e fluidas.
- **[SheetJS (XLSX)](https://sheetjs.com/)**: Processamento de folhas de cálculo `.xlsx` em memória.

---

## 📄 Licença

Este projeto está licenciado sob a Licença **MIT** - consulte o ficheiro [LICENSE](LICENSE) para mais detalhes.

---

<p align="center">
  Desenvolvido com foco na eficiência energética e literacia elétrica em Portugal 🇵🇹
</p>
