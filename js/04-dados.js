'use strict';
// Carga do localStorage, backup JSON e reset

function loadLocalData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state.medicamentos = parsed.medicamentos || [];
      state.rotinas = parsed.rotinas || [];
      state.historico = parsed.historico || [];
      state.historicosMedicamentos = parsed.historicosMedicamentos || [];
    }
  } catch(e) {}
  updateCloudStatusPill();
}

$('#btn-exportar-json').onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); 
  a.download = `medicamentos_backup_${getHojeStr()}.json`;
  a.click();
  showToast("Backup exportado.");
};

$('#btn-importar-json').onclick = () => { $('#file-input-json').click(); };
$('#file-input-json').onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (parsed.medicamentos || parsed.rotinas) {
        state.medicamentos = parsed.medicamentos || [];
        state.rotinas = parsed.rotinas || [];
        state.historico = parsed.historico || [];
        state.historicosMedicamentos = parsed.historicosMedicamentos || [];
        saveCloud(); refreshAll(); showToast("Backup importado!");
      }
    } catch(err) { showToast("Arquivo inválido."); }
    e.target.value = '';
  };
  reader.readAsText(f);
};

$('#btn-resetar').onclick = () => {
  customConfirm('Apagar Dados', 'Apagar todos os medicamentos e rotinas? Esta ação não tem volta.', () => {
    state = { medicamentos: [], rotinas: [], historico: [], historicosMedicamentos: [] };
    saveCloud(); refreshAll(); showToast("Todos os dados apagados.");
  });
};
