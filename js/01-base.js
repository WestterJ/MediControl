'use strict';
// Utilidades, mensagens, confirmação, estado e chaves locais

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c] || c));

// Utilidades de Data
const dataLocalStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const getHojeStr = () => dataLocalStr(new Date());
const novoId = p => p + '_' + (window.crypto && crypto.randomUUID ? crypto.randomUUID().slice(0, 13) : Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
// Exclusões viram "marcas de remoção" para não ressuscitarem ao sincronizar com outro aparelho.
function marcarRemovido(...ids) { state.removidos = state.removidos || {}; const t = new Date().toISOString(); ids.forEach(id => { if (id != null) state.removidos[String(id)] = t; }); }
const formatDataBR = dataStr => {
  if (!dataStr) return '';
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
};
const diffDias = (data1Str, data2Str) => {
  const d1 = new Date(data1Str + "T00:00:00");
  const d2 = new Date(data2Str + "T00:00:00");
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
};
const diaDaSemana = (dataStr) => new Date(dataStr + "T00:00:00").getDay();
const formatarHora = hora => hora.substring(0, 5);

// Sistema de Mensagens
function showToast(msg, isSync = false) {
  const t = $('#toast');
  t.innerHTML = isSync ? `🔄 <strong>Sincronizando:</strong> ${msg}` : msg;
  t.className = isSync 
    ? "fixed bottom-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-2xl opacity-100 transition duration-300 z-50 text-sm border border-blue-400"
    : "fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl opacity-100 transition duration-300 z-50 text-sm";
  
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    t.classList.remove('opacity-100');
    t.classList.add('opacity-0');
  }, 3500);
}

// Modal de Confirmação
let pendingConfirmAction = null;
window.customConfirm = function(title, msg, onConfirm, btnText = 'Confirmar') {
  $('#modal-confirm-title').textContent = title;
  $('#modal-confirm-msg').textContent = msg;
  $('#modal-confirm-ok').textContent = btnText;
  pendingConfirmAction = onConfirm;
  $('#modal-confirm').showModal();
};
$('#modal-confirm-cancel').onclick = () => $('#modal-confirm').close();
$('#modal-confirm-ok').onclick = () => {
  if (pendingConfirmAction) pendingConfirmAction();
  $('#modal-confirm').close();
};

// ESTADO DA APLICAÇÃO
let state = {
  medicamentos: [], // {id, nome, dosagem, obs}
  rotinas: [],      // {id, medId, horario, frequencia, dataInicio, dataFim, diaSemana, intervalo}
  historico: [],    // {id, rotinaId, data, horaTomado}
  historicosMedicamentos: [], // registros de medicamentos receitados/tomados eventualmente
  receitas: [] // {id, data, paciente, medico, crm, hospital, tipo, observacoes, itens:[{id, nome, dosagem, quantidade, posologia, dias, medId}]}
};

const STORAGE_KEY = 'med_control_cloud_api_v1';
let cloudProvider = localStorage.getItem('med_cloud_provider') === 'supabase' ? 'supabase' : 'local';
localStorage.removeItem('med_cloud_token'); // token manual de Drive/OneDrive foi removido por segurança
