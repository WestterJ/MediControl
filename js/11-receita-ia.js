'use strict';
// Leitura de receita por IA (dynamic-service)

$('#btn-ler-receita-ia').onclick=async()=>{
  const file=$('#hist-receita-arquivo').files[0];
  if(!file){$('#hist-ia-status').textContent='Selecione uma foto ou imagem da receita primeiro.';return;}
  if(!supabaseClient||!supabaseUser){$('#hist-ia-status').textContent='Entre na sua conta para usar a leitura por IA.';return;}
  if(!['image/jpeg','image/png','image/webp'].includes((file.type||'').toLowerCase())){$('#hist-ia-status').textContent='Formato não suportado. Escolha uma imagem JPG, PNG ou WEBP.';return;}
  const btn=$('#btn-ler-receita-ia');btn.disabled=true;$('#hist-ia-status').textContent='Preparando imagem e analisando a receita…';
  try{
    // Reduz resolução e tamanho antes de enviar para diminuir o risco de timeout em fotos grandes.
    const img=await new Promise((resolve,reject)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);resolve(im)};im.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('Não foi possível abrir a imagem.'))};im.src=u;});
    const scale=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
    let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));
    if(!blob)throw new Error('Não foi possível otimizar a imagem. Tente outra foto.');
    if(blob.size>2*1024*1024)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.65));
    if(!blob||blob.size>3*1024*1024)throw new Error('A imagem continua muito grande. Recorte a receita para mostrar somente a folha e tente novamente.');
    const b64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('Não foi possível ler a imagem.'));r.readAsDataURL(blob);});
    const systemText=[
      'Você é um assistente de leitura e transcrição de receitas médicas. Responda em português do Brasil e devolva somente JSON conforme o esquema.',
      'Uma receita pode conter vários medicamentos. Extraia TODOS os medicamentos visíveis como itens separados no array medicamentos; não escolha apenas o primeiro.',
      'Para cada medicamento, capture nome, dosagem/apresentação e posologia/frequência exatamente como visíveis. Não invente nem corrija prescrições.',
      'Transcreva somente dados legíveis. Campos ausentes ou incertos devem ser strings vazias. Não deduza a data atual nem presuma nome do paciente.',
      'Use data no formato AAAA-MM-DD somente se estiver claramente identificada. dias deve conter somente duração explícita em número de dias; caso contrário string vazia.',
      'Não ofereça diagnóstico nem altere a prescrição. Os resultados serão revisados por uma pessoa antes de salvar.'
    ].join(' ');
    const medSchema={type:'OBJECT',properties:{nome:{type:'STRING'},dosagem:{type:'STRING'},posologia:{type:'STRING'}},required:['nome','dosagem','posologia']};
    const responseSchema={type:'OBJECT',properties:{medicamentos:{type:'ARRAY',items:medSchema},data:{type:'STRING'},dias:{type:'STRING'},paciente:{type:'STRING'},medico:{type:'STRING'},hospital:{type:'STRING'},observacoes:{type:'STRING'}},required:['medicamentos','data','dias','paciente','medico','hospital','observacoes']};
    const payload={systemInstruction:{parts:[{text:systemText}]},contents:[{role:'user',parts:[{text:'Leia a receita e extraia todos os medicamentos e os dados comuns legíveis. Não invente campos ausentes.'},{inlineData:{mimeType:'image/jpeg',data:b64}}]}],generationConfig:{responseMimeType:'application/json',responseSchema}};
    const {data,error}=await supabaseClient.functions.invoke('dynamic-service',{body:payload});
    if(error){let detail=error.message||'Falha ao chamar dynamic-service.';try{if(error.context&&typeof error.context.json==='function'){const body=await error.context.json();if(body&&(body.error||body.message))detail=body.error||body.message;}}catch(_){}throw new Error(detail+' Confira os logs da Edge Function dynamic-service no projeto Supabase do MediControl.');}
    const parts=data&&data.candidates&&data.candidates[0]&&data.candidates[0].content?data.candidates[0].content.parts||[]:[];
    const answer=parts.find(part=>part&&typeof part.text==='string')?.text;if(!answer)throw new Error('A IA não retornou texto legível. Tente novamente com uma foto mais nítida.');
    let x;try{x=JSON.parse(answer.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim());}catch(_){throw new Error('A resposta da IA veio em formato inválido. Tente novamente.');}
    const meds=Array.isArray(x.medicamentos)?x.medicamentos.filter(m=>m&&String(m.nome||'').trim()).map(m=>({nome:String(m.nome||''),dosagem:String(m.dosagem||''),posologia:String(m.posologia||'')})):[];
    if(!meds.length)throw new Error('Não identifiquei medicamentos com segurança. Confira se a receita está nítida e legível.');
    receitaMedicamentosIA=meds;
    const common={data:'hist-data',dias:'hist-dias',paciente:'hist-paciente',medico:'hist-medico-nome',hospital:'hist-hospital-nome',observacoes:'hist-observacoes'};
    Object.entries(common).forEach(([key,id])=>{if(typeof x[key]==='string'&&x[key].trim())$('#'+id).value=x[key].trim();});
    $('#hist-tipo').value='receitado';
    $('#hist-med-nome').value=meds[0].nome;$('#hist-med-dose').value=meds[0].dosagem;$('#hist-posologia').value=meds[0].posologia;
    const panel=$('#hist-ia-medicamentos');panel.innerHTML='<p class="text-sm font-bold text-violet-900">Medicamentos identificados ('+meds.length+'). Confira e edite cada item antes de salvar:</p>'+meds.map((m,i)=>`<div data-ia-med-index="${i}" class="rounded-lg border border-violet-200 bg-white p-3 space-y-2"><p class="text-xs font-semibold text-slate-500">Medicamento ${i+1}</p><label class="block text-xs font-semibold text-slate-700">Nome<input data-field="nome" value="${esc(m.nome)}" class="mt-1 w-full rounded border border-slate-300 p-2 text-sm font-normal"></label><label class="block text-xs font-semibold text-slate-700">Dosagem / apresentação<input data-field="dose" value="${esc(m.dosagem)}" class="mt-1 w-full rounded border border-slate-300 p-2 text-sm font-normal"></label><label class="block text-xs font-semibold text-slate-700">Posologia / frequência<input data-field="posologia" value="${esc(m.posologia)}" class="mt-1 w-full rounded border border-slate-300 p-2 text-sm font-normal"></label></div>`).join('');panel.classList.remove('hidden');
    $('#hist-ia-status').textContent='Leitura concluída. Foram identificados '+meds.length+' medicamento(s). Confira nome, dose e posologia; ao salvar, cada medicamento será registrado separadamente.';
  }catch(err){console.error('MediControl prescription AI error:',err);$('#hist-ia-status').textContent='Não foi possível ler a receita: '+(err.message||String(err));}
  finally{btn.disabled=false;}
};
