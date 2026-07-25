#!/usr/bin/env python3
"""
Validador de integridade — The Big Tree BJJ.

Roda antes de qualquer publicação. Ele não julga o conteúdo; julga se a base
obedece às próprias regras que a obra impõe ao leitor.

    python3 integridade.py
    python3 integridade.py --estrito     falha se houver qualquer AVISO
"""

import json, re, sys, argparse
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "conteudo"
VERM, AMAR, VERD, CINZA, FIM = "\033[31m", "\033[33m", "\033[32m", "\033[90m", "\033[0m"

erros, avisos = [], []
def erro(c, m): erros.append((c, m))
def aviso(c, m): avisos.append((c, m))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--estrito", action="store_true")
    args = ap.parse_args()

    N = json.loads((BASE / "nucleo.json").read_text(encoding="utf-8"))
    P = json.loads((BASE / "pt.json").read_text(encoding="utf-8"))

    pessoas, verbetes = N["pessoas"], P["verbetes"]
    entidades = N.get("entidades", {})
    combates = N.get("combates", [])
    fontes = N["fontes"]
    conf_nucleo = {c["id"] for c in N["conflitos"]}
    conf_prosa = set(P["conflitos"])
    sujeitos = set(pessoas) | set(entidades)  # tudo que pode ter verbete e ser ponto de um vínculo

    # 1 — selo DOC sem fonte é a falha mais grave possivel nesta obra
    for v in N["vinculos"]:
        if v["selo"] == "DOC" and not v.get("fonte"):
            erro("SELO SEM LASTRO",
                 f'vínculo {v["de"]} -> {v["para"]} está DOC e não aponta fonte')

    # 2 — toda fonte citada tem de existir
    for v in N["vinculos"]:
        if v.get("fonte") and v["fonte"] not in fontes:
            erro("REFERÊNCIA QUEBRADA", f'vínculo cita fonte inexistente {v["fonte"]}')
    for pid, p in list(pessoas.items()) + list(entidades.items()):
        for f in p.get("registro", []):
            if f not in fontes:
                erro("REFERÊNCIA QUEBRADA", f'{pid} cita fonte inexistente {f}')
    for k in combates:
        if k.get("fonte") and k["fonte"] not in fontes:
            erro("REFERÊNCIA QUEBRADA", f'combate {k["id"]} cita fonte inexistente {k["fonte"]}')

    # 3 — vinculo tem de apontar para gente ou entidade que existe, ou referência externa (_prefixo)
    conhecidos = sujeitos | {"kodokan"}
    def valido(no):
        return no in conhecidos or no.startswith("_")  # "_" = fora da linhagem, sem verbete exigido
    for v in N["vinculos"]:
        for lado in ("de", "para"):
            if not valido(v[lado]):
                erro("NÓ FANTASMA", f'vínculo aponta para "{v[lado]}", que não existe em pessoas nem entidades')

    # 3b — combate tem de envolver gente que existe, ou referência externa
    for k in combates:
        for lado in ("a", "b"):
            if not valido(k[lado]):
                erro("COMBATENTE FANTASMA", f'combate {k["id"]} envolve "{k[lado]}", que não existe')
        if k["selo"] == "DOC" and not k.get("fonte"):
            erro("SELO SEM LASTRO", f'combate {k["id"]} está DOC e não aponta fonte')

    # 4 — as duas camadas têm de estar emparelhadas
    for k in verbetes:
        if k not in sujeitos:
            erro("PROSA SEM FATO", f'verbete "{k}" não tem ficha em nucleo.json (pessoas ou entidades)')
    for k in sujeitos:
        if k not in verbetes:
            aviso("FATO SEM PROSA", f'"{k}" tem ficha e ainda não tem verbete')

    # 5 — nenhum fato pode vazar para a camada traduzível
    ano = re.compile(r"\b1[5-9]\d\d\b|\b20\d\d\b")
    selo = re.compile(r"\b(DOC|ATE|TRA|ESP)\b")
    for k, vb in verbetes.items():
        for campo, txt in vb.items():
            if not isinstance(txt, str):
                continue
            if ano.search(txt):
                erro("DATA NA PROSA", f'{k}.{campo} contém ano — datas vivem em nucleo.json')
            if selo.search(txt):
                erro("SELO NA PROSA", f'{k}.{campo} contém código de selo')

    # 6 — conflitos citados têm de existir nas duas camadas
    for pid, p in list(pessoas.items()) + list(entidades.items()):
        for c in p.get("conflitos", []):
            if c not in conf_nucleo:
                erro("CONFLITO FANTASMA", f'{pid} cita {c}, ausente de nucleo.json')
            if c not in conf_prosa:
                aviso("CONFLITO SEM TEXTO", f'{c} não tem descrição em pt.json')
    for c in conf_nucleo - conf_prosa:
        aviso("CONFLITO SEM TEXTO", f'{c} está em nucleo.json e não em pt.json')

    # 7 — verbete precisa dos campos do seu tipo, mesmo que como lacuna
    # "formação" é conceito de pessoa; entidade não formou-se, foi fundada
    obrig_pessoa = ("nome", "abertura", "formacao", "atuacao", "descendencia", "nota", "lacuna", "apuracao")
    obrig_entidade = ("nome", "abertura", "atuacao", "descendencia", "nota", "lacuna", "apuracao")
    for k, vb in verbetes.items():
        obrig = obrig_entidade if k in entidades else obrig_pessoa
        faltam = [c for c in obrig if not vb.get(c)]
        if faltam:
            aviso("VERBETE INCOMPLETO", f'{k} sem: {", ".join(faltam)}')

    # ---------- relatório ----------
    print(f"\n  Base: {len(pessoas)} pessoas · {len(entidades)} entidades · {len(verbetes)} verbetes · "
          f"{len(N['vinculos'])} vínculos · {len(combates)} combates · {len(fontes)} fontes · {len(conf_nucleo)} conflitos")

    doc = sum(1 for v in N["vinculos"] if v["selo"] == "DOC")
    digitalizadas = sum(1 for f in fontes.values() if f.get("digitalizado"))
    print(f"  {CINZA}vínculos documentados: {doc}/{len(N['vinculos'])} · "
          f"fontes digitalizadas: {digitalizadas}/{len(fontes)}{FIM}")
    print("  " + "-" * 64)

    for cat, m in erros:
        print(f"  {VERM}ERRO{FIM}   {cat:<22} {m}")
    for cat, m in avisos:
        print(f"  {AMAR}AVISO{FIM}  {cat:<22} {m}")

    if not erros and not avisos:
        print(f"  {VERD}base íntegra{FIM}")
    print(f"\n  {len(erros)} erro(s) · {len(avisos)} aviso(s)\n")

    if erros or (args.estrito and avisos):
        sys.exit(1)


if __name__ == "__main__":
    main()
