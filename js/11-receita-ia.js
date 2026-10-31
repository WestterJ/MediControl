'use strict';
// Leitura de receita por IA (Edge Function dynamic-service).
// Padrão do Diário Nutricional V42: UMA chamada por clique, contagem em segundos e botão Cancelar.
// RECEITA_IA_MODO: 'refeicao' usa o modo rápido que a função já tem (raciocínio desligado + modelo reserva).
// Depois de acrescentar o modo "receita" na função (ver LEIA-ME), troque para 'receita'.
const RECEITA_IA_MODO = 'refeicao';
const RECEITA_IA_LIMITE_S = 45;

const RECEITA_SCHEMA = (() => {
  const S = { type: 'STRING' };
  const item = { type: 'OBJECT', properties: { nome: S, dosagem: S, quantidade: S, posologia: S, dias: S }, required: ['nome', 'dosagem', 'quantidade', 'posologia', 'dias'] };
  return { type: 'OBJECT', properties: { itens: { type: 'ARRAY', items: item }, data: S, paciente: S, medico: S, crm: S, hospital: S, observacoes: S }, required: ['itens', 'data', 'paciente', 'medico', 'crm', 'hospital', 'observacoes'] };
})();

const RECEITA_PROMPT = [
  'Você transcreve receitas médicas (impressas ou manuscritas, a foto pode estar girada). Responda em português do Brasil, somente JSON no esquema.',
  'Extraia TODOS os medicamentos como itens separados. Em cada item: nome, dosagem (ex.: 500 mg), quantidade dispensada (ex.: 3 comprimidos), posologia exatamente como escrita e dias (somente o número de dias de uso).',
  'Transcreva só o que estiver legível; campo ausente ou incerto = string vazia. Não invente, não corrija prescrição, não ofereça diagnóstico.',
  'data = data da receita em AAAA-MM-DD, só se estiver clara. paciente, medico, crm (ex.: CRM-GO 11.548) e hospital (clínica/instituição) como escritos. observacoes: no máximo uma frase curta.'
].join(' ');

// Reduz a foto antes de enviar (menos bytes = resposta mais rápida) e devolve o JPEG em base64.
async function reduzirImagemReceita(file) {
  const img = await new Promise((ok, erro) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(u); ok(im); };
    im.onerror = () => { URL.revokeObjectURL(u); erro(new Error('Não foi possível abrir a imagem.')); };
    im.src = u;
  });
  const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.8));
  if (!blob) throw new Error('Não foi possível otimizar a imagem. Tente outra foto.');
  return await new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => erro(new Error('Não foi possível ler a imagem.')); r.readAsDataURL(blob); });
}

async function chamarIAReceita(file, signal) {
  const b64 = await reduzirImagemReceita(file);
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) throw new Error('Sessão expirada. Entre novamente na sua conta.');
  const payload = {
    modo: RECEITA_IA_MODO,
    systemInstruction: { parts: [{ text: RECEITA_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: 'Leia a receita e extraia os medicamentos e os dados legíveis.' }, { inlineData: { mimeType: 'image/jpeg', data: b64 } }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: RECEITA_SCHEMA }
  };
  const resp = await fetch(supabaseConfig.url.replace(/\/$/, '') + '/functions/v1/dynamic-service', {
    method: 'POST', signal, body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token, 'apikey': supabaseConfig.key }
  });
  const json = await resp.json().catch(() => null);
  console.info('IA receita:', resp.status, resp.headers.get('Server-Timing') || '');
  if (!resp.ok) throw new Error((json && (json.error || json.message)) || `Erro HTTP ${resp.status} na função dynamic-service.`);
  const partes = (((json.candidates || [])[0] || {}).content || {}).parts || [];
  const texto = (partes.find(p => p && typeof p.text === 'string') || {}).text;
  if (!texto) throw new Error('A IA não retornou texto legível. Tente novamente com uma foto mais nítida.');
  let x;
  try { x = JSON.parse(texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()); }
  catch (_) { throw new Error('A resposta da IA veio incompleta. Tente de novo ou preencha manualmente.'); }
  const t = k => String(x[k] || '').trim();
  const itens = (Array.isArray(x.itens) ? x.itens : []).filter(i => i && String(i.nome || '').trim()).map(i => ({
    nome: String(i.nome).trim(), dosagem: String(i.dosagem || '').trim(), quantidade: String(i.quantidade || '').trim(),
    posologia: String(i.posologia || '').trim(), dias: String(i.dias || '').replace(/\D/g, '')
  }));
  if (!itens.length) throw new Error('Não identifiquei medicamentos com segurança. Confira se a receita está nítida e legível.');
  return { itens, data: /^\d{4}-\d{2}-\d{2}$/.test(t('data')) ? t('data') : '', paciente: t('paciente'), medico: t('medico'), crm: t('crm'), hospital: t('hospital'), observacoes: t('observacoes') };
}

// Controla botão, contagem em segundos, Cancelar e mensagens. Usado pelo cadastro de receitas e pelo histórico de medicamentos.
async function iniciarLeituraIA({ arquivo, botao, cancelar, status, aoConcluir }) {
  if (!arquivo) { status.textContent = 'Selecione uma foto ou imagem da receita primeiro.'; return; }
  if (!supabaseClient || !supabaseUser) { status.textContent = 'Entre na sua conta para usar a leitura por IA.'; return; }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes((arquivo.type || '').toLowerCase())) { status.textContent = 'Formato não suportado. Escolha uma imagem JPG, PNG ou WEBP.'; return; }
  const ctrl = new AbortController();
  let seg = 0, motivo = '';
  botao.disabled = true; cancelar.classList.remove('hidden');
  cancelar.onclick = () => { motivo = 'cancelado'; ctrl.abort(); };
  const mostrar = () => { status.textContent = seg < 15 ? `Lendo a receita… ${seg} s` : `Ainda lendo… ${seg} s. A IA está lenta; você pode cancelar e tentar de novo.`; };
  mostrar();
  const timer = setInterval(() => { seg++; if (seg >= RECEITA_IA_LIMITE_S) { motivo = 'tempo'; ctrl.abort(); } mostrar(); }, 1000);
  try {
    const x = await chamarIAReceita(arquivo, ctrl.signal);
    aoConcluir(x);
    status.textContent = `Leitura concluída em ${seg} s: ${x.itens.length} medicamento(s). Confira tudo antes de salvar.`;
  } catch (err) {
    if (err && err.name === 'AbortError') status.textContent = motivo === 'tempo' ? `Passou de ${RECEITA_IA_LIMITE_S} s e a leitura foi cancelada. Tente de novo (a segunda tentativa costuma ser mais rápida) ou preencha manualmente.` : 'Leitura cancelada.';
    else { console.error('MediControl IA receita:', err); status.textContent = 'Não foi possível ler a receita: ' + (err.message || String(err)); }
  } finally { clearInterval(timer); botao.disabled = false; cancelar.classList.add('hidden'); }
}

// Histórico de medicamentos (formulário antigo): preenche os campos com o resultado.
$('#btn-ler-receita-ia').onclick = () => iniciarLeituraIA({
  arquivo: $('#hist-receita-arquivo').files[0], botao: $('#btn-ler-receita-ia'), cancelar: $('#btn-cancelar-receita-ia'), status: $('#hist-ia-status'),
  aoConcluir: x => {
    receitaMedicamentosIA = x.itens;
    const comum = { data: 'hist-data', paciente: 'hist-paciente', medico: 'hist-medico-nome', hospital: 'hist-hospital-nome', observacoes: 'hist-observacoes' };
    Object.entries(comum).forEach(([k, id]) => { if (x[k]) $('#' + id).value = x[k]; });
    if (x.itens[0].dias) $('#hist-dias').value = x.itens[0].dias;
    $('#hist-tipo').value = 'receitado';
    $('#hist-med-nome').value = x.itens[0].nome; $('#hist-med-dose').value = x.itens[0].dosagem; $('#hist-posologia').value = x.itens[0].posologia;
    const campo = (rot, f, v) => `<label class="block text-xs font-semibold text-slate-700">${rot}<input data-field="${f}" value="${esc(v)}" class="mt-1 w-full rounded border border-slate-300 p-2 text-sm font-normal"></label>`;
    const painel = $('#hist-ia-medicamentos');
    painel.innerHTML = `<p class="text-sm font-bold text-violet-900">Medicamentos identificados (${x.itens.length}). Confira e edite cada item antes de salvar:</p>` +
      x.itens.map((m, i) => `<div data-ia-med-index="${i}" class="rounded-lg border border-violet-200 bg-white p-3 space-y-2"><p class="text-xs font-semibold text-slate-500">Medicamento ${i + 1}</p>${campo('Nome', 'nome', m.nome)}${campo('Dosagem / apresentação', 'dose', m.dosagem)}${campo('Posologia / frequência', 'posologia', m.posologia)}</div>`).join('');
    painel.classList.remove('hidden');
  }
});
