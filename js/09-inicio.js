'use strict';
// Módulo Início: doses de hoje/amanhã, semana e indicadores

function getMedicamentosDoDia(dataStr) {
  const medsDoDia = [];
  state.rotinas.forEach(r => {
    const m = state.medicamentos.find(x => x.id === r.medId);
    if (!m) return;
    dosesDoDia(r, dataStr).forEach(slot => {
      medsDoDia.push({ ...r, horario: slot, slot, medObj: m, tomado: doseTomada(r, dataStr, slot) });
    });
  });
  return medsDoDia.sort((a,b) => a.horario.localeCompare(b.horario));
}

window.toggleTomado = function(rotinaId, dataStr, elCheckbox, slot) {
  const isChecked = elCheckbox.checked;
  const rotina = state.rotinas.find(r => r.id === rotinaId);
  const porDose = !!rotina && rotina.frequencia === 'horas';
  const casa = h => h.rotinaId === rotinaId && h.data === dataStr && (!porDose || h.horaPrevista === slot);
  if (isChecked) {
    // Registrar no histórico
    const horaStr = new Date().toTimeString().split(' ')[0];
    const reg = { id: novoId('h'), rotinaId, data: dataStr, horaTomado: horaStr };
    if (porDose) reg.horaPrevista = slot;
    state.historico.push(reg);
    elCheckbox.closest('.med-card').classList.add('opacity-60', 'bg-emerald-50');
  } else {
    // Remover do histórico
    marcarRemovido(...state.historico.filter(casa).map(h => h.id));
    state.historico = state.historico.filter(h => !casa(h));
    elCheckbox.closest('.med-card').classList.remove('opacity-60', 'bg-emerald-50');
  }
  saveCloud(); // Auto save
  renderHistoricoRotinas();
  renderKpis();
};

function renderDayList(containerId, dataStr, showCheckbox = true) {
  const meds = getMedicamentosDoDia(dataStr);
  const c = $('#' + containerId);
  
  if (meds.length === 0) {
    c.innerHTML = `<div class="p-4 bg-slate-50 text-slate-500 rounded-xl text-center text-sm border border-slate-200 border-dashed">Nenhum medicamento agendado para este dia.</div>`;
    return;
  }

  c.innerHTML = meds.map(m => {
    const cardClasses = m.tomado ? "med-card flex items-center p-4 bg-emerald-50 border border-emerald-200 rounded-xl transition opacity-60" : "med-card flex items-center p-4 bg-white border border-slate-200 rounded-xl transition shadow-sm";
    const checkHTML = showCheckbox 
      ? `<input type="checkbox" class="med-checkbox shrink-0 ml-4" ${m.tomado?'checked':''} onchange="window.toggleTomado('${m.id}', '${dataStr}', this, '${m.slot}')">`
      : `<div class="shrink-0 ml-4 bg-slate-100 text-slate-400 p-1.5 rounded-lg text-xs font-bold">${formatarHora(m.horario)}</div>`;

    return `
      <label class="${cardClasses} cursor-pointer hover:shadow-md">
        <div class="bg-indigo-100 text-indigo-700 font-bold text-lg px-3 py-2 rounded-lg mr-4 shrink-0">
          ${formatarHora(m.horario)}
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-slate-800 truncate">${esc(m.medObj.nome)}</div>
          <div class="text-sm text-slate-500 truncate">${esc(m.medObj.dosagem)} ${m.medObj.obs ? `• ${esc(m.medObj.obs)}` : ''}</div>
        </div>
        ${checkHTML}
      </label>
    `;
  }).join('');
}

function refreshDashboard() {
  const hojeObj = new Date();
  const amanhaObj = new Date(hojeObj);
  amanhaObj.setDate(amanhaObj.getDate() + 1);

  const hojeStr = dataLocalStr(hojeObj);
  const amanhaStr = dataLocalStr(amanhaObj);

  $('#data-hoje').textContent = formatDataBR(hojeStr);
  $('#data-amanha').textContent = formatDataBR(amanhaStr);

  renderDayList('lista-hoje', hojeStr, true);
  renderDayList('lista-amanha', amanhaStr, false);
  renderKpis();

  // Grid da Semana (Próximos 7 dias)
  const grid = $('#grid-semana');
  const diasNomes = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  let gridHTML = '';

  for(let i=0; i<7; i++) {
    const d = new Date(hojeObj);
    d.setDate(d.getDate() + i);
    const dStr = dataLocalStr(d);
    const diaTxt = i===0 ? 'Hoje' : i===1 ? 'Amanhã' : diasNomes[d.getDay()];
    
    const medsDay = getMedicamentosDoDia(dStr);
    let dots = medsDay.map(m => `<div class="text-xs truncate bg-indigo-50 text-indigo-700 mb-1 px-1.5 py-0.5 rounded border border-indigo-100" title="${m.medObj.nome}">${formatarHora(m.horario)} ${m.medObj.nome}</div>`).join('');
    if(medsDay.length===0) dots = `<div class="text-xs text-slate-400 italic mt-2">Livre</div>`;

    const isToday = i===0;
    gridHTML += `
      <div class="w-36 shrink-0 bg-white border ${isToday?'border-emerald-300':'border-slate-200'} rounded-xl p-3 flex flex-col shadow-sm">
        <div class="text-xs font-bold ${isToday?'text-emerald-600':'text-slate-500'} mb-1">${diaTxt}</div>
        <div class="text-sm font-bold text-slate-800 border-b pb-2 mb-2">${d.getDate()}/${(d.getMonth()+1).toString().padStart(2,'0')}</div>
        <div class="flex-1 overflow-y-auto max-h-32">
          ${dots}
        </div>
      </div>
    `;
  }
  grid.innerHTML = gridHTML;
}

// Indicadores do topo do Início (não obedecem a filtros; sempre se referem a hoje).
function renderKpis() {
  const el = $('#inicio-kpis'); if (!el) return;
  const agora = new Date();
  const hhmm = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
  const doses = getMedicamentosDoDia(getHojeStr());
  const pend = doses.filter(d => !d.tomado);
  const atras = pend.filter(d => d.horario.slice(0, 5) < hhmm).length;
  const prox = pend.find(d => d.horario.slice(0, 5) >= hhmm);
  const card = (rot, val, sub, cls) => `<div class="kpi-card ${cls || ''}"><span class="kpi-label">${rot}</span><strong class="kpi-value">${val}</strong><span class="kpi-sub">${sub}</span></div>`;
  el.innerHTML =
    card('Tomadas hoje', `${doses.length - pend.length}/${doses.length}`, doses.length ? 'doses do dia' : 'sem doses hoje') +
    card('Pendentes', pend.length, 'ainda hoje') +
    card('Atrasadas', atras, atras ? 'confira as doses' : 'tudo em dia', atras ? 'kpi-alerta' : '') +
    card('Próxima dose', prox ? prox.horario.slice(0, 5) : '—', prox ? esc(prox.medObj.nome) : 'nenhuma pendente');
}
