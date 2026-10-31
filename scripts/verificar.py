#!/usr/bin/env python3
"""Verificações rápidas do MediControl: python3 scripts/verificar.py <pasta-do-app>"""
import re, subprocess, sys, pathlib
raiz = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.')
erros, avisos = [], []
ler = lambda p: (raiz / p).read_text(encoding='utf-8') if (raiz / p).exists() else ''
js = sorted((raiz / 'js').glob('*.js'))
idx, sw = ler('index.html'), ler('sw.js')

for f in js + [raiz / 'sw.js']:                                   # 1) sintaxe
    r = subprocess.run(['node', '--check', str(f)], capture_output=True, text=True)
    if r.returncode: erros.append(f'Sintaxe em {f.name}: {(r.stderr.strip().splitlines() or ["erro"])[0]}')

decl = re.compile(r'^(?:async\s+)?(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)', re.M)   # 2) nomes globais repetidos
vistos = {}
for f in js:
    for n in set(decl.findall(f.read_text(encoding='utf-8'))): vistos.setdefault(n, []).append(f.name)
erros += [f'Nome global "{n}" em: {", ".join(v)}' for n, v in vistos.items() if len(v) > 1]

ordem = re.findall(r'<script src="\./js/([^"]+)"', idx)           # 3) index e service worker
for f in js:
    if f.name not in ordem: erros.append(f'index.html não carrega js/{f.name}')
    if f'./js/{f.name}' not in sw: erros.append(f'sw.js não lista js/{f.name}')
if './css/app.css' not in sw: erros.append('sw.js não lista css/app.css')
if ordem and ordem[-1] != '99-main.js': erros.append('99-main.js deve ser o último script')

ids = set(re.findall(r'\bid="([^"]+)"', idx))                     # 4) ids usados no JS existem no HTML
for f in js:
    for i in set(re.findall(r"\$\('#([\w-]+)'\)", f.read_text(encoding='utf-8'))):
        if i not in ids: erros.append(f'{f.name}: $("#{i}") não existe no index.html')
codigo = idx + ''.join(f.read_text(encoding='utf-8') for f in js)  # 5) handlers inline apontam para window.fn
for fn in set(re.findall(r'on\w+="window\.(\w+)\(', codigo)):
    if not re.search(rf'window\.{fn}\s*=', codigo): erros.append(f'handler window.{fn}() não está definido')

v = {}                                                            # 6) versão coerente
for nome, rx, txt in (('APP_VERSION', r"APP_VERSION\s*=\s*'([\d.]+)'", ler('js/00-config.js')),
                      ('title', r'<title>MediControl v([\d.]+)', idx), ('CACHE_NAME', r"CACHE_NAME\s*=\s*'[^']*?-v([\d.]+)'", sw)):
    m = re.search(rx, txt)
    if m: v[nome] = m.group(1)
if len(v) < 3 or len(set(v.values())) > 1: erros.append(f'Versões incoerentes: {v}')
for a in avisos: print('AVISO:', a)
for e in erros: print('ERRO:', e)
print('OK' if not erros else f'{len(erros)} erro(s)'); sys.exit(1 if erros else 0)
