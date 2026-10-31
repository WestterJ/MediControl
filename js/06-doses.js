'use strict';
// Regras de doses por frequência (horas, dias, semanal...)

// Doses de uma rotina "a cada X horas" em um dia: contínuas a partir da 1ª dose (dataInicio + horario).
function dosesDeHoras(rotina, dataAlvoStr) {
  const n = Number(rotina.intervalo);
  const [h, m] = String(rotina.horario || '').split(':').map(Number);
  if (!Number.isFinite(n) || n < 1 || !Number.isFinite(h) || !Number.isFinite(m) || !rotina.dataInicio) return [];
  const [Y, M, D] = rotina.dataInicio.split('-').map(Number);
  const [y, mo, d] = dataAlvoStr.split('-').map(Number);
  const t0 = new Date(Y, M - 1, D, h, m, 0, 0).getTime();
  const passo = n * 3600000;
  const ini = new Date(y, mo - 1, d, 0, 0, 0, 0).getTime();
  const fim = new Date(y, mo - 1, d + 1, 0, 0, 0, 0).getTime();
  const out = [];
  for (let t = t0 + Math.max(0, Math.ceil((ini - t0) / passo)) * passo; t < fim; t += passo) {
    const dt = new Date(t);
    out.push(String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0'));
  }
  return out;
}

// Horários (doses) previstos da rotina no dia; vazio se não há dose.
function dosesDoDia(rotina, dataAlvoStr) {
  if (rotina.frequencia === 'horas') {
    if (dataAlvoStr < rotina.dataInicio || (rotina.dataFim && dataAlvoStr > rotina.dataFim)) return [];
    return dosesDeHoras(rotina, dataAlvoStr);
  }
  return deveTomarNesteDia(rotina, dataAlvoStr) ? [rotina.horario] : [];
}

// A dose foi marcada como tomada? Rotinas "a cada X horas" comparam o horário previsto; as demais, só rotina+dia.
function doseTomada(rotina, dataStr, slot) {
  return state.historico.some(h => h.rotinaId === rotina.id && h.data === dataStr && (rotina.frequencia !== 'horas' || h.horaPrevista === slot));
}

function deveTomarNesteDia(rotina, dataAlvoStr) {
  if (dataAlvoStr < rotina.dataInicio) return false;
  if (rotina.dataFim && dataAlvoStr > rotina.dataFim) return false;
  if (rotina.frequencia === 'horas') return dosesDeHoras(rotina, dataAlvoStr).length > 0;
  
  if (rotina.frequencia === 'diario') return true;
  
  if (rotina.frequencia === 'semanal') {
    return diaDaSemana(dataAlvoStr) === rotina.diaSemana;
  }
  
  const diff = diffDias(rotina.dataInicio, dataAlvoStr);
  
  if (rotina.frequencia === 'dsdn') {
    return diff % 2 === 0;
  }
  
  if (rotina.frequencia === '1s2n') {
    return diff % 3 === 0;
  }

  if (rotina.frequencia === 'dias') {
    const n = Number(rotina.intervalo);
    return Number.isFinite(n) && n >= 1 && diff % n === 0;
  }
  
  return false;
}
