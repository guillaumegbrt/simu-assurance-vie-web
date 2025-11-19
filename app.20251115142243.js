console.log('Build V1.40');
// Bannière d'erreur pour debug
(function(){ window.addEventListener('error', e=>{ const b=document.getElementById('errorBanner'); if(b){ b.textContent = 'Erreur JavaScript: '+(e.message||''); b.style.display='block'; } console.error(e.error||e); }); })();
try{
  dayjs.extend(window.dayjs_plugin_utc);
  dayjs.extend(window.dayjs_plugin_customParseFormat);
  dayjs.extend(window.dayjs_plugin_isSameOrBefore);
}catch(e){ console.warn('Dayjs plugins', e); }

const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>Array.from(c.querySelectorAll(s)); const byId=id=>document.getElementById(id);

// --- Providers ---

async function fetchData(provider, ticker, params = {}) {
  const queryParams = new URLSearchParams({ provider, ticker, ...params });
  const url = `https://my-yahoo-proxy.vercel.app/api/historical?${queryParams.toString()}`;
  
  console.log(`Fetching via proxy: provider=${provider}, ticker=${ticker}`);

  try {
    const r = await fetch(url);
    if (!r.ok) {
      throw new Error(`Proxy request failed for ${provider} with status ${r.status}`);
    }
    const j = await r.json();

    // Parse data based on provider
    switch (provider) {
      case 'yahoo':
        const chart = j.chart;
        if (chart.error) {
          console.error('Yahoo API Error:', chart.error.description);
          return [];
        }
        const result = chart.result[0];
        const timestamps = result.timestamp;
        if (!timestamps) return [];
        return timestamps.map((ts, i) => ({
          date: dayjs.unix(ts).format('YYYY-MM-DD'),
          close: result.indicators.quote[0].close[i]
        })).filter(d => d.close !== null).sort((a, b) => a.date.localeCompare(b.date));

      case 'tiingo':
        if (!Array.isArray(j) || j.length === 0) return [];
        return j.map(d => ({ date: d.date.slice(0, 10), close: d.adjClose })).sort((a, b) => a.date.localeCompare(b.date));

      case 'eod':
        if (!Array.isArray(j) || j.length === 0) return [];
        return j.map(d => ({ date: d.date, close: d.adjusted_close })).sort((a, b) => a.date.localeCompare(b.date));
      
      case 'eod_search':
         return j;

      default:
        return j;
    }
  } catch (e) {
    console.warn(`Failed to fetch or parse data for ${ticker} from ${provider}:`, e);
    return null; // Return null on failure
  }
}

async function fetchIndexData(symbol) {
    const endDate = dayjs().unix();
    const startDate = dayjs().subtract(20, 'year').unix();
    // Always use Yahoo via proxy for indices
    return await fetchData('yahoo', symbol, { period1: startDate, period2: endDate });
}

async function fetchBestUCData(symbol) {
    console.log(`Fetching UC data for ${symbol} from Yahoo via proxy...`);
    // Use Yahoo provider for UCs as well
    return await fetchIndexData(symbol);
}

// --- End Providers ---


// Parsing helpers (sans regex)
function splitLines(text){
  return text.split('\n');
}
function toMonthlyReturns(series){
  if (!series || series.length < 2) return []; // Handle null or insufficient data
  const out=[];
  for(let i=1;i<series.length;i++){ if(series[i-1].close > 0) out.push({date:series[i].date, r: series[i].close/series[i-1].close - 1}); } return out;
}

// State
const state={ euro:{ feeIn:0, rates:[] }, fees: { mgmtEuro: 0.7, mgmtUC: 0.8 }, ucs:[], scenarios:[ {start:'',init:10000,prog:0,freq:'Mensuel',progStart:'',progEnd:'',allocInit:{'Fonds_Euro': 100},allocProg:{}}, {start:'',init:1000,prog:100,freq:'Mensuel',progStart:'',progEnd:'',allocInit:{},allocProg:{}}, {start:'',init:10000,prog:100,freq:'Mensuel',progStart:'',progEnd:'',allocInit:{'Fonds_Euro': 100},allocProg:{},euroAmount:5000} ]};
function save(){
  localStorage.setItem('simu-av', JSON.stringify(state));
}
function load(){
  const s=localStorage.getItem('simu-av');
  if(s){
    try{
      const loadedState = JSON.parse(s);
      // Migration for alloc
      if (loadedState.scenarios) {
        for (const scenario of loadedState.scenarios) {
          if (scenario.alloc && !scenario.allocInit && !scenario.allocProg) {
            scenario.allocInit = JSON.parse(JSON.stringify(scenario.alloc));
            scenario.allocProg = JSON.parse(JSON.stringify(scenario.alloc));
            delete scenario.alloc;
          }
        }
      }
      
      // Clean up old API key structure if it exists
      if (loadedState.api) {
        delete loadedState.api;
      }

      // Assign properties from loadedState, merging nested objects
      for (const key in loadedState) {
        if (key === 'euro' || key === 'fees') {
          if (loadedState[key] && typeof loadedState[key] === 'object') {
            Object.assign(state[key], loadedState[key]);
          }
        } else {
          state[key] = loadedState[key];
        }
      }
    }catch{}
  }
}

// UI builders
function debounce(func, delay) { let timeout; return function(...args) { const context = this; clearTimeout(timeout); timeout = setTimeout(() => func.apply(context, args), delay); }; }
function buildEuroRates(){ const host=byId('euroRates'); host.innerHTML=''; const wrap = document.createElement('div'); wrap.className = 'table-wrap'; const tbl=document.createElement('table'); tbl.innerHTML='<thead><tr><th>Année</th><th>Taux annuel net (%)</th><th></th></tr></thead><tbody></tbody>'; const tb=tbl.querySelector('tbody'); for(const row of state.euro.rates){ const tr=document.createElement('tr'); tr.innerHTML=`<td><input type="number" value="${row.year}" class="er-year"/></td><td><input type="number" step="0.01" value="${row.rate}" class="er-rate"/></td><td><button class="del" type="button">×</button></td>`; tb.appendChild(tr); tr.querySelector('.er-year').onchange=e=>{row.year=+e.target.value; save();}; tr.querySelector('.er-rate').onchange=e=>{row.rate=+e.target.value; save();}; tr.querySelector('.del').onclick=()=>{ state.euro.rates=state.euro.rates.filter(x=>x!==row); buildEuroRates(); save(); }; } 
  wrap.appendChild(tbl); host.appendChild(wrap); }

function addUcToSelectedTable(uc) {
    const selectedUcList = byId('selected-uc-list');
    const tr = document.createElement('tr');
    tr.dataset.ticker = uc.ticker;
    tr.innerHTML = `
        <td>${uc.name} (${uc.ticker})</td>
        <td><button class="remove-uc" type="button">×</button></td>
    `;
    selectedUcList.appendChild(tr);
    
    tr.querySelector('.remove-uc').addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        const ticker = row.dataset.ticker;
        const ucToRemove = state.ucs.find(uc => uc.ticker === ticker);
        if (ucToRemove) {
            const key = ucKey(ucToRemove);
            state.scenarios.forEach(s => {
                delete s.allocInit[key];
                delete s.allocProg[key];
            });
        }
        state.ucs = state.ucs.filter(uc => uc.ticker !== ticker);
        row.remove();
        buildAllAlloc();
        save();
    });
}

function buildSelectedUcTable() {
    const selectedUcList = byId('selected-uc-list');
    selectedUcList.innerHTML = '';
    state.ucs.forEach(addUcToSelectedTable);
}

function buildAllAlloc(){ [1,2,3].forEach(i=> buildAllocForScenario(i)); updateAllSums(); }
function buildAllocForScenario(idx){
  const scenario = state.scenarios[idx-1];
  // Init alloc
  const hostInit = $(`.alloc-init[data-alloc="${idx}"]`);
  if (hostInit) {
    hostInit.innerHTML = '';
    let allocInit = scenario.allocInit || (scenario.allocInit = {});
    if(Object.keys(allocInit).length === 0) allocInit['Fonds_Euro'] = (idx===1?100:0);
    hostInit.appendChild(makeAllocRow(idx, 'Fonds_Euro', 'Fonds Euro', allocInit['Fonds_Euro'] || 0, 'Init'));
    for(const uc of state.ucs){
      const key=ucKey(uc);
      if(allocInit[key]===undefined) allocInit[key]=0;
      const label=uc.name||uc.ticker||'UC';
      hostInit.appendChild(makeAllocRow(idx, key, label, allocInit[key], 'Init'));
    }
  }

  // Prog alloc
  const hostProg = $(`.alloc-prog[data-alloc="${idx}"]`);
  if (hostProg) {
    hostProg.innerHTML = '';
    let allocProg = scenario.allocProg || (scenario.allocProg = {});
    if(Object.keys(allocProg).length === 0) allocProg['Fonds_Euro'] = (idx===1?100:0);
    hostProg.appendChild(makeAllocRow(idx, 'Fonds_Euro', 'Fonds Euro', allocProg['Fonds_Euro'] || 0, 'Prog'));
    for(const uc of state.ucs){
      const key=ucKey(uc);
      if(allocProg[key]===undefined) allocProg[key]=0;
      const label=uc.name||uc.ticker||'UC';
      hostProg.appendChild(makeAllocRow(idx, key, label, allocProg[key], 'Prog'));
    }
  }
}
function makeAllocRow(idx,key,label,val,type){
    const wrap=document.createElement('div');
    wrap.className='alloc-row';
    wrap.innerHTML=`<label>${label}<input type="number" class="alloc-val" step="0.1" data-s="${idx}" data-k="${key}" data-t="${type}" value="${val}"/></label>`;
    wrap.querySelector('input').addEventListener('input', e=>{
        const s = +e.target.dataset.s;
        const k = e.target.dataset.k;
        const t = e.target.dataset.t;
        const v = +e.target.value||0;
        state.scenarios[s-1]['alloc'+t][k] = v;
        save();
        updateSumFor(s, t);
    });
    return wrap;
}
function updateAllSums(){ [1,2,3].forEach(idx => { updateSumFor(idx, 'Init'); if($(`.alloc-prog[data-alloc="${idx}"]`)) updateSumFor(idx, 'Prog'); }); }
function updateSumFor(idx, type){
  if (!type) return;
  const alloc = state.scenarios[idx-1]['alloc'+type] || {};
  const total = Object.values(alloc).reduce((a,b)=>a+(+b||0),0);
  const sumEl = $(`.sumv-${type.toLowerCase()}[data-sum="${idx}"]`);
  if(sumEl){
    sumEl.textContent=(Math.round(total*10)/10).toString();
    const box=sumEl.closest('.sum');
    if(box){
      if(total>100.0001) box.classList.add('over');
      else box.classList.remove('over');
    }
  }
}

function ucKey(uc){ return uc.ticker; }

// Simulation & chart
function monthDiff(a,b){ const da=dayjs(a), db=dayjs(b); return (db.year()-da.year())*12 + (db.month()-da.month()); }
function scheduleProg(freq){ return freq==='Mensuel'?1: freq==='Trimestriel'?3:12; }
function simulateScenario(s, allMonths, rByUC, euroRateByYear, feeInPct, fees){
  const allocInit = s.allocInit || {};
  const allocProg = s.allocProg || {};

  const portfolio = {}; // { assetKey: value }
  const allKeys = [...new Set([...Object.keys(allocInit), ...Object.keys(allocProg)])];
  for (const key of allKeys) {
    portfolio[key] = 0;
  }

  const out=[];
  const step=scheduleProg(s.freq||'Mensuel');
  const start=s.start? dayjs(s.start): allMonths[0];
  const ps=s.progStart? dayjs(s.progStart): start;
  const pe=s.progEnd? dayjs(s.progEnd): allMonths.at(-1);
  const feeIn=(feeInPct||0)/100;
  const feeMgmtEuro = (fees.mgmtEuro || 0) / 100;
  const feeMgmtUC = (fees.mgmtUC || 0) / 100;

  let lastEuroReturnYear = -1;
  let lastMgmtFeeYear = -1;

  for(const d of allMonths){
    // 1. Apply returns to existing portfolio
    for (const key in portfolio) {
      if (key === 'Fonds_Euro') {
        if (d.month() === 0 && d.year() !== lastEuroReturnYear) { // If it's January and not applied this year yet
          const annualRate = (euroRateByYear[d.year()] ?? 0) / 100;
          portfolio[key] *= (1 + annualRate); // Apply full annual return
          lastEuroReturnYear = d.year();
        }
      } else if (rByUC[key]) { // For UCs, apply monthly return
        const monthlyReturn = rByUC[key].get(d.format('YYYY-MM')) ?? 0;
        portfolio[key] *= (1 + monthlyReturn);
      }
    }
    
    // 2. Apply annual management fees
    if (d.month() === 0 && d.year() > start.year() && d.year() !== lastMgmtFeeYear) {
        portfolio['Fonds_Euro'] *= (1 - feeMgmtEuro);
        for (const key in portfolio) {
            if (key !== 'Fonds_Euro') {
                portfolio[key] *= (1 - feeMgmtUC);
            }
        }
        lastMgmtFeeYear = d.year();
    }

    // 3. Handle inflows
    if(d.isSame(dayjs(start).startOf('month'), 'month')) {
      const initInflow = (+s.init||0) * (1-feeIn);
      if (initInflow > 0) {
        for (const key in allocInit) {
          const weight = (allocInit[key] || 0) / 100;
          if(weight > 0) portfolio[key] = (portfolio[key] || 0) + initInflow * weight;
        }
      }
    }

    if(d.isAfter(ps.subtract(1,'day')) && d.isBefore(pe.add(1,'day'))){
      const m=monthDiff(ps.startOf('month'), d.startOf('month'));
      if(m%step===0 && (+s.prog||0) > 0) {
        const progInflow = (+s.prog||0) * (1-feeIn);
        for (const key in allocProg) {
          const weight = (allocProg[key] || 0) / 100;
          if(weight > 0) portfolio[key] = (portfolio[key] || 0) + progInflow * weight;
        }
      }
    }

    const totalValue = Object.values(portfolio).reduce((sum, v) => sum + v, 0);
    out.push({date:d.format('YYYY-MM-DD'), value:totalValue});
  }
  return out;
}
function mkMonthAxis(allRelevantDates){
  if (allRelevantDates.length === 0) return [];

  // Nouvelle logique : trouver la date la plus lointaine (minimum)
  const earliest = allRelevantDates.reduce((min, current) => {
      const currentDate = dayjs(current);
      return currentDate.isBefore(min) ? currentDate : min;
  }, dayjs(allRelevantDates[0]));

  let latest = dayjs(); // Date de fin est aujourd'hui par défaut

  const months = [];
  let currentMonth = earliest.startOf('month');
  while (currentMonth.isSameOrBefore(latest.startOf('month'))) {
    months.push(currentMonth);
    currentMonth = currentMonth.add(1, 'month');
  }
  return months;
}
function alignSeries(xMonths, pts){
  const map=new Map(pts.map(p=>[p.x,p.y]));
  return xMonths.map(m=> map.get(m.format('YYYY-MM')) ?? null);
}
let chartScenario; function renderScenarioChart(xMonths,{scenarios}, chartLabels){ const ctx=byId('chart-scenarios').getContext('2d'); const colors=['#60a5fa','#34d399','#f472b6','#fbbf24','#22d3ee','#a78bfa','#ef4444','#10b981','#eab308','#94a3b8','#fb7185','#14b8a6']; const ds=[];   scenarios.forEach((sc,i)=>{
    if (sc.data && sc.data.length > 0) { // Add check here
      ds.push({label:sc.label, data: alignSeries(xMonths, sc.data.map(x=>({x:x.date.slice(0,7), y:x.value}))), yAxisID:'y1', borderColor:colors[(i)%colors.length], backgroundColor:'transparent', tension:.15});
    }
  }); if(chartScenario) chartScenario.destroy(); chartScenario=new Chart(ctx,{ type:'line', data:{labels:chartLabels, datasets:ds}, options:{ interaction:{mode:'nearest',intersect:false}, scales:{ y1:{type:'linear',position:'left',title:{display:true,text:'€ (Scénarios)'}} }, plugins:{legend:{position:'top'}} }}); }
let chartIndices;
function renderIndicesChart(xMonths, { indices, ucs }, chartLabels) {
    const ctx = byId('chart-indices').getContext('2d');
    if (!ctx) return;
    const colors = ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#22d3ee', '#a78bfa', '#ef4444', '#10b981', '#eab308', '#94a3b8', '#fb7185', '#14b8a6'];
    const ds = [];

    const createNormalizedDataset = (label, series, color) => {
        if (!series || series.length === 0) return null;
        
        const mappedSeries = series.map(x => ({ x: x.date.slice(0, 7), y: x.close }));
        const alignedData = alignSeries(xMonths, mappedSeries);
        
        const firstValue = alignedData.find(y => y !== null && y > 0);
        if (firstValue === undefined) return null;

        const normalizedData = alignedData.map(y => (y !== null && firstValue) ? (y / firstValue * 100) : null);

        return {
            label: label,
            data: normalizedData,
            yAxisID: 'y1',
            borderColor: color,
            backgroundColor: 'transparent',
            tension: .15
        };
    };

    indices.forEach((it, i) => {
        const dataset = createNormalizedDataset(it.label, it.series, colors[i]);
        if (dataset) ds.push(dataset);
    });

    ucs.forEach((uc, i) => {
        const dataset = createNormalizedDataset(uc.name || uc.isin, uc.raw_series, colors[(i + indices.length) % colors.length]);
        if (dataset) ds.push(dataset);
    });

    if (chartIndices) chartIndices.destroy();
    chartIndices = new Chart(ctx, {
        type: 'line',
        data: { labels: chartLabels, datasets: ds },
        options: {
            spanGaps: true, // connect lines over null points
            interaction: { mode: 'index', intersect: false },
            scales: {
                y1: { 
                    type: 'linear', 
                    position: 'left', 
                    title: { display: true, text: 'Performance (base 100)' }
                }
            },
            plugins: { legend: { position: 'top' } }
        }
    });
}

// Run & handlers
function updateStateFromUI() {
    state.euro.feeIn = +(byId('feeInEuro')?.value || 0);
    state.fees.mgmtEuro = +(byId('feeMgmtEuro')?.value || 0);
    state.fees.mgmtUC = +(byId('feeMgmtUC')?.value || 0);
    $$('.scenario').forEach((box,idx)=>{
      const s=state.scenarios[idx];
      if (!s) return;

      const startDate = box.querySelector('.s-date');
      if (startDate) s.start = startDate.value || "";

      const init = box.querySelector('.s-init');
      if (init) s.init = +init.value || 0;
      
      const prog = box.querySelector('.s-prog');
      if (prog) s.prog = +prog.value || 0;

      const freq = box.querySelector('.s-freq');
      if (freq) s.freq = freq.value;

      const progStart = box.querySelector('.s-prog-start');
      if (progStart) s.progStart = progStart.value || '';

      const progEnd = box.querySelector('.s-prog-end');
      if (progEnd) s.progEnd = progEnd.value || dayjs().format('YYYY-MM-DD');

      const months = box.querySelector('.s-months');
      if (months) s.months = +months.value || 0;

      const euroAmount = box.querySelector('.s-euro-amount');
      if (euroAmount) s.euroAmount = +euroAmount.value || 0;
    });
}

async function runSimulation(){
  try{
    updateStateFromUI();
    save();

    const dataPromises = [
      fetchIndexData('^FCHI'), // CAC
      fetchIndexData('^GSPC')  // S&P 500
    ];
    
    const ucPromises = state.ucs.map(uc => {
        return fetchBestUCData(uc.ticker).then(series => {
          uc.raw_series = series; // Store raw series for charting
          uc.series = toMonthlyReturns(series); // Store returns for simulation
          return uc;
        })
    });

    const [cacData, spxData] = await Promise.all(dataPromises);
    await Promise.all(ucPromises);

    console.log('CAC after fetch:', cacData);
    console.log('SPX after fetch:', spxData);

    const rCAC = toMonthlyReturns(cacData), rSPX = toMonthlyReturns(spxData);
    const rByUC={};
    for(const uc of state.ucs){
      if(uc.series){
        const m=new Map(uc.series.map(x=>[x.date.slice(0,7), x.r]));
        rByUC[ucKey(uc)] = m;
      }
    }
    
    // --- Date Axis Calculation ---
    // Axe de temps unifié, basé sur la date de simulation la plus précoce
    const scenarioStartDates = state.scenarios
      .map(s => s.start)
      .filter(Boolean); // Filtre les dates vides
      
    if (scenarioStartDates.length === 0) scenarioStartDates.push(dayjs().format('YYYY-MM-DD'));
    const allMonths = mkMonthAxis(scenarioStartDates);
    // --- End Date Axis Calculation ---

    const euroByYear = Object.fromEntries(state.euro.rates.map(x=>[x.year, +x.rate||0]));
    const res=[];
    for(let i=0;i<3;i++){
      res.push({label:`Scénario ${i+1}`, data: simulateScenario(state.scenarios[i], allMonths, rByUC, euroByYear, state.euro.feeIn, state.fees)});
      const rCACmap=new Map(rCAC.map(x=>[x.date.slice(0,7),x.r]));
      const cacAlloc = {'Fonds_Euro':0,'__IDX__CAC40':100};
      res.push({label:`Scénario ${i+1} (si CAC40)`, data: simulateScenario({...state.scenarios[i], allocInit:cacAlloc, allocProg:cacAlloc}, allMonths, {'__IDX__CAC40': rCACmap}, euroByYear, state.euro.feeIn, state.fees)});
      const rSPXmap=new Map(rSPX.map(x=>[x.date.slice(0,7),x.r]));
      const spxAlloc = {'Fonds_Euro':0,'__IDX__SP500':100};
      res.push({label:`Scénario ${i+1} (si S&P500)`, data: simulateScenario({...state.scenarios[i], allocInit:spxAlloc, allocProg:spxAlloc}, allMonths, {'__IDX__SP500': rSPXmap}, euroByYear, state.euro.feeIn, state.fees)});
    }
    
    const chartLabels = allMonths.map(d=>d.format('MM-YYYY'));
    
    renderScenarioChart(
      allMonths,
      { scenarios: res },
      chartLabels
    );

    renderIndicesChart(
      allMonths,
      { indices:[ {label:'CAC40', series:cacData}, {label:'S&P500', series:spxData} ], ucs: state.ucs },
      chartLabels
    );
  }catch(e){ console.error('Run failed', e); }
}

async function searchUC(query) {
    if (!query || query.length < 3) {
        byId('ucSearchResults').innerHTML = '';
        return;
    }
    try {
        const results = await fetchData('eod_search', query);
        const resultsDiv = byId('ucSearchResults');
        resultsDiv.innerHTML = '';
        if (results && results.length > 0) {
            results.slice(0, 10).forEach(item => {
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.textContent = `${item.Name} (${item.Code}) [${item.Exchange}]`;
                div.onclick = () => {
                    const newUc = { name: item.Name, ticker: `${item.Code}.${item.Exchange}` };
                    if (!state.ucs.some(uc => uc.ticker === newUc.ticker)) {
                        state.ucs.push(newUc);
                        addUcToSelectedTable(newUc);
                        buildAllAlloc();
                        save();
                    }
                    byId('ucSearch').value = '';
                    resultsDiv.innerHTML = '';
                };
                resultsDiv.appendChild(div);
            });
        } else {
            resultsDiv.textContent = 'Aucun résultat';
        }
    } catch (error) {
        console.error('Error searching UCs:', error);
        byId('ucSearchResults').textContent = 'Erreur de recherche';
    }
}


function attachHandlers(){ byId('addRate')?.addEventListener('click', ()=>{ state.euro.rates.push({year: dayjs().year(), rate:2}); buildEuroRates(); save(); });
  byId('ucSearch')?.addEventListener('input', debounce(e => searchUC(e.target.value), 300));
  byId('run')?.addEventListener('click', runSimulation);
  byId('export')?.addEventListener('click', ()=>{ updateStateFromUI(); const data=JSON.stringify(state,null,2); const blob=new Blob([data],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`etude_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); });
  byId('import')?.addEventListener('change', async e=>{ const f=e.target.files?.[0]; if(!f) return;
  try{
    const text=await f.text();
    const obj=JSON.parse(text);
    Object.assign(state, obj);
    save();
    init(true);
  }catch{
    alert('Fichier JSON invalide');
  }
});
}

function buildDefaults(){ if(!Array.isArray(state.euro.rates)) state.euro.rates=[]; if(state.euro.rates.length===0){ const y=dayjs().year(); state.euro.rates=[{year:y-1,rate:2},{year:y,rate:2}]; } }
function populateUIFromState() {
    byId('feeInEuro').value = state.euro.feeIn || 0;
    byId('feeMgmtEuro').value = state.fees.mgmtEuro || 0;
    byId('feeMgmtUC').value = state.fees.mgmtUC || 0;
    $$('.scenario').forEach((box,idx)=>{
      const s=state.scenarios[idx];
      if (!s) return;

      const startDate = box.querySelector('.s-date');
      if (startDate) startDate.value = s.start || "";

      const init = box.querySelector('.s-init');
      if (init) init.value = s.init || 0;
      
      const prog = box.querySelector('.s-prog');
      if (prog) prog.value = s.prog || 0;

      const freq = box.querySelector('.s-freq');
      if (freq) freq.value = s.freq;

      const progStart = box.querySelector('.s-prog-start');
      if (progStart) progStart.value = s.progStart || '';

      const progEnd = box.querySelector('.s-prog-end');
      if (progEnd) progEnd.value = s.progEnd || '';

      const months = box.querySelector('.s-months');
      if (months) months.value = s.months || 0;

      const euroAmount = box.querySelector('.s-euro-amount');
      if (euroAmount) euroAmount.value = s.euroAmount || 0;
    });
    buildEuroRates(); // Rebuild euro rates UI
    buildSelectedUcTable(); // Rebuild selected UC table UI
    buildAllAlloc(); // Rebuild allocation UI
}

function init(skipAttach){ load(); buildDefaults(); populateUIFromState(); if(!skipAttach) attachHandlers(); }

document.addEventListener('DOMContentLoaded', ()=> init(false));
