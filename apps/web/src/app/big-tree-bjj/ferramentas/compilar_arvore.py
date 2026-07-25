#!/usr/bin/env python3
"""
Compilador da árvore — The Big Tree BJJ.

Lê conteudo/nucleo.json (fatos) + conteudo/pt.json (prosa canônica) e produz
o bloco de dados JavaScript que a index.html injeta na árvore navegável.

Layout: BFS por profundidade genealógica a partir das raízes (entidades sem
"pai" nos vínculos). Nós no mesmo nível ficam na mesma linha; a ordem
horizontal segue a ordem de descoberta, para manter irmãos próximos.

Figuras do Livro VII (historiografia: comentaristas, não participantes da
linhagem) ficam de fora da árvore por decisão editorial — elas comentam a
história, não a integram.

Uso:
    python3 compilar_arvore.py            imprime o bloco JS no stdout
    python3 compilar_arvore.py --injetar  injeta direto em index.html
"""
import json, sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent / "conteudo"
FORA_DA_ARVORE = {"pedreira", "drysdale", "reila"}  # Livro VII: comentaristas, não linhagem

MARK_START = "/* === ÁRVORE COMPILADA: INÍCIO === */"
MARK_END = "/* === ÁRVORE COMPILADA: FIM === */"


def carregar():
    N = json.loads((BASE / "nucleo.json").read_text(encoding="utf-8"))
    P = json.loads((BASE / "pt.json").read_text(encoding="utf-8"))
    return N, P


def layout(N):
    """BFS multi-fonte por profundidade genealógica. Retorna {id: (x, y)}."""
    sujeitos = {**N["pessoas"], **N["entidades"]}
    ids = set(sujeitos) - FORA_DA_ARVORE

    edges = [(v["de"], v["para"]) for v in N["vinculos"]
             if v["de"] in ids and v["para"] in ids]

    filhos = {i: [] for i in ids}
    tem_pai = set()
    for de, para in edges:
        filhos[de].append(para)
        tem_pai.add(para)

    raizes = sorted(i for i in ids if i not in tem_pai)
    if not raizes:
        raizes = sorted(ids)[:1]

    profundidade = {}
    ordem = []
    fila = [(r, 0) for r in raizes]
    visitado = set()
    while fila:
        no, d = fila.pop(0)
        if no in visitado:
            profundidade[no] = min(profundidade[no], d)
            continue
        visitado.add(no)
        profundidade[no] = d
        ordem.append(no)
        for filho in sorted(filhos.get(no, [])):
            fila.append((filho, d + 1))

    # órfãos (não alcançados pela BFS a partir das raízes) entram na base
    for i in sorted(ids - visitado):
        profundidade[i] = max(profundidade.values(), default=0) + 1
        ordem.append(i)

    por_nivel = {}
    for i in ordem:
        por_nivel.setdefault(profundidade[i], []).append(i)

    W, H, PAD_Y = 1000, 900, 90
    n_niveis = max(por_nivel) + 1 if por_nivel else 1
    step_y = (H - 2 * PAD_Y) / max(1, n_niveis - 1) if n_niveis > 1 else 0

    pos = {}
    for nivel, membros in por_nivel.items():
        y = PAD_Y + nivel * step_y
        n = len(membros)
        step_x = W / (n + 1)
        for idx, m in enumerate(membros):
            x = step_x * (idx + 1)
            pos[m] = (round(x), round(y))
    return pos, W, H


def compilar():
    N, P = carregar()
    pos, W, H = layout(N)
    ids_arvore = set(pos)

    nodes_js = []
    for i in sorted(ids_arvore):
        v = P["verbetes"].get(i, {})
        x, y = pos[i]
        is_root = i not in {vv["para"] for vv in N["vinculos"]}
        nodes_js.append({
            "id": i, "x": x, "y": y, "root": is_root,
            "n": v.get("nome", i), "m": v.get("epiteto") or ""
        })

    edges_js = []
    for v in N["vinculos"]:
        if v["de"] in ids_arvore and v["para"] in ids_arvore:
            edges_js.append([v["de"], v["para"], v["selo"]])

    verbetes_js = {}
    for i in ids_arvore:
        v = P["verbetes"].get(i)
        if not v:
            continue
        entry = {"n": v.get("nome", i), "m": v.get("epiteto") or ""}
        if v.get("abertura"): entry["v"] = v["abertura"]
        if v.get("nota"): entry["o"] = v["nota"]
        if v.get("lacuna"): entry["g"] = v["lacuna"]
        verbetes_js[i] = entry

    return {
        "viewbox": f"0 0 {W} {H}",
        "nodes": nodes_js,
        "edges": edges_js,
        "verbetes": verbetes_js,
        "counts": {
            "pessoas": len(N["pessoas"]), "entidades": len(N["entidades"]),
            "vinculos": len(N["vinculos"]), "combates": len(N["combates"]),
            "fontes": len(N["fontes"]), "conflitos": len(N["conflitos"]),
            "arvore": len(ids_arvore),
        }
    }


def js_bloco(dados):
    linhas = [MARK_START]
    linhas.append("const TREE_VIEWBOX = " + json.dumps(dados["viewbox"]) + ";")
    linhas.append("const TREE_NODES = " + json.dumps(dados["nodes"], ensure_ascii=False) + ";")
    linhas.append("const TREE_EDGES = " + json.dumps(dados["edges"], ensure_ascii=False) + ";")
    linhas.append("const TREE_VERBETES_PT = " + json.dumps(dados["verbetes"], ensure_ascii=False) + ";")
    linhas.append("const BASE_COUNTS = " + json.dumps(dados["counts"], ensure_ascii=False) + ";")
    linhas.append(MARK_END)
    return "\n".join(linhas)


if __name__ == "__main__":
    dados = compilar()
    bloco = js_bloco(dados)

    if "--injetar" in sys.argv:
        alvo = Path(__file__).resolve().parent.parent / "index.html"
        s = alvo.read_text(encoding="utf-8")
        if MARK_START in s and MARK_END in s:
            pre = s.split(MARK_START)[0]
            post = s.split(MARK_END)[1]
            s = pre + bloco + post
        else:
            print("Marcadores não encontrados em index.html — nada foi alterado.", file=sys.stderr)
            sys.exit(1)
        alvo.write_text(s, encoding="utf-8")
        print(f"Injetado: {dados['counts']['arvore']} nós na árvore, "
              f"{len(dados['edges'])} arestas, {len(dados['verbetes'])} verbetes com prosa.")
    else:
        print(bloco)
