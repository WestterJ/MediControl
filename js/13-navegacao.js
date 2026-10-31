'use strict';
// Menu lateral: cada módulo = uma view (#view-*) + uma função que a desenha.
// Para criar um módulo novo: view no index.html, botão .nav-item[data-modulo] e uma entrada abaixo.
const MODULOS = {
  inicio:       { titulo: 'Início',                 view: 'view-inicio',    render: () => refreshDashboard() },
  rotinas:      { titulo: 'Rotinas',                view: 'view-rotinas',   render: () => renderRotinas() },
  medicamentos: { titulo: 'Medicamentos',           view: 'view-meds',      render: () => renderMeds() },
  receitas:     { titulo: 'Receitas',               view: 'view-receitas',  render: () => renderReceitas() },
  historico:    { titulo: 'Histórico',              view: 'view-historico', render: () => { renderHistoricoRotinas(); renderHistoricosMedicamentos(); } },
  config:       { titulo: 'Nuvem e configurações',  view: 'view-config',    render: () => updateNotificationStatus() }
};
const MODULO_KEY = 'med_modulo_atual_v1';
const MENU_RECOLHIDO_KEY = 'med_menu_recolhido_v1';
let moduloAtual = 'inicio';

function menuMobile(abrir) {
  $('#sidebar').classList.toggle('open', abrir);
  $('#sidebar-backdrop').classList.toggle('show', abrir);
}

function alternarMenu() {
  if (window.matchMedia('(min-width:1024px)').matches) {
    const recolhido = document.body.classList.toggle('sidebar-collapsed');
    try { localStorage.setItem(MENU_RECOLHIDO_KEY, recolhido ? '1' : '0'); } catch (_) {}
  } else menuMobile(!$('#sidebar').classList.contains('open'));
}

function irParaModulo(nome) {
  if (!MODULOS[nome]) nome = 'inicio';
  moduloAtual = nome;
  Object.entries(MODULOS).forEach(([k, m]) => $('#' + m.view).classList.toggle('hidden', k !== nome));
  document.querySelectorAll('[data-modulo]').forEach(b => {
    const ativo = b.dataset.modulo === nome;
    b.classList.toggle('active', ativo);
    if (ativo) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('#modulo-titulo').textContent = MODULOS[nome].titulo;
  try { localStorage.setItem(MODULO_KEY, nome); } catch (_) {}
  MODULOS[nome].render();
  menuMobile(false);
  window.scrollTo(0, 0);
}

function refreshAll() {
  renderMeds();
  renderRotinas();
  renderReceitas();
  renderHistoricosMedicamentos();
  renderHistoricoRotinas();
  refreshDashboard();
}

function iniciarNavegacao() {
  document.querySelectorAll('[data-modulo]').forEach(b => { b.onclick = () => irParaModulo(b.dataset.modulo); });
  $('#btn-menu-lateral').onclick = alternarMenu;
  $('#sidebar-backdrop').onclick = () => menuMobile(false);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') menuMobile(false); });
  $('#btn-side-sync').onclick = () => { menuMobile(false); if (supabaseUser) syncSupabaseNow(true); else irParaModulo('config'); };
  $('#btn-side-logout').onclick = () => { menuMobile(false); $('#btn-supabase-logout').click(); };
  try { if (localStorage.getItem(MENU_RECOLHIDO_KEY) === '1') document.body.classList.add('sidebar-collapsed'); } catch (_) {}
}
