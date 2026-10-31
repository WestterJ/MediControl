# MediControl v3.0.0 — arquitetura

Página estática (GitHub Pages) + Supabase, sem build. Scripts clássicos e globais, carregados na ordem numérica do `index.html`.
Nunca repita um nome global entre arquivos. Código que roda ao carregar só usa o que veio antes; a inicialização fica em `99-main.js`.

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Tela de login, menu lateral, views (`#view-*`) e modais |
| `css/app.css` | Estilos próprios: layout, menu lateral, indicadores |
| `js/00-config.js` | `APP_VERSION` |
| `js/01-base.js` | `$`, `esc`, datas, toast, confirmação, `state`, chaves locais |
| `js/02-nuvem.js` | Status da nuvem, merge, gravação com checagem de conflito, sessão |
| `js/03-auth.js` | Login, Google, cadastro, recuperação de senha |
| `js/04-dados.js` | localStorage, backup JSON, reset |
| `js/05-medicamentos.js` · `07-rotinas.js` | Cadastros |
| `js/06-doses.js` | Regras de dose por frequência (`dosesDoDia`, `doseTomada`) |
| `js/08-notificacoes.js` | Lembretes |
| `js/09-inicio.js` | Hoje/Amanhã/7 dias e indicadores (`renderKpis`) |
| `js/10-historico.js` | Histórico de tomadas e de medicamentos eventuais |
| `js/11-receita-ia.js` | Leitura de receita por `dynamic-service` |
| `js/12-navegacao.js` | Menu lateral: `MODULOS`, `irParaModulo`, `refreshAll` |
| `js/pwa.js` · `sw.js` | Service worker (lista de arquivos em `APP_SHELL`) |
| `js/99-main.js` | Inicialização (último script) |

## Onde mexer
- **Novo módulo:** view no `index.html`, botão `.nav-item[data-modulo]` no menu, entrada em `MODULOS` (12) e, se criar JS, `<script>` antes de `pwa.js`/`99-main.js` e caminho em `APP_SHELL`.
- **Regra de frequência:** `06-doses.js` (+ opção no select do modal de rotina).
- **Cores/layout do menu:** `css/app.css`.

## Estado e dados
`state = {medicamentos, rotinas, historico, historicosMedicamentos, removidos}` em `medication_data.data` (JSONB). Formato **inalterado** na v3.0.0. Todo salvamento: `saveCloud()` e depois `renderX()`/`refreshAll()`.

## Versão
Mude em `js/00-config.js`, `<title>` do `index.html` e `CACHE_NAME` do `sw.js`; confira com `python3 scripts/verificar.py .`.

## Histórico
v3.0.0: menu lateral, código dividido em módulos e CSS, indicadores no Início, `verificar.py`. Removido código morto (token Drive/OneDrive, modal de conflito antigo). v2.5.0: rotinas a cada X horas/dias e data de término.
