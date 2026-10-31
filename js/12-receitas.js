'use strict';
// Módulo Receitas: cadastro de receitas (cabeçalho + medicamentos) e histórico de medicamentos receitados.
// state.receitas = [{id, data, paciente, medico, crm, hospital, tipo, observacoes, updatedAt,
//                    itens:[{id, nome, dosagem, quantidade, posologia, dias, medId}]}]  (medId = medicamento do app, opcional)
const receitaModal = $('#modal-receita');
const normTexto = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const listaReceitas = () => state.receitas || (state.receitas = []);

function adicionarDias(dataStr, n) { const d = new Date(dataStr + 'T00:00:00'); d.setDate(d.getDate() + n); return dataLocalStr(d); }

function statusTratamento(r, it) {
  const dias = Number(it.dias);
  if (!dias || !r.data) return null;
  const hoje = getHojeStr(), fim = adicionarDias(r.data, dias - 1);
  if (hoje > fim) return { txt: `Concluído em ${formatDataBR(fim)}`, cls: 'bg-slate-100 text-slate-600' };
  if (hoje < r.data) return { txt: `Começa em ${formatDataBR(r.data)}`, cls: 'bg-amber-100 text-amber-800' };
  return { txt: `Em andamento · dia ${diffDias(r.data, hoje) + 1} de ${dias}`, cls: 'bg-emerald-100 text-emerald-800' };
}

// Sugere o medicamento do app pelo primeiro nome (ex.: "Azitromicina" -> "Azitromicina (Amanda)").
function vincularMed(nome) {
  const n = normTexto(nome).split(' ')[0];
  if (n.length < 4) return '';
  const m = state.medicamentos.find(m => normTexto(m.nome).startsWith(n));
  return m ? m.id : '';
}

const campoItem = (rot, f, v, ph, extra = '') => `<label class="text-xs font-semibold text-slate-600 ${extra}">${rot}<input data-f="${f}" value="${esc(v)}" placeholder="${ph}" class="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-normal"></label>`;
const opcoesMed = sel => '<option value="">— sem vínculo —</option>' + state.medicamentos.map(m => `<option value="${esc(m.id)}"${m.id === sel ? ' selected' : ''}>${esc(m.nome)}</option>`).join('');

function itemHtml(it = {}) {
  return `<div data-item="${esc(it.id || '')}" class="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2">
    <div class="flex justify-between items-center"><span class="text-xs font-bold text-violet-900">Medicamento</span><button type="button" onclick="this.closest('[data-item]').remove()" class="text-xs text-red-600 font-semibold">Remover</button></div>
    <div class="grid grid-cols-2 gap-2">
      ${campoItem('Nome', 'nome', it.nome || '', 'Ex.: Azitromicina', 'col-span-2')}
      ${campoItem('Dosagem', 'dosagem', it.dosagem || '', 'Ex.: 500 mg')}
      ${campoItem('Quantidade', 'quantidade', it.quantidade || '', 'Ex.: 3 comprimidos')}
      ${campoItem('Posologia', 'posologia', it.posologia || '', 'Ex.: 1 comprimido, 1 vez ao dia', 'col-span-2')}
      ${campoItem('Dias de uso', 'dias', it.dias || '', 'Ex.: 3')}
      <label class="text-xs font-semibold text-slate-600">Medicamento do app<select data-f="medId" class="mt-1 w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-normal">${opcoesMed(it.medId)}</select></label>
    </div></div>`;
}

function lerItensForm() {
  return [...document.querySelectorAll('#rec-itens [data-item]')].map(el => {
    const g = f => el.querySelector(`[data-f="${f}"]`).value.trim();
    return { id: el.dataset.item || novoId('ri'), nome: g('nome'), dosagem: g('dosagem'), quantidade: g('quantidade'), posologia: g('posologia'), dias: g('dias') ? Number(g('dias')) : null, medId: g('medId') || null };
  }).filter(i => i.nome);
}

function receitasFiltradas() {
  const q = normTexto($('#rec-busca').value), pac = $('#rec-paciente').value, de = $('#rec-de').value, ate = $('#rec-ate').value;
  return listaReceitas().filter(r => {
    const tudo = normTexto([r.paciente, r.medico, r.crm, r.hospital, r.tipo, r.observacoes, formatDataBR(r.data)].concat((r.itens || []).map(i => [i.nome, i.dosagem, i.posologia].join(' '))).join(' '));
    return (!q || tudo.includes(q)) && (!pac || r.paciente === pac) && (!de || r.data >= de) && (!ate || r.data <= ate);
  }).sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

function cartaoReceita(r) {
  const itens = (r.itens || []).map(it => {
    const st = statusTratamento(r, it), med = state.medicamentos.find(m => m.id === it.medId);
    return `<li class="py-2 border-t border-slate-100 first:border-0">
      <div class="flex flex-wrap items-center gap-2"><strong class="text-slate-800">${esc(it.nome)}</strong><span class="text-sm text-slate-600">${esc(it.dosagem)}</span>${st ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.cls}">${esc(st.txt)}</span>` : ''}</div>
      <p class="text-sm text-slate-600">${esc(it.posologia)}${it.dias ? ` · ${it.dias} dia(s)` : ''}${it.quantidade ? ` · ${esc(it.quantidade)}` : ''}</p>
      ${med ? `<p class="text-xs text-teal-700">Vinculado a: ${esc(med.nome)}</p>` : ''}</li>`;
  }).join('');
  return `<article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap justify-between gap-2">
      <div><h3 class="font-bold text-slate-800">${formatDataBR(r.data)} · ${esc(r.paciente)}</h3><p class="text-xs text-slate-500">${[r.medico, r.crm, r.hospital, r.tipo].filter(Boolean).map(esc).join(' · ')}</p></div>
      <div class="flex gap-2"><button type="button" onclick="window.editarReceita('${esc(r.id)}')" class="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold">Editar</button><button type="button" onclick="window.excluirReceita('${esc(r.id)}')" class="px-3 py-1.5 border border-red-300 text-red-700 rounded-lg text-xs font-semibold">Excluir</button></div>
    </div><ul class="mt-2">${itens}</ul>${r.observacoes ? `<p class="mt-2 text-xs text-slate-500">📝 ${esc(r.observacoes)}</p>` : ''}</article>`;
}

function renderReceitas() {
  const lista = $('#receitas-lista'); if (!lista) return;
  const pacientes = [...new Set(listaReceitas().map(r => r.paciente).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const sel = $('#rec-paciente'), atual = sel.value;
  sel.innerHTML = '<option value="">Todos</option>' + pacientes.map(p => `<option${p === atual ? ' selected' : ''}>${esc(p)}</option>`).join('');
  $('#rec-pacientes-lista').innerHTML = pacientes.map(p => `<option value="${esc(p)}">`).join('');
  const rows = receitasFiltradas(), nMeds = rows.reduce((s, r) => s + (r.itens || []).length, 0);
  $('#rec-resultados').textContent = `${rows.length} receita(s) · ${nMeds} medicamento(s) receitado(s)`;
  lista.innerHTML = rows.length ? rows.map(cartaoReceita).join('') : '<p class="text-sm text-slate-500">Nenhuma receita cadastrada com estes filtros.</p>';
  const linhas = rows.flatMap(r => (r.itens || []).map(it => ({ r, it })));
  $('#rec-historico-body').innerHTML = linhas.length ? linhas.map(({ r, it }) => `<tr class="border-t border-slate-100"><td class="py-2 pr-3 whitespace-nowrap">${formatDataBR(r.data)}</td><td class="py-2 pr-3 font-semibold">${esc(it.nome)} <span class="font-normal text-slate-500">${esc(it.dosagem)}</span></td><td class="py-2 pr-3">${esc(it.posologia)}</td><td class="py-2 pr-3">${it.dias || ''}</td><td class="py-2 pr-3">${esc(r.paciente)}</td><td class="py-2">${esc(r.medico)}</td></tr>`).join('') : '<tr><td colspan="6" class="py-3 text-slate-500">Sem registros.</td></tr>';
}

function abrirReceita(r) {
  const novo = !r;
  r = r || { data: getHojeStr(), tipo: 'Simples', itens: [{}] };
  $('#modal-receita-title').textContent = novo ? 'Nova receita' : 'Editar receita';
  $('#rec-id').value = r.id || '';
  [['rec-data', 'data'], ['rec-paciente-nome', 'paciente'], ['rec-medico', 'medico'], ['rec-crm', 'crm'], ['rec-hospital', 'hospital'], ['rec-tipo', 'tipo'], ['rec-observacoes', 'observacoes']].forEach(([id, k]) => { $('#' + id).value = r[k] || ''; });
  $('#rec-itens').innerHTML = (r.itens && r.itens.length ? r.itens : [{}]).map(itemHtml).join('');
  $('#rec-arquivo').value = '';
  $('#rec-ia-status').textContent = 'A IA preenche os campos a partir da foto; confira e corrija tudo antes de salvar.';
  receitaModal.showModal();
}

$('#btn-nova-receita').onclick = () => abrirReceita();
$('#btn-rec-add-item').onclick = () => $('#rec-itens').insertAdjacentHTML('beforeend', itemHtml({}));
$('#modal-receita-close').onclick = $('#modal-receita-cancel').onclick = () => receitaModal.close();
['rec-busca', 'rec-paciente', 'rec-de', 'rec-ate'].forEach(id => { $('#' + id).addEventListener('input', renderReceitas); });
$('#btn-rec-limpar').onclick = () => { ['rec-busca', 'rec-paciente', 'rec-de', 'rec-ate'].forEach(id => { $('#' + id).value = ''; }); renderReceitas(); };

$('#btn-rec-ler-ia').onclick = () => iniciarLeituraIA({
  arquivo: $('#rec-arquivo').files[0], botao: $('#btn-rec-ler-ia'), cancelar: $('#btn-rec-cancelar-ia'), status: $('#rec-ia-status'),
  aoConcluir: x => {
    [['rec-data', 'data'], ['rec-paciente-nome', 'paciente'], ['rec-medico', 'medico'], ['rec-crm', 'crm'], ['rec-hospital', 'hospital'], ['rec-observacoes', 'observacoes']].forEach(([id, k]) => { if (x[k]) $('#' + id).value = x[k]; });
    $('#rec-itens').innerHTML = x.itens.map(i => itemHtml({ ...i, medId: vincularMed(i.nome) })).join('');
  }
});

$('#form-receita').onsubmit = e => {
  e.preventDefault();
  const itens = lerItensForm();
  if (!itens.length) { showToast('Inclua ao menos um medicamento na receita.'); return; }
  const id = $('#rec-id').value || novoId('rc'), v = i => $('#' + i).value.trim();
  const rec = { id, data: $('#rec-data').value, paciente: v('rec-paciente-nome'), medico: v('rec-medico'), crm: v('rec-crm'), hospital: v('rec-hospital'), tipo: $('#rec-tipo').value, observacoes: v('rec-observacoes'), itens, updatedAt: new Date().toISOString() };
  const i = listaReceitas().findIndex(r => r.id === id);
  if (i >= 0) state.receitas[i] = rec; else state.receitas.push(rec);
  saveCloud(); renderReceitas(); receitaModal.close(); showToast('Receita salva.');
};

window.editarReceita = id => { const r = listaReceitas().find(x => x.id === id); if (r) abrirReceita(r); };
window.excluirReceita = id => customConfirm('Excluir receita', 'Deseja excluir esta receita e a lista de medicamentos dela? Os medicamentos e rotinas do app não são apagados.', () => {
  marcarRemovido(id); state.receitas = listaReceitas().filter(r => r.id !== id); saveCloud(); renderReceitas();
});
