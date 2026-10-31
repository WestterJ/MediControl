'use strict';
// Cadastro de medicamentos

const modalMed = $('#modal-med');
$('#btn-novo-med').onclick = () => {
  $('#modal-med-title').textContent = "Novo Medicamento";
  $('#med-id').value = ''; $('#med-nome').value = '';
  $('#med-dosagem').value = ''; $('#med-obs').value = '';
  modalMed.showModal();
};

window.editarMed = id => {
  const m = state.medicamentos.find(x => x.id === id);
  if(!m) return;
  $('#modal-med-title').textContent = "Editar Medicamento";
  $('#med-id').value = m.id; $('#med-nome').value = m.nome;
  $('#med-dosagem').value = m.dosagem; $('#med-obs').value = m.obs || '';
  modalMed.showModal();
};

window.excluirMed = id => {
  // Check se está em rotinas
  if(state.rotinas.some(r => r.medId === id)) {
    showToast("Não é possível excluir: Medicamento possui rotinas ativas.");
    return;
  }
  customConfirm("Excluir", "Remover este medicamento?", () => {
    marcarRemovido(id); state.medicamentos = state.medicamentos.filter(x => x.id !== id);
    saveCloud(); renderMeds();
  });
};

$('#modal-med-close').onclick = () => modalMed.close();
$('#modal-med-cancel').onclick = () => modalMed.close();
$('#form-med').onsubmit = e => {
  e.preventDefault();
  const id = $('#med-id').value;
  const payload = {
    updatedAt: new Date().toISOString(),
    id: id || novoId('m'),
    nome: $('#med-nome').value.trim(),
    dosagem: $('#med-dosagem').value.trim(),
    obs: $('#med-obs').value.trim()
  };
  if(id) {
    const idx = state.medicamentos.findIndex(x => x.id === id);
    if(idx>=0) state.medicamentos[idx] = payload;
  } else { state.medicamentos.push(payload); }
  saveCloud(); renderMeds(); modalMed.close(); showToast("Medicamento salvo.");
};

function renderMeds() {
  const tbody = $('#table-meds-body');
  if(state.medicamentos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Nenhum medicamento cadastrado.</td></tr>`;
    return;
  }
  tbody.innerHTML = state.medicamentos.sort((a,b)=>a.nome.localeCompare(b.nome)).map(m => `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100 last:border-0">
      <td class="p-4 font-bold text-teal-800">${esc(m.nome)}</td>
      <td class="p-4 text-slate-700">${esc(m.dosagem)}</td>
      <td class="p-4 text-slate-500 text-xs">${esc(m.obs || '-')}</td>
      <td class="p-4 text-center whitespace-nowrap">
        <button class="bg-sky-50 text-sky-600 px-3 py-1 rounded hover:bg-sky-100 mr-2 font-medium" onclick="window.editarMed('${m.id}')">Editar</button>
        <button class="bg-red-50 text-red-600 px-3 py-1 rounded hover:bg-red-100 font-medium" onclick="window.excluirMed('${m.id}')">Excluir</button>
      </td>
    </tr>
  `).join('');
}
