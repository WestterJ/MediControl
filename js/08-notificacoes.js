'use strict';
// Lembretes por notificação

// --- Lembretes locais por notificação do navegador ---
const NOTIF_ENABLED_KEY = 'med_notifications_enabled_v1';
const NOTIF_SENT_KEY = 'med_notifications_sent_v1';
let notificationTimer = null;

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function updateNotificationStatus() {
  const status = $('#notification-status');
  const enableButton = $('#btn-enable-notifications');
  const supported = 'Notification' in window;
  if (!supported) {
    status.textContent = 'Este navegador não oferece suporte a notificações. Abra o app no Chrome atualizado.';
    enableButton.disabled = true;
    enableButton.classList.add('opacity-50', 'cursor-not-allowed');
    return;
  }
  if (Notification.permission === 'denied') {
    status.textContent = 'Notificações bloqueadas. Altere a permissão do site nas configurações do navegador/celular.';
  } else if (Notification.permission === 'granted' && localStorage.getItem(NOTIF_ENABLED_KEY) === 'true') {
    status.textContent = '✅ Notificações ativadas neste dispositivo.';
  } else if (Notification.permission === 'granted') {
    status.textContent = 'Permissão concedida. Toque em “Ativar notificações” para habilitar os lembretes.';
  } else {
    status.textContent = 'Notificações ainda não autorizadas.';
  }
}

async function enableMedicationNotifications() {
  if (!('Notification' in window)) {
    showToast('Este navegador não suporta notificações.');
    updateNotificationStatus();
    return;
  }
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.protocol !== 'file:') {
    showToast('Abra o aplicativo em uma página HTTPS para ativar notificações.');
    return;
  }
  try {
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') {
      showToast('Permissão de notificação não concedida. Confira as configurações do navegador.');
      updateNotificationStatus();
      return;
    }
    localStorage.setItem(NOTIF_ENABLED_KEY, 'true');
    updateNotificationStatus();
    checkMedicationNotifications();
    showToast('Lembretes ativados neste dispositivo.');
  } catch (err) {
    showToast('Não foi possível ativar notificações: ' + (err.message || 'erro do navegador'));
  }
}

function sendMedicationNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opcoes = { body, tag, icon: './icons/icon-192.png', badge: './icons/icon-192.png', vibrate: [200, 100, 200], renotify: false, requireInteraction: true };
  // No Android o Chrome só aceita notificações pelo service worker (new Notification() costuma falhar).
  const viaPagina = () => { try { const n = new Notification(title, opcoes); n.onclick = () => { window.focus(); n.close(); }; } catch (err) { console.warn('Falha ao exibir notificação:', err); } };
  if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opcoes)).catch(viaPagina); else viaPagina();
}

function checkMedicationNotifications() {
  if (localStorage.getItem(NOTIF_ENABLED_KEY) !== 'true' || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const today = localDateString(now);
  let sent = {};
  try { sent = JSON.parse(localStorage.getItem(NOTIF_SENT_KEY) || '{}'); } catch (_) { sent = {}; }

  state.rotinas.forEach(rotina => {
    dosesDoDia(rotina, today).forEach(slot => {
      if (doseTomada(rotina, today, slot)) return;
      const [hour, minute] = String(slot || '').split(':').map(Number);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
      const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
      const diffMs = now.getTime() - due.getTime();
      // Janela de 5 minutos evita avisos antigos ao reabrir o app horas depois.
      if (diffMs < 0 || diffMs > 5 * 60 * 1000) return;
      const sentKey = rotina.frequencia === 'horas' ? `${today}_${rotina.id}_${slot}` : `${today}_${rotina.id}`;
      if (sent[sentKey]) return;
      const med = state.medicamentos.find(m => m.id === rotina.medId);
      if (!med) return;
      sendMedicationNotification('Hora do medicamento 💊', `${med.nome} — ${med.dosagem}. Horário programado: ${slot}.`, sentKey);
      sent[sentKey] = new Date().toISOString();
      localStorage.setItem(NOTIF_SENT_KEY, JSON.stringify(sent));
    });
  });

  // Mantém somente registros recentes para evitar crescimento indefinido.
  const keys = Object.keys(sent);
  if (keys.length > 300) {
    const keep = {};
    keys.slice(-200).forEach(k => keep[k] = sent[k]);
    localStorage.setItem(NOTIF_SENT_KEY, JSON.stringify(keep));
  }
}

$('#btn-enable-notifications').onclick = enableMedicationNotifications;
$('#btn-test-notification').onclick = () => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    showToast('Primeiro toque em “Ativar notificações” e permita o acesso.');
    return;
  }
  sendMedicationNotification('MediControl — teste', 'As notificações estão funcionando neste dispositivo.', 'medicontrol-test');
  showToast('Notificação de teste enviada.');
};

function startMedicationNotificationChecks() {
  updateNotificationStatus();
  if (notificationTimer) clearInterval(notificationTimer);
  checkMedicationNotifications();
  notificationTimer = setInterval(checkMedicationNotifications, 15000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkMedicationNotifications();
  });
  window.addEventListener('focus', checkMedicationNotifications);
}
