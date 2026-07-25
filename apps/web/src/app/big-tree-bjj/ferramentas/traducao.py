#!/usr/bin/env python3
"""
Controle de tradução da obra — The Big Tree BJJ.

O problema que isto resolve: numa obra que muda toda semana, ninguém consegue
lembrar quais traduções ficaram para trás. Aqui a memória é do sistema.

Como funciona
-------------
O português é a língua canônica. Toda vez que uma tradução é revisada, ela guarda
a impressão digital (hash) do texto português daquele momento. Se o português muda,
o hash deixa de bater e a tradução se marca sozinha como DESATUALIZADA.

Uso
---
    python3 traducao.py                 relatório de todos os idiomas
    python3 traducao.py --idioma en     relatório de um idioma
    python3 traducao.py --pendencias    só o que precisa de trabalho
    python3 traducao.py --selar en maeda ferro    marca como traduzido agora
    python3 traducao.py --selar en --tudo         sela tudo (use com cuidado)
"""

import json, hashlib, sys, argparse
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "conteudo"
CAMPOS = ("nome", "epiteto", "abertura", "formacao", "atuacao",
          "descendencia", "nota", "lacuna", "apuracao")

VERDE, AMARELO, VERMELHO, CINZA, FIM = "\033[32m", "\033[33m", "\033[31m", "\033[90m", "\033[0m"


def carregar(idioma):
    caminho = BASE / f"{idioma}.json"
    if not caminho.exists():
        return None
    return json.loads(caminho.read_text(encoding="utf-8"))


def salvar(idioma, dados):
    caminho = BASE / f"{idioma}.json"
    caminho.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def digital(verbete):
    """Impressao digital dos campos traduziveis de um verbete em portugues."""
    partes = [str(verbete.get(c) or "") for c in CAMPOS]
    return hashlib.sha256("\u0000".join(partes).encode("utf-8")).hexdigest()[:16]


def avaliar(idioma):
    pt = carregar("pt")
    alvo = carregar(idioma)
    if alvo is None:
        return None

    linhas = []
    for chave, verbete in pt["verbetes"].items():
        atual = digital(verbete)
        traduzido = alvo.get("verbetes", {}).get(chave)
        if traduzido is None or not traduzido.get("_hash"):
            linhas.append((chave, "FALTANDO", atual, None))
        elif traduzido.get("_hash") != atual:
            linhas.append((chave, "DESATUALIZADO", atual, traduzido.get("_hash")))
        else:
            linhas.append((chave, "OK", atual, atual))
    return linhas


def palavras_pendentes(linhas):
    """Estimativa do volume de trabalho, em palavras de portugues."""
    pt = carregar("pt")
    total = 0
    for chave, estado, _, _ in linhas:
        if estado == "OK":
            continue
        v = pt["verbetes"][chave]
        total += sum(len(str(v.get(c) or "").split()) for c in CAMPOS)
    return total


def relatorio(idiomas, so_pendencias=False):
    nucleo = json.loads((BASE / "nucleo.json").read_text(encoding="utf-8"))
    canonica = nucleo["_canonica"]
    print(f"\n  Lingua canonica: {canonica.upper()}   Idiomas: {', '.join(nucleo['_idiomas'])}")
    print("  " + "-" * 62)

    for idioma in idiomas:
        if idioma == canonica:
            continue
        linhas = avaliar(idioma)
        if linhas is None:
            print(f"\n  {idioma.upper()}   {VERMELHO}arquivo {idioma}.json nao existe{FIM}")
            continue

        ok = sum(1 for l in linhas if l[1] == "OK")
        des = sum(1 for l in linhas if l[1] == "DESATUALIZADO")
        falt = sum(1 for l in linhas if l[1] == "FALTANDO")
        pct = round(100 * ok / len(linhas)) if linhas else 0

        print(f"\n  {idioma.upper()}   {ok}/{len(linhas)} verbetes em dia  ({pct}%)"
              f"   {AMARELO}{des} desatualizados{FIM}  {VERMELHO}{falt} faltando{FIM}")
        print(f"  {CINZA}trabalho pendente estimado: {palavras_pendentes(linhas)} palavras{FIM}")

        for chave, estado, atual, tinha in linhas:
            if so_pendencias and estado == "OK":
                continue
            cor = {"OK": VERDE, "DESATUALIZADO": AMARELO, "FALTANDO": VERMELHO}[estado]
            marca = {"OK": "OK ", "DESATUALIZADO": "!! ", "FALTANDO": "-- "}[estado]
            detalhe = ""
            if estado == "DESATUALIZADO":
                detalhe = f"   {CINZA}traduzido de {tinha}, portugues agora {atual}{FIM}"
            print(f"    {cor}{marca}{FIM}{chave:<12}{cor}{estado}{FIM}{detalhe}")
    print()


def selar(idioma, chaves, tudo=False):
    pt = carregar("pt")
    alvo = carregar(idioma) or {"_idioma": idioma, "_canonica": False, "verbetes": {}}
    alvo.setdefault("verbetes", {})

    alvos = list(pt["verbetes"].keys()) if tudo else chaves
    selados = 0
    for chave in alvos:
        if chave not in pt["verbetes"]:
            print(f"  aviso: '{chave}' nao existe em pt.json")
            continue
        alvo["verbetes"].setdefault(chave, {})
        alvo["verbetes"][chave]["_hash"] = digital(pt["verbetes"][chave])
        selados += 1
    salvar(idioma, alvo)
    print(f"  {VERDE}{selados} verbete(s) selado(s) em {idioma}.json{FIM}")


def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--idioma")
    p.add_argument("--pendencias", action="store_true")
    p.add_argument("--selar", nargs="+", metavar=("IDIOMA", "CHAVE"))
    p.add_argument("--tudo", action="store_true")
    a = p.parse_args()

    if a.selar:
        selar(a.selar[0], a.selar[1:], tudo=a.tudo)
        return

    nucleo = json.loads((BASE / "nucleo.json").read_text(encoding="utf-8"))
    idiomas = [a.idioma] if a.idioma else nucleo["_idiomas"]
    relatorio(idiomas, so_pendencias=a.pendencias)


if __name__ == "__main__":
    main()
