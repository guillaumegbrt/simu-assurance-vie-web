/* global Chart, dayjs */
// Bannière d'erreur pour debug
(function(){ window.addEventListener('error', e=>{ const b=document.getElementById('errorBanner'); if(b){ b.textContent = 'Erreur JavaScript: '+(e.message||''); b.style.display='block'; } console.error(e.error||e); }); })();
try{
  dayjs.extend(window.dayjs_plugin_utc);
  dayjs.extend(window.dayjs_plugin_customParseFormat);
  dayjs.extend(window.dayjs_plugin_isSameOrBefore);
}catch(e){ console.warn('Dayjs plugins', e); }

const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>Array.from(c.querySelectorAll(s)); const byId=id=>document.getElementById(id);

// Providers

function proxyUrl(url) {
  return url;
}

const EODProvider={ async fetchMonthly(ucIdentifier,key){ if(!key) return null; const url=`https://eodhistoricaldata.com/api/eod/${ucIdentifier}?api_token=${key}&period=m&fmt=json`; const r=await fetch(url); const j=await r.json(); console.log('EODProvider fetchMonthly - Symbol:', ucIdentifier, 'Response:', j); if(!Array.isArray(j)) return null; const series=j.map(x=>({date:x.date, close:x.adjusted_close})).filter(x=>x.date && Number.isFinite(x.close)); return series.sort((a,b)=>a.date.localeCompare(b.date)); }};

const AlphaVantageProvider = {
  async fetchMonthly(symbol, key) {
    if (!key) return null;
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${symbol}&apikey=${key}`;
    const r = await fetch(url);
    const j = await r.json();
    console.log('AlphaVantageProvider fetchMonthly - Symbol:', symbol, 'Response:', j);

    if (j['Error Message'] || !j['Monthly Adjusted Time Series']) {
      console.error('Alpha Vantage API Error:', j['Error Message']);
      return null;
    }

    const series = [];
    const timeSeries = j['Monthly Adjusted Time Series'];
    for (const date in timeSeries) {
      series.push({
        date: date,
        close: parseFloat(timeSeries[date]['5. adjusted close'])
      });
    }
    return series.sort((a, b) => a.date.localeCompare(b.date));
  }
};

// Parsing helpers (sans regex)
function splitLines(text){
  return text.split('\n');
}
function toMonthlyReturns(series){
  if (!series || series.length < 2) return []; // Handle null or insufficient data
  const out=[];
  for(let i=1;i<series.length;i++){ out.push({date:series[i].date, r: series[i].close/series[i-1].close - 1}); } return out;
}

// State
const state={ api:{ eodKey:'691add086f1621.85587257', alphaVantageKey: 'RCVYYB4UC60NM6NO' }, euro:{ feeIn:0, rates:[] }, ucs:[], scenarios:[ {start:'',init:10000,prog:0,freq:'Mensuel',progStart:'',progEnd:'',allocInit:{'Fonds_Euro': 100},allocProg:{}}, {start:'',init:1000,prog:100,freq:'Mensuel',progStart:'',progEnd:'',allocInit:{},allocProg:{}}, {start:'',init:10000,prog:100,freq:'Mensuel',progStart:'',progEnd:'',allocInit:{'Fonds_Euro': 100},allocProg:{},euroAmount:5000} ]};
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
      // Merge loadedState into state, handling nested objects
      Object.assign(state, loadedState); // Assign top-level properties
      if (loadedState.api) { // If API settings exist in loaded state
        Object.assign(state.api, loadedState.api); // Merge API settings
      }
      if (loadedState.euro) { // If Euro settings exist in loaded state
        Object.assign(state.euro, loadedState.euro); // Merge Euro settings
      }
    }catch{}
  }
}

// UI builders
function debounce(func, delay) { let timeout; return function(...args) { const context = this; clearTimeout(timeout); timeout = setTimeout(() => func.apply(context, args), delay); }; }
function buildEuroRates(){ const host=byId('euroRates'); host.innerHTML=''; const tbl=document.createElement('table'); tbl.innerHTML='<thead><tr><th>Année</th><th>Taux annuel net (%)</th><th></th></tr></thead><tbody></tbody>'; const tb=tbl.querySelector('tbody'); for(const row of state.euro.rates){ const tr=document.createElement('tr'); tr.innerHTML=`<td><input type="number" value="${row.year}" class="er-year"/></td><td><input type="number" step="0.01" value="${row.rate}" class="er-rate"/></td><td><button class="del" type="button">×</button></td>`; tb.appendChild(tr); tr.querySelector('.er-year').onchange=e=>{row.year=+e.target.value; save();}; tr.querySelector('.er-rate').onchange=e=>{row.rate=+e.target.value; save();}; tr.querySelector('.del').onclick=()=>{ state.euro.rates=state.euro.rates.filter(x=>x!==row); buildEuroRates(); save(); }; }
  host.appendChild(tbl); }

function setupUcSelection() {
    const ucSearch = byId('uc-search');
    const ucList = byId('uc-list');
    const addUcBtn = byId('add-uc-btn');
    const selectedUcList = byId('selected-uc-list');
    let searchTimeout;

    ucSearch.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const searchTerm = ucSearch.value;
            if (searchTerm.length < 3) {
                ucList.innerHTML = '<option disabled>Veuillez entrer au moins 3 caractères.</option>';
                return;
            }
            try {
                const response = await fetch(proxyUrl(`https://eodhistoricaldata.com/api/search/${searchTerm}?api_token=${state.api.eodKey}&fmt=json`));
                if (!response.ok) throw new Error('Failed to search for UCs');
                const results = await response.json();
                populateUcDropdown(results);
            } catch (error) {
                console.error('Failed to search UCs:', error);
                ucList.innerHTML = '<option disabled>Erreur lors de la recherche.</option>';
            }
        }, 500);
    });

    addUcBtn.addEventListener('click', () => {
        const selectedOption = ucList.options[ucList.selectedIndex];
        if (!selectedOption) return;

        const { name, isin, code, exchange } = selectedOption.dataset;
        if (!isin) {
            alert("Cette sélection n'a pas de code ISIN, elle ne peut pas être ajoutée.");
            return;
        }
        if (state.ucs.find(uc => uc.isin === isin)) {
            alert('Cette UC est déjà dans la liste.');
            return;
        }
        
        const uc = { isin, name, ticker: `${code}.${exchange}`, source: 'eod', series: null };
        state.ucs.push(uc);
        addUcToSelectedTable(uc);
        buildAllAlloc();
        save();
    });

    selectedUcList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-uc')) {
            const row = e.target.closest('tr');
            const isin = row.dataset.isin;
            state.ucs = state.ucs.filter(uc => uc.isin !== isin);
            // Also remove allocations for this UC
            state.scenarios.forEach(s => {
                delete s.allocInit[isin];
                delete s.allocProg[isin];
            });
            row.remove();
            buildAllAlloc();
            save();
        }
    });
}

function populateUcDropdown(results) {
    const ucList = byId('uc-list');
    ucList.innerHTML = '';
    if (!results || results.length === 0) {
        ucList.innerHTML = '<option disabled>Aucun résultat trouvé.</option>';
        return;
    }
    results.forEach(uc => {
        const option = document.createElement('option');
        option.value = uc.ISIN;
        option.textContent = `${uc.Name} (${uc.Code}, ${uc.Exchange}, ISIN: ${uc.ISIN || 'N/A'})`;
        option.dataset.name = uc.Name;
        option.dataset.isin = uc.ISIN;
        option.dataset.code = uc.Code;
        option.dataset.exchange = uc.Exchange;
        ucList.appendChild(option);
    });
}

function addUcToSelectedTable(uc) {
    const selectedUcList = byId('selected-uc-list');
    const tr = document.createElement('tr');
    tr.dataset.isin = uc.isin;
    tr.innerHTML = `
        <td>${uc.name} (${uc.isin})</td>
        <td><button class="remove-uc" type="button">×</button></td>
    `;
    selectedUcList.appendChild(tr);
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
      const label=uc.name||uc.isin||'UC';
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
      const label=uc.name||uc.isin||'UC';
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

// CSV upload
byId('csvUpload')?.addEventListener('change', async e=>{ const f=e.target.files?.[0]; if(!f) return; const text=await f.text(); const lines = splitLines(text.trim()); const [h, ...rows] = lines; const headers = h.toLowerCase().split(','); const iD = headers.indexOf('date'), iC=headers.indexOf('close'); const data = rows.map(r=>{ const cols=r.split(','); return {date: cols[iD], close: +cols[iC]}; }).filter(x=>x.date && Number.isFinite(x.close)); if(state.ucs.length===0){ alert('Ajoute d’abord une UC.'); return; } const uc=state.ucs[state.ucs.length-1]; uc.csvData=data; uc.source='upload'; if(!uc.name) uc.name='CSV import'; save(); buildUCTable(); buildAllAlloc(); });

function ucKey(uc){ return uc.ticker; }

// Simulation & chart
function monthDiff(a,b){ const da=dayjs(a), db=dayjs(b); return (db.year()-da.year())*12 + (db.month()-da.month()); }
function scheduleProg(freq){ return freq==='Mensuel'?1: freq==='Trimestriel'?3:12; }
function simulateScenario(s, allMonths, rByUC, euroRateByYear, feeInPct){
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

  let lastEuroReturnYear = -1; // To track when the last annual return was applied

  for(const d of allMonths){
    // 1. Apply returns to existing portfolio
    for (const key in portfolio) {
      if (key === 'Fonds_Euro') {
        if (d.month() === 0 && d.year() !== lastEuroReturnYear) { // If it's January and not applied this year yet
          const annualRate = (euroRateByYear[d.year()] ?? 0) / 100;
          portfolio[key] *= (1 + annualRate); // Apply full annual return
          lastEuroReturnYear = d.year();
        }
        // No monthly return for Euro fund in other months
      } else if (rByUC[key]) { // For UCs, apply monthly return
        const monthlyReturn = rByUC[key].get(d.format('YYYY-MM')) ?? 0;
        portfolio[key] *= (1 + monthlyReturn);
      }
    }

    // 2. Handle inflows
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

  let earliest = dayjs(allRelevantDates[0]);
  let latest = dayjs(allRelevantDates[0]);

  for (const dateStr of allRelevantDates) {
    const d = dayjs(dateStr);
    if (d.isBefore(earliest)) earliest = d;
    if (d.isAfter(latest)) latest = d;
  }

  const months = [];
  let currentMonth = earliest.startOf('month');
  while (currentMonth.isSameOrBefore(latest.startOf('month'))) {
    months.push(currentMonth);
    currentMonth = currentMonth.add(1, 'month');
  }
  return months;
}
let chart; function renderChart(xMonths,{indices,scenarios}, chartLabels){ const ctx=byId('chart').getContext('2d'); const colors=['#60a5fa','#34d399','#f472b6','#fbbf24','#22d3ee','#a78bfa','#ef4444','#10b981','#eab308','#94a3b8','#fb7185','#14b8a6']; const ds=[];   indices.forEach((it,i)=>{
    if (it.series && it.series.length > 0) { // Add check here
      ds.push({label:it.label, data: alignSeries(xMonths, it.series.map(x=>({x:x.date.slice(0,7), y:x.close}))), yAxisID:'y2', borderColor:colors[i], backgroundColor:'transparent', tension:.15});
    }
  });
  scenarios.forEach((sc,i)=>{
    if (sc.data && sc.data.length > 0) { // Add check here
      ds.push({label:sc.label, data: alignSeries(xMonths, sc.data.map(x=>({x:x.date.slice(0,7), y:x.value}))), yAxisID:'y1', borderColor:colors[(i+indices.length)%colors.length], backgroundColor:'transparent', tension:.15});
    }
  }); if(chart) chart.destroy(); chart=new Chart(ctx,{ type:'line', data:{labels:chartLabels, datasets:ds}, options:{ interaction:{mode:'nearest',intersect:false}, scales:{ y1:{type:'linear',position:'left',title:{display:true,text:'€ (Scénarios)'}}, y2:{type:'linear',position:'right',grid:{drawOnChartArea:false},title:{display:true,text:'Indice (niveau)'}} }, plugins:{legend:{position:'top'}} }}); }
function alignSeries(xMonths, pts){
  const map=new Map(pts.map(p=>[p.x,p.y]));
  return xMonths.map(m=> map.get(m.format('YYYY-MM')) ?? null);
}

// Run & handlers
function updateStateFromUI() {
    state.euro.feeIn = +(byId('feeInEuro')?.value || 0);
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

    // Fetch all required data
    console.log('Alpha Vantage API Key:', state.api.alphaVantageKey);
    const dataPromises = [
      AlphaVantageProvider.fetchMonthly('CAC40', state.api.alphaVantageKey), // CAC40
      EODProvider.fetchMonthly('GSPC.INDX', state.api.eodKey)  // S&P500 (reverted to EOD)
    ];
    for (const uc of state.ucs) {
      if (!uc.series) { // Fetch only if not already loaded
        dataPromises.push(EODProvider.fetchMonthly(uc.ticker, state.api.eodKey).then(series => {
          uc.series = toMonthlyReturns(series);
          return uc.series;
        }));
      }
    }
    const [cac, spx] = await Promise.all(dataPromises);
    console.log('CAC after fetch:', cac);
    console.log('SPX after fetch:', spx);

    const rCAC = toMonthlyReturns(cac), rSPX = toMonthlyReturns(spx);
    const rByUC={};
    for(const uc of state.ucs){
      if(uc.series){
        const m=new Map(uc.series.map(x=>[x.date.slice(0,7), x.r]));
        rByUC[ucKey(uc)] = m;
      }
    }
    // Collect all relevant dates
    const allRelevantDates = [];
    // Add dates from CAC, SPX
    if (cac) allRelevantDates.push(...cac.map(x => x.date));
    if (spx) allRelevantDates.push(...spx.map(x => x.date));
    // Add dates from UCs
    for (const uc of state.ucs) {
      if (uc.series) allRelevantDates.push(...uc.series.map(x => x.date));
    }
    // Add scenario start and end dates
    for (const s of state.scenarios) {
      if (s.start) allRelevantDates.push(s.start);
      if (s.progEnd) allRelevantDates.push(s.progEnd);
    }

    let allMonths = mkMonthAxis(allRelevantDates);

    const euroByYear = Object.fromEntries(state.euro.rates.map(x=>[x.year, +x.rate||0]));
    const res=[];
    for(let i=0;i<3;i++){
      res.push({label:`Scénario ${i+1}`, data: simulateScenario(state.scenarios[i], allMonths, rByUC, euroByYear, state.euro.feeIn)});
      const rCACmap=new Map(rCAC.map(x=>[x.date.slice(0,7),x.r]));
      const cacAlloc = {'Fonds_Euro':0,'__IDX__CAC40':100};
      res.push({label:`Scénario ${i+1} (si CAC40)`, data: simulateScenario({...state.scenarios[i], allocInit:cacAlloc, allocProg:cacAlloc}, allMonths, {'__IDX__CAC40': rCACmap}, euroByYear, state.euro.feeIn)});
      const rSPXmap=new Map(rSPX.map(x=>[x.date.slice(0,7),x.r]));
      const spxAlloc = {'Fonds_Euro':0,'__IDX__SP500':100};
      res.push({label:`Scénario ${i+1} (si S&P500)`, data: simulateScenario({...state.scenarios[i], allocInit:spxAlloc, allocProg:spxAlloc}, allMonths, {'__IDX__SP500': rSPXmap}, euroByYear, state.euro.feeIn)});
    }
    const chartLabels = allMonths.map(d=>d.format('MM-YYYY'));
    renderChart(
      allMonths, // Pass Day.js objects
      { indices:[ {label:'CAC40', series:cac}, {label:'S&P500', series:spx} ], scenarios: res },
      chartLabels // Pass formatted labels separately
    );
  }catch(e){ console.error('Run failed', e); }
}

function attachHandlers(){ byId('addRate')?.addEventListener('click', ()=>{ state.euro.rates.push({year: dayjs().year(), rate:2}); buildEuroRates(); save(); });
setupUcSelection();
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
    byId('feeInEuro').value = state.euro.feeIn || 0; // Set UI from loaded state
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
