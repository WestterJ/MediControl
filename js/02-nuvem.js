'use strict';
// Status da nuvem e sincronização Supabase (merge, conflitos, sessão)

const LAST_CLOUD_SAVE_KEY = 'med_last_cloud_saved_at_v1';
let lastCloudSavedAt = localStorage.getItem(LAST_CLOUD_SAVE_KEY) || '';
function formatCloudSavedAt(value) {
  if (!value) return 'ainda não salvo';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'horário indisponível';
  return d.toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function setCloudSavedAt(value, persist=true) {
  if (!value) return;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return;
  lastCloudSavedAt = d.toISOString();
  if (persist) localStorage.setItem(LAST_CLOUD_SAVE_KEY, lastCloudSavedAt);
  updateCloudStatusPill();
}

function updateCloudStatusPill() {
  const pill = $('#btn-cloud-status');
  const icon = $('#cloud-status-icon');
  const text = $('#cloud-status-text');
  const when = formatCloudSavedAt(lastCloudSavedAt);
  if (cloudProvider === 'supabase' && supabaseUser) {
    pill.className = "text-xs px-3 py-1.5 rounded-full bg-emerald-700 text-white border border-emerald-500 font-medium truncate max-w-[260px] flex items-center gap-1 shadow-sm transition-all hover:bg-emerald-600";
    icon.textContent = "☁️"; text.textContent = "Nuvem · " + when;
    pill.title = "Último registro gravado na nuvem: " + when + ". Clique para sincronizar agora.";
  } else if (cloudProvider === 'google') {
    pill.className = "text-xs px-3 py-1.5 rounded-full bg-sky-700 text-white border border-sky-500 font-medium truncate max-w-[260px] flex items-center gap-1 shadow-sm transition-all hover:bg-sky-600";
    icon.textContent = "☁️"; text.textContent = "Nuvem · " + when;
    pill.title = "Último registro gravado na nuvem: " + when + ".";
  } else if (cloudProvider === 'onedrive') {
    pill.className = "text-xs px-3 py-1.5 rounded-full bg-blue-700 text-white border border-blue-500 font-medium truncate max-w-[260px] flex items-center gap-1 shadow-sm transition-all hover:bg-blue-600";
    icon.textContent = "☁️"; text.textContent = "Nuvem · " + when;
    pill.title = "Último registro gravado na nuvem: " + when + ".";
  } else {
    pill.className = "text-xs px-3 py-1.5 rounded-full bg-amber-600 text-white border border-amber-500 font-medium truncate max-w-[260px] flex items-center gap-1 shadow-sm transition-all hover:bg-amber-500";
    icon.textContent = "☁️"; text.textContent = "Nuvem · não conectado";
    pill.title = "Dados ainda não sincronizados com a nuvem. Clique para abrir a configuração.";
  }
}

async function saveCloud(force = false) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    
    if (cloudProvider === 'supabase' && supabaseClient && supabaseUser) {
      await syncSupabaseNow(false);
    }
  } catch(e) {
    console.error("Erro na nuvem:", e);
    showToast("Erro ao sincronizar (Token expirado ou inválido).");
  }
}

$('#btn-cloud-status').onclick = () => {
  if (cloudProvider === 'local') {
    irParaModulo('config');
    showToast("Configure e entre no Supabase para sincronizar.");
  } else saveCloud(true);
};

// --- Supabase: autenticação e sincronização automática ---
let supabaseClient = null;
let supabaseClientKey = '';
let supabaseUser = null;
const staticSupabaseConfig = window.MEDICONTROL_SUPABASE_CONFIG || {};
let supabaseConfig = {url: staticSupabaseConfig.url || localStorage.getItem('med_supabase_url') || '', key: staticSupabaseConfig.anonKey || staticSupabaseConfig.key || localStorage.getItem('med_supabase_key') || ''};
let supabaseSaveInFlight = false;
let supabaseSaveTimer = null;

function readSupabaseForm() {
  const url = ($('#config-supabase-url').value || supabaseConfig.url || '').trim().replace(/\/$/, '');
  const key = ($('#config-supabase-key').value || supabaseConfig.key || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) throw new Error('Informe o Project URL válido do Supabase (https://....supabase.co).');
  if (!key) throw new Error('Informe a chave pública publishable/anon. Nunca use service_role.');
  if (!window.supabase || !window.supabase.createClient) throw new Error('Biblioteca Supabase não carregou. Verifique a internet e recarregue a página.');
  supabaseConfig = {url,key};
  localStorage.setItem('med_supabase_url',url); localStorage.setItem('med_supabase_key',key);
  // Recria o cliente quando a URL OU a chave mudar; evita reutilizar uma chave antiga após corrigir a configuração.
  if (!supabaseClient || supabaseClient.supabaseUrl !== url || supabaseClientKey !== key) {
    supabaseClient = window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    supabaseClientKey = key;
  }
  return supabaseClient;
}

async function supabaseReadRemote() {
  if (!supabaseClient || !supabaseUser) throw new Error('Entre na sua conta Supabase primeiro.');
  const {data,error} = await supabaseClient.from('medication_data').select('data,updated_at').eq('user_id',supabaseUser.id).maybeSingle();
  if (error) throw error; return data || null;
}

let supabaseLastUpdatedAt = null, supabaseSavePending = false;

// Combina dois estados por ID: vence o item com updatedAt mais recente (empate: o remoto); remoções valem para os dois lados.
function mergeStates(a, b) {
  a = a || {}; b = b || {};
  const rem = { ...(b.removidos || {}), ...(a.removidos || {}) };
  const corte = Date.now() - 90 * 864e5;
  Object.keys(rem).forEach(k => { if (Date.parse(rem[k]) < corte) delete rem[k]; });
  const lista = (x, y) => {
    const m = new Map();
    [x, y].forEach((arr, lado) => (Array.isArray(arr) ? arr : []).forEach((item, i) => {
      if (!item) return;
      const k = item.id != null ? String(item.id) : `s${lado}-${i}-${JSON.stringify(item)}`;
      const antigo = m.get(k);
      if (!antigo || String(item.updatedAt || '') >= String(antigo.updatedAt || '')) m.set(k, item);
    }));
    return [...m.values()].filter(it => it.id == null || !rem[String(it.id)]);
  };
  return { medicamentos: lista(a.medicamentos, b.medicamentos), rotinas: lista(a.rotinas, b.rotinas), historico: lista(a.historico, b.historico), historicosMedicamentos: lista(a.historicosMedicamentos, b.historicosMedicamentos), removidos: rem };
}

// Grava só se a nuvem ainda está na versão que lemos; se outro aparelho gravou antes, mescla e tenta de novo.
async function gravarRemoto() {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const agora = new Date().toISOString();
    if (supabaseLastUpdatedAt) {
      const r = await supabaseClient.from('medication_data').update({data:state, updated_at:agora}).eq('user_id',supabaseUser.id).eq('updated_at',supabaseLastUpdatedAt).select('updated_at');
      if (r.error) throw r.error;
      if (r.data && r.data.length) { supabaseLastUpdatedAt = r.data[0].updated_at; setCloudSavedAt(agora); return; }
      const remoto = await supabaseReadRemote();
      if (remoto && remoto.data) { state = mergeStates(state, remoto.data); supabaseLastUpdatedAt = remoto.updated_at; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); refreshAll(); }
      else supabaseLastUpdatedAt = null;
    } else {
      const r = await supabaseClient.from('medication_data').upsert({user_id:supabaseUser.id, data:state, updated_at:agora},{onConflict:'user_id'}).select('updated_at');
      if (r.error) throw r.error;
      supabaseLastUpdatedAt = r.data && r.data[0] ? r.data[0].updated_at : agora; setCloudSavedAt(agora); return;
    }
  }
  throw new Error('Conflito de sincronização repetido. Tente novamente.');
}

async function syncSupabaseNow(showMessage=true) {
  if (!supabaseClient || !supabaseUser) { if(showMessage) showToast('Entre na sua conta para sincronizar com a nuvem.'); return; }
  if (supabaseSaveInFlight) { supabaseSavePending = true; return; } // não descarta: reenvia ao terminar
  supabaseSaveInFlight = true;
  try {
    if(showMessage) showToast('Sincronizando com a nuvem...',true);
    do { supabaseSavePending = false; await gravarRemoto(); } while (supabaseSavePending);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); cloudProvider='supabase'; localStorage.setItem('med_cloud_provider','supabase'); updateCloudStatusPill();
    if(showMessage) showToast('Dados sincronizados com a nuvem.');
  } catch(err) { console.error('Supabase sync error:',err); showToast('Falha na sincronização: '+(err.message || 'verifique URL, chave, tabela e RLS')+'. Os dados permanecem neste aparelho.'); }
  finally { supabaseSaveInFlight=false; }
}

function scheduleSupabaseSave(force=false) { if(supabaseSaveTimer) clearTimeout(supabaseSaveTimer); supabaseSaveTimer=setTimeout(()=>syncSupabaseNow(!!force),force?0:1200); }

async function applySupabaseSession(session, initial=false) {
  supabaseUser = session && session.user ? session.user : null;
  if(!supabaseUser) { if(cloudProvider==='supabase') cloudProvider='local'; lockApp(); updateCloudStatusPill(); return; }
  unlockApp();
  cloudProvider='supabase'; localStorage.setItem('med_cloud_provider','supabase'); updateCloudStatusPill();
  try {
    const remote=await supabaseReadRemote();
    if(remote && remote.data) {
      if(remote.updated_at) setCloudSavedAt(remote.updated_at);
      state = mergeStates(state, remote.data);
      supabaseLastUpdatedAt = remote.updated_at || null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      refreshAll();
      await syncSupabaseNow(false);
      if(initial) showToast('Dados sincronizados automaticamente com a nuvem.');
    } else { await syncSupabaseNow(true); }
  } catch(err) { showToast('Login realizado, mas não foi possível ler os dados: '+(err.message||'verifique a tabela/RLS')); }
}

$('#btn-supabase-save-config').onclick=()=>{try{readSupabaseForm();showToast('Configuração Supabase salva neste dispositivo.');}catch(err){showToast(err.message);}};
$('#btn-supabase-signup').onclick=async()=>{try{const c=readSupabaseForm(),email=$('#config-supabase-email').value.trim(),password=$('#config-supabase-password').value;if(!email||!password)throw new Error('Informe e-mail e senha.');const {data,error}=await c.auth.signUp({email,password});if(error)throw error;if(data.session)await applySupabaseSession(data.session,true);else showToast('Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre.');}catch(err){showToast('Não foi possível criar a conta: '+err.message);}};
$('#btn-supabase-login').onclick=async()=>{try{const c=readSupabaseForm(),email=$('#config-supabase-email').value.trim(),password=$('#config-supabase-password').value;if(!email||!password)throw new Error('Informe e-mail e senha.');const {data,error}=await c.auth.signInWithPassword({email,password});if(error)throw error;await applySupabaseSession(data.session,true);}catch(err){showToast('Falha no login: '+err.message);}};
$('#btn-supabase-google').onclick=async()=>{try{const c=readSupabaseForm();const redirectTo=window.location.origin+window.location.pathname;const {error}=await c.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});if(error)throw error;}catch(err){showToast('Falha ao iniciar login Google: '+err.message);}};
$('#btn-supabase-sync').onclick=()=>syncSupabaseNow(true);
$('#btn-supabase-logout').onclick=async()=>{try{if(supabaseClient)await supabaseClient.auth.signOut();supabaseUser=null;cloudProvider='local';localStorage.setItem('med_cloud_provider','local');lockApp();updateCloudStatusPill();showToast('Você saiu da conta.');}catch(err){showToast('Erro ao sair: '+err.message);}};
