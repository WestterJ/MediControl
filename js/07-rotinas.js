'use strict';
// Cadastro de rotinas

const modalRotina = $('#modal-rotina');

function populateMedSelect() {
  const sel = $('#rotina-medId');
  sel.innerHTML = state.medicamentos.map(m => `<option value="${m.id}">${esc(m.nome)} (${esc(m.dosagem)})</option>`).join('');
  if(state.medicamentos.length===0) sel.innerHTML = `<option value="">Cadastre um medicamento primeiro</option>`;
}

$('#rotina-frequencia').onchange = e => {
  const f = e.target.value;
  $('#rotina-diaSemana-box').style.display = f === 'semanal' ? 'block' : 'none';
  const temIntervalo = f === 'horas' || f === 'dias';
  $('#rotina-intervalo-box').style.display = temIntervalo ? 'block' : 'none';
  $('#rotina-intervalo').required = temIntervalo;
  $('#rotina-intervalo').max = f === 'horas' ? 72 : 365;
  if (f === 'horas') {
    $('#rotina-intervalo-label').textContent = 'A cada quantas horas?';
    $('#rotina-intervalo-ajuda').textContent = 'As doses seguem de forma contínua a partir do horário da 1ª dose, inclusive de madrugada (ex.: 8 h a partir das 08:00 → 08:00, 16:00, 00:00).';
    $('#rotina-horario-label').textContent = 'Horário da 1ª dose';
  } else {
    $('#rotina-intervalo-label').textContent = 'A cada quantos dias?';
    $('#rotina-intervalo-ajuda').textContent = 'Ex.: 4 = toma no dia de início e depois a cada 4 dias.';
    $('#rotina-horario-label').textContent = 'Horário';
  }
  if (temIntervalo && !$('#rotina-intervalo').value) $('#rotina-intervalo').value = f === 'horas' ? 8 : 2;
};

$('#btn-nova-rotina').onclick = () => {
  if(state.medicamentos.length === 0) { showToast("Cadastre um medicamento antes de criar rotinas!"); return; }
  $('#modal-rotina-title').textContent = "Nova Rotina";
  $('#rotina-id').value = ''; 
  populateMedSelect();
  $('#rotina-horario').value = '08:00';
  $('#rotina-dataInicio').value = getHojeStr();
  $('#rotina-dataFim').value = '';
  $('#rotina-intervalo').value = '';
  $('#rotina-frequencia').value = 'diario';
  $('#rotina-frequencia').dispatchEvent(new Event('change'));
  modalRotina.showModal();
};

window.editarRotina = id => {
  const r = state.rotinas.find(x => x.id === id);
  if(!r) return;
  $('#modal-rotina-title').textContent = "Editar Rotina";
  $('#rotina-id').value = r.id;
  populateMedSelect();
  $('#rotina-medId').value = r.medId;
  $('#rotina-horario').value = r.horario;
  $('#rotina-dataInicio').value = r.dataInicio;
  $('#rotina-dataFim').value = r.dataFim || '';
  $('#rotina-intervalo').value = r.intervalo || '';
  $('#rotina-frequencia').value = r.frequencia;
  $('#rotina-frequencia').dispatchEvent(new Event('change'));
  if(r.frequencia === 'semanal') $('#rotina-diaSemana').value = r.diaSemana;
  modalRotina.showModal();
};

window.excluirRotina = id => {
  customConfirm("Excluir Rotina", "Parar de ser lembrado desta rotina?", () => {
    marcarRemovido(id); state.rotinas = state.rotinas.filter(x => x.id !== id);
    saveCloud(); renderRotinas(); refreshDashboard();
  });
};

$('#modal-rotina-close').onclick = () => modalRotina.close();
$('#modal-rotina-cancel').onclick = () => modalRotina.close();
$('#form-rotina').onsubmit = e => {
  e.preventDefault();
  if(!$('#rotina-medId').value) return;
  const id = $('#rotina-id').value;
  const freq = $('#rotina-frequencia').value;
  const dataInicio = $('#rotina-dataInicio').value;
  const dataFim = $('#rotina-dataFim').value || null;
  if (dataFim && dataFim < dataInicio) { showToast('A data de término não pode ser anterior à data de início.'); return; }
  let intervalo = null;
  if (freq === 'horas' || freq === 'dias') {
    intervalo = parseInt($('#rotina-intervalo').value, 10);
    const max = freq === 'horas' ? 72 : 365;
    if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > max) { showToast(`Informe um intervalo entre 1 e ${max}.`); return; }
  }
  const payload = {
    updatedAt: new Date().toISOString(),
    id: id || novoId('r'),
    medId: $('#rotina-medId').value,
    horario: $('#rotina-horario').value,
    dataInicio,
    dataFim,
    frequencia: freq,
    intervalo,
    diaSemana: freq === 'semanal' ? parseInt($('#rotina-diaSemana').value) : null
  };
  if(id) {
    const idx = state.rotinas.findIndex(x => x.id === id);
    if(idx>=0) state.rotinas[idx] = payload;
  } else { state.rotinas.push(payload); }
  saveCloud(); renderRotinas(); refreshDashboard(); modalRotina.close(); showToast("Rotina salva.");
};

function traduzirFrequencia(r) {
  if(r.frequencia==='diario') return "Todos os dias";
  if(r.frequencia==='dsdn') return "Dia sim, dia não";
  if(r.frequencia==='1s2n') return "1 dia sim, 2 dias não";
  if(r.frequencia==='horas') return `A cada ${r.intervalo} hora${r.intervalo===1?'':'s'}`;
  if(r.frequencia==='dias') return `A cada ${r.intervalo} dias`;
  if(r.frequencia==='semanal') {
    const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    return "Semanal (" + dias[r.diaSemana] + ")";
  }
  return r.frequencia;
}

function renderRotinas() {
  const tbody = $('#table-rotinas-body');
  if(state.rotinas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500">Nenhuma rotina configurada.</td></tr>`;
    return;
  }
  // Join rotinas com meds
  const rows = state.rotinas.map(r => {
    const m = state.medicamentos.find(x => x.id === r.medId) || {nome:'Medicamento excluído', dosagem:''};
    return { ...r, medNome: m.nome, medDosagem: m.dosagem };
  }).sort((a,b) => a.horario.localeCompare(b.horario));

  tbody.innerHTML = rows.map(r => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100 last:border-0">
      <td class="p-4"><strong class="text-indigo-800">${esc(r.medNome)}</strong> <span class="text-xs text-slate-500">(${esc(r.medDosagem)})</span></td>
      <td class="p-4 text-center font-bold text-slate-700">${formatarHora(r.horario)}</td>
      <td class="p-4 text-slate-700">${traduzirFrequencia(r)}</td>
      <td class="p-4 text-center text-slate-500">${formatDataBR(r.dataInicio)}</td>
      <td class="p-4 text-center">${r.dataFim ? `<span class="${r.dataFim < getHojeStr() ? 'text-red-600 font-semibold' : 'text-slate-500'}">${formatDataBR(r.dataFim)}${r.dataFim < getHojeStr() ? ' · encerrada' : ''}</span>` : '<span class="text-emerald-700 font-medium">Contínuo</span>'}</td>
      <td class="p-4 text-center whitespace-nowrap">
        <button class="bg-sky-50 text-sky-600 px-3 py-1 rounded hover:bg-sky-100 mr-2 font-medium" onclick="window.editarRotina('${r.id}')">Editar</button>
        <button class="bg-red-50 text-red-600 px-3 py-1 rounded hover:bg-red-100 font-medium" onclick="window.excluirRotina('${r.id}')">Excluir</button>
      </td>
    </tr>
  `).join('');
}
