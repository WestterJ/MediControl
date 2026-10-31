'use strict';
// Último script carregado: inicializa na ordem certa, quando todos os módulos já existem.
document.querySelectorAll('[data-app-version]').forEach(el => { el.textContent = window.APP_VERSION; });
loadLocalData();
updateCloudStatusPill();
iniciarNavegacao();
refreshAll();
startMedicationNotificationChecks();
irParaModulo((() => { try { return localStorage.getItem(MODULO_KEY); } catch (_) { return null; } })() || 'inicio');
setInterval(() => { if (moduloAtual === 'inicio' && !document.hidden) renderKpis(); }, 60000);

if(location.hash.includes('type=recovery'))showRecoveryForm();
(async function initSupabaseSession(){
  if(!supabaseConfig.url||!supabaseConfig.key||!window.supabase)return;
  try{const c=readSupabaseForm();const {data:{session}}=await c.auth.getSession();if(session)await applySupabaseSession(session,true);c.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){supabaseUser=null;cloudProvider='local';lockApp();updateCloudStatusPill();}else if(event==='SIGNED_IN'&&session&&(!supabaseUser||supabaseUser.id!==session.user.id))setTimeout(()=>applySupabaseSession(session,true),0);});}catch(err){console.warn('Supabase session init:',err.message);setAuthMessage(authFriendlyError(err),'error');}
})();
