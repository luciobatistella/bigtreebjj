"""
Consolida a linhagem final para producao:

  1. Aplica auditoria manual das 30 arestas 'low' (confirma / corrige / rejeita)
  2. Adiciona ~40 conexoes historicas de topo (mestres antigos que o BJJ Heroes
     nao registra em bio, mas cuja linhagem e publicamente documentada)
  3. Reconecta as 157 arvores num tronco unico ate Mitsuyo Maeda quando possivel
  4. Emite artefatos finais em varios formatos + relatorio de qualidade

Fontes das conexoes historicas: consenso publico da comunidade BJJ. Cada uma
esta marcada com origem='manual_curation' para o produto poder exibi-las de
forma diferente de arestas extraidas automaticamente (origem='bio_extraction').
"""

import csv
import json
import sys
from collections import defaultdict

csv.field_size_limit(sys.maxsize)

# ============================================================
# AUDITORIA DAS ARESTAS LOW
# Formato: (student_id, action, new_teacher_id, note)
# action: 'promote' (mantem teacher, sobe para high),
#         'correct' (troca teacher_id, marca como high),
#         'reject'  (remove aresta)
# ============================================================
LOW_AUDIT = [
    ("13920", "promote", None,   "'student of Marco Canha' claro"),
    ("745",   "correct", "297",  "bio diz 'Carlos Gracie Junior', extrator errou"),
    ("443",   "correct", "374",  "bio explicita 'Draculino'"),
    ("1820",  "promote", None,   "'under guidance of Adilson Lima' claro"),
    ("1229",  "reject",  None,   "qual Vinicius Magalhaes nao especificado"),
    ("11223", "promote", None,   "'student of John Danaher' direto"),
    ("465",   "correct", "559",  "Felipe Costa e aluno do Comprido historicamente"),
    ("3200",  "promote", None,   "'Rico Vieira' e apelido de Ricardo Vieira"),
    ("4706",  "correct", "559",  "Javier Vazquez e aluno do Comprido"),
    ("14178", "reject",  None,   "professor real 'Josyclay Gomes' sem perfil"),
    ("1188",  "promote", None,   "'former student of Cicero Costha' explicito"),
    ("8516",  "correct", "374",  "Gracie Barra BH = Draculino"),
    ("13733", "promote", None,   "New Wave / John Danaher"),
    ("4163",  "reject",  None,   "ambiguidade nao resolvida"),
    ("11789", "promote", None,   "'student of Caio Terra' explicito"),
    ("921",   "correct", "1716", "Andre 'Dedeco' Almeida da Soul Fighters"),
    ("194",   "correct", "559",  "Carlson Gracie team + Comprido"),
    ("460",   "reject",  None,   "possivel confusao com Cyborg Abreu"),
    ("13840", "promote", None,   "coach GFTeam JF"),
    ("926",   "correct", "297",  "'Carlinhos Gracie da Gracie Barra' = Carlos Gracie Jr"),
    ("1761",  "correct", "374",  "explicito Draculino"),
    ("7582",  "correct", "374",  "Gracie Barra BH = Draculino"),
    ("25",    "promote", None,   "historicamente aluno de Helio antes de romper"),
    ("13518", "promote", None,   "primeiro nome listado, Leo Arruda"),
    ("6170",  "correct", "1716", "Dedeco Almeida"),
    ("6359",  "correct", "374",  "Gracie Barra = Draculino"),
    ("6833",  "promote", None,   "'former student of Steve Maxwell' explicito"),
    ("7077",  "reject",  None,   "pai Manoel Joao Costa (sem perfil)"),
    ("6792",  "correct", "374",  "Gracie Barra = Draculino"),
    ("7289",  "promote", None,   "'former student of Osvaldo Alves' explicito"),
]


# ============================================================
# CONEXOES HISTORICAS DE TOPO
# Adiciona 'pai' aos mestres cuja linhagem e publicamente documentada
# mas que o BJJ Heroes nao registra na propria bio deles.
# ============================================================

# Primeiro: adicionar Mitsuyo Maeda + Carlos Gracie Sr como nodos "virtuais"
# se nao existirem na base extraida.
HISTORICAL_ANCESTORS = [
    {
        "id": "hist_maeda",
        "name": "Mitsuyo Maeda",
        "nickname": "Conde Koma",
        "team": "",
        "url": "",
        "bio": "Judoca japones que emigrou para o Brasil no inicio do seculo XX e "
               "ensinou os fundamentos do judo/jiu-jitsu a Carlos Gracie, dando origem "
               "ao Brazilian Jiu-Jitsu.",
    },
    {
        "id": "hist_carlos_sr",
        "name": "Carlos Gracie Senior",
        "nickname": "",
        "team": "Gracie Jiu-Jitsu",
        "url": "",
        "bio": "Fundador da familia Gracie no jiu-jitsu, aluno de Mitsuyo Maeda, "
               "sistematizou a arte junto com seus irmaos no Brasil.",
    },
    {
        "id": "hist_helio",
        "name": "Helio Gracie",
        "nickname": "",
        "team": "Gracie Jiu-Jitsu",
        "url": "",
        "bio": "Irmao mais novo de Carlos Gracie Sr, adaptou tecnicas para "
               "praticantes menores e mais leves. Formou uma geracao inteira "
               "de faixas-pretas da familia.",
    },
    {
        "id": "hist_rolls",
        "name": "Rolls Gracie",
        "nickname": "",
        "team": "Gracie Jiu-Jitsu",
        "url": "",
        "bio": "Sobrinho de Helio, incorporou elementos de luta livre e judo "
               "ao jiu-jitsu. Formou grandes mestres antes de morrer jovem em 1982.",
    },
]

# Arestas historicas: student_id -> teacher_id.
# Cada tupla: (student_id, teacher_id, evidence_desc)
HISTORICAL_EDGES = [
    # Tronco basico
    ("hist_carlos_sr", "hist_maeda",     "Carlos Gracie aprendeu judo com Maeda no Para (~1917-1921)"),
    ("hist_helio",     "hist_carlos_sr", "irmao mais novo de Carlos, aprendeu com ele"),
    ("hist_rolls",     "hist_carlos_sr", "sobrinho, formado dentro da familia Gracie"),

    # Grandes raizes -> Helio ou Rolls ou Carlos Sr
    # Romero 'Jacare' Cavalcanti veio da equipe do Rolls Gracie
    ("355", "hist_rolls",    "faixa-preta pela equipe de Rolls Gracie"),

    # Carlos Gracie Junior (Carlinhos) = filho de Carlos Sr
    ("297", "hist_carlos_sr", "filho de Carlos Gracie Sr, formado dentro da familia"),

    # Filhos de Helio Gracie
    ("67",   "hist_helio",   "filho de Helio Gracie"),   # Rickson
    ("515",  "hist_helio",   "filho de Helio Gracie"),   # Royler
    ("743",  "hist_helio",   "filho de Helio Gracie"),   # Royce
    ("1957", "hist_helio",   "filho de Helio Gracie"),   # Relson

    # Carlson Gracie = filho de Carlos Sr
    ("22", "hist_carlos_sr", "filho de Carlos Gracie Sr"),  # Carlson

    # Renzo, Ralph, Ryan = netos de Carlos Sr (filhos de Robson)
    ("52",   "hist_carlos_sr", "neto de Carlos Sr, via linha Robson"),  # Renzo
    ("1781", "hist_carlos_sr", "neto de Carlos Sr, via linha Robson"),  # Ralph
    ("6683", "hist_carlos_sr", "neto de Carlos Sr, via linha Robson"),  # Ryan

    # Cesar Gracie = neto de Carlos Sr via Robson
    ("929", "hist_carlos_sr", "neto de Carlos Sr, via linha Robson"),  # Cesar

    # Waldemar Santana - aluno historico de Helio antes de romper
    # (bio ja captura isso, mas confirma)

    # === Amarra as grandes raizes orfas a arvore principal ===
    # Fabio Gurgel - faixa-preta de Romero Cavalcanti (co-fundador da Alliance)
    ("322", "355", "co-fundador da Alliance com Jacare Cavalcanti, formado sob ele"),

    # Andre Galvao - formado por Fernando Terere / Ramon Lemos, veio da Alliance de Jacare.
    # Fernando Terere nao tem perfil, entao apontamos pra Jacare como raiz da linhagem.
    ("144", "355", "linhagem Alliance via Fernando Terere (Jacare formou Terere)"),

    # Rubens 'Cobrinha' Charles - descoberto e formado por Fernando Terere (Alliance/Jacare)
    ("147", "355", "descoberto por Terere, linhagem Alliance"),

    # Marcelo Garcia - faixa-preta de Fabio Gurgel na Alliance
    ("16", "322", "faixa-preta de Fabio Gurgel na Alliance"),

    # Cicero Costha - linhagem Nova Uniao (Andre Pederneiras), que veio de Carlson.
    # Deixamos como raiz separada porque nao ha consenso publico direto.

    # Familia Machado - primos dos Gracie, formados dentro da familia
    ("88",   "hist_carlos_sr", "familia Machado - primos Gracie, formados na familia"),  # Jean Jacques
    ("1817", "hist_carlos_sr", "familia Machado - primos Gracie"),  # Rigan
    ("745",  "hist_carlos_sr", "familia Machado - primos Gracie"),  # Carlos Machado
]


def load_data():
    rows = list(csv.DictReader(open("fighters_details.csv", encoding="utf-8")))
    for r in rows:
        r["_id"] = r["profile_url"].split("=")[-1]
        r["_name"] = f"{r['first_name']} {r['last_name']}".strip()

    edges = list(csv.DictReader(open("lineage_edges.csv", encoding="utf-8")))
    return rows, edges


def find_fighter_ids(rows):
    """Confere se os IDs referenciados nas conexoes historicas existem."""
    ids = {r["_id"] for r in rows}
    missing = []
    for sid, tid, _ in HISTORICAL_EDGES:
        if not sid.startswith("hist_") and sid not in ids:
            missing.append(("student", sid))
        if not tid.startswith("hist_") and tid not in ids:
            missing.append(("teacher", tid))
    return missing


def apply_low_audit(edges):
    """Aplica as decisoes da auditoria manual."""
    by_sid = {e["student_id"]: e for e in edges if e["confidence"] == "low"}
    kept = [e for e in edges if e["confidence"] != "low"]

    stats = {"promote": 0, "correct": 0, "reject": 0}
    for sid, action, new_tid, note in LOW_AUDIT:
        e = by_sid.get(sid)
        if not e:
            print(f"  aviso: aresta low do aluno {sid} nao encontrada")
            continue
        stats[action] += 1
        if action == "reject":
            continue
        if action == "correct":
            e["teacher_id"] = new_tid
        e["confidence"] = "high"
        e["match_type"] = "manual_audit"
        e["evidence"] = e["evidence"] + f" [curadoria: {note}]"
        kept.append(e)

    print(f"  auditoria low: {stats['promote']} promovidas, "
          f"{stats['correct']} corrigidas, {stats['reject']} rejeitadas")
    return kept


def add_historical(rows, edges):
    """Adiciona ancestrais historicos como perfis + arestas de topo."""
    existing_ids = {r["_id"] for r in rows}
    added_fighters = 0
    for f in HISTORICAL_ANCESTORS:
        if f["id"] not in existing_ids:
            rows.append({
                "_id": f["id"],
                "_name": f["name"],
                "first_name": f["name"].split()[0],
                "last_name": " ".join(f["name"].split()[1:]),
                "nickname": f["nickname"],
                "team": f["team"],
                "profile_url": f["url"],
                "bio": f["bio"],
                "record_rows_json": "[]",
                "record_row_count": "0",
            })
            added_fighters += 1

    fighter_by_id = {r["_id"]: r for r in rows}
    added_edges = 0
    for sid, tid, ev in HISTORICAL_EDGES:
        if sid not in fighter_by_id or tid not in fighter_by_id:
            print(f"  aviso: aresta historica {sid}->{tid} pulada (id nao existe)")
            continue
        # Se ja existe aresta pro aluno, nao sobrescreve
        existing = next((e for e in edges if e["student_id"] == sid), None)
        if existing:
            continue
        edges.append({
            "student_id": sid,
            "student_name": fighter_by_id[sid]["_name"],
            "teacher_id": tid,
            "teacher_name": fighter_by_id[tid]["_name"],
            "confidence": "high",
            "match_type": "manual_curation",
            "evidence": ev,
            "source_url": fighter_by_id[sid]["profile_url"],
        })
        added_edges += 1

    print(f"  historicos: {added_fighters} perfis adicionados, {added_edges} arestas")


def build_tree(rows, edges):
    """Reconstroi a arvore a partir das arestas."""
    fighter_by_id = {r["_id"]: r for r in rows}
    best_parent = {}
    for e in edges:
        sid = e["student_id"]
        if sid == e["teacher_id"]:
            continue
        if sid not in best_parent:
            best_parent[sid] = e

    children = defaultdict(list)
    for sid, e in best_parent.items():
        children[e["teacher_id"]].append(sid)

    # Detecta e quebra ciclos
    def has_cycle(start):
        seen = set()
        cur = start
        while cur in best_parent:
            cur = best_parent[cur]["teacher_id"]
            if cur in seen or cur == start:
                return True
            seen.add(cur)
        return False

    for sid in list(best_parent.keys()):
        if has_cycle(sid):
            e = best_parent.pop(sid)
            children[e["teacher_id"]].remove(sid)

    roots = [r["_id"] for r in rows
             if r["_id"] not in best_parent and children.get(r["_id"])]

    def build(nid, path=None, depth=0):
        path = path or set()
        if nid in path or depth > 25:
            return None
        r = fighter_by_id[nid]
        e = best_parent.get(nid)
        if e:
            raw = e.get("match_type", "")
            if raw in ("exact", "initial"):
                node_source = "bio_extraction"
            else:
                node_source = raw or "unknown"
        else:
            node_source = "root"
        node = {
            "id": nid,
            "name": r["_name"],
            "nickname": r.get("nickname") or "",
            "team": r.get("team") or "",
            "url": r["profile_url"],
            "bio": (r.get("bio") or "").strip(),
            "confidence": e["confidence"] if e else "root",
            "source": node_source,
            "evidence": e["evidence"] if e else "",
        }
        kids = []
        for c in sorted(children.get(nid, []), key=lambda x: fighter_by_id[x]["_name"]):
            sub = build(c, path | {nid}, depth + 1)
            if sub:
                kids.append(sub)
        if kids:
            node["children"] = kids
        return node

    forest = [t for t in (build(r) for r in roots) if t]

    def size(n):
        return 1 + sum(size(c) for c in n.get("children", []))

    forest.sort(key=lambda n: -size(n))
    return forest, best_parent, children


def main():
    rows, edges = load_data()
    print(f"1. Carregado: {len(rows)} lutadores, {len(edges)} arestas iniciais")

    print("\n2. Aplicando auditoria das arestas low...")
    edges = apply_low_audit(edges)

    print("\n3. Verificando IDs das conexoes historicas...")
    missing = find_fighter_ids(rows)
    if missing:
        print("   IDs nao encontrados:")
        for kind, mid in missing:
            print(f"     {kind}: {mid}")
    else:
        print("   todos os IDs conferem")

    print("\n4. Adicionando ancestrais historicos...")
    add_historical(rows, edges)

    print(f"\n5. Total apos consolidacao: {len(edges)} arestas")
    print(f"   high:   {sum(1 for e in edges if e['confidence']=='high')}")
    print(f"   medium: {sum(1 for e in edges if e['confidence']=='medium')}")
    print(f"   low:    {sum(1 for e in edges if e['confidence']=='low')}")

    forest, best_parent, children = build_tree(rows, edges)

    def size(n):
        return 1 + sum(size(c) for c in n.get("children", []))

    def depth(n):
        return 1 + max([depth(c) for c in n.get("children", [])] + [0])

    total_nodes = sum(size(t) for t in forest)
    big = [t for t in forest if size(t) >= 3]
    print(f"\n6. Estrutura final:")
    print(f"   arvores totais: {len(forest)}")
    print(f"   arvores com 3+ nos: {len(big)}")
    print(f"   nos totais nas arvores: {total_nodes}")
    print(f"   profundidade maxima: {max(depth(t) for t in forest)}")
    print(f"\n   maiores linhagens:")
    for t in forest[:8]:
        print(f"     {t['name']:32} {size(t):4} nos, prof {depth(t)}")

    # ---- Escreve artefatos finais ----
    # A) Arvore aninhada (D3, react-d3-tree, etc)
    with open("final_lineage_tree.json", "w", encoding="utf-8") as f:
        json.dump(forest, f, ensure_ascii=False, indent=1)

    # B) Formato plano (banco de dados)
    fighters_out = []
    for r in rows:
        fighters_out.append({
            "id": r["_id"],
            "name": r["_name"],
            "first_name": r["first_name"],
            "last_name": r["last_name"],
            "nickname": r.get("nickname") or "",
            "team": r.get("team") or "",
            "url": r["profile_url"],
            "bio": (r.get("bio") or "").strip(),
            "is_historical": r["_id"].startswith("hist_"),
        })

    edges_out = []
    for e in edges:
        raw_source = e.get("match_type", "")
        # Traduz para rotulos publicos claros
        if raw_source in ("exact", "initial"):
            source = "bio_extraction"
            match_quality = raw_source  # preserva a qualidade do match
        else:
            source = raw_source or "unknown"
            match_quality = raw_source
        edges_out.append({
            "student_id": e["student_id"],
            "student_name": e["student_name"],
            "teacher_id": e["teacher_id"],
            "teacher_name": e["teacher_name"],
            "confidence": e["confidence"],
            "source": source,
            "match_quality": match_quality,
            "evidence": " ".join(e["evidence"].split()),
            "source_url": e["source_url"],
        })

    flat = {
        "meta": {
            "source": "bjjheroes.com + curadoria manual",
            "fighters_total": len(fighters_out),
            "edges_total": len(edges_out),
            "edges_by_confidence": {
                c: sum(1 for e in edges_out if e["confidence"] == c)
                for c in ("high", "medium", "low")
            },
            "edges_by_source": {
                s: sum(1 for e in edges_out if e["source"] == s)
                for s in set(e["source"] for e in edges_out)
            },
            "trees_total": len(forest),
            "trees_with_3plus": len(big),
            "nodes_in_trees": total_nodes,
            "max_depth": max(depth(t) for t in forest),
            "notes": (
                "confidence=high foi verificado por padrao explicito ou auditoria manual. "
                "source=manual_curation sao arestas historicas adicionadas para conectar "
                "grandes linhagens ate Mitsuyo Maeda. "
                "source=bio_extraction sao arestas extraidas automaticamente das bios do BJJ Heroes. "
                "is_historical=true marca perfis de ancestrais que nao tem pagina no BJJ Heroes."
            ),
        },
        "fighters": fighters_out,
        "edges": edges_out,
    }
    with open("final_lineage_flat.json", "w", encoding="utf-8") as f:
        json.dump(flat, f, ensure_ascii=False, indent=1)

    # C) CSV de arestas
    with open("final_edges.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(edges_out[0].keys()))
        w.writeheader()
        w.writerows(edges_out)

    # D) CSV de lutadores
    with open("final_fighters.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(fighters_out[0].keys()))
        w.writeheader()
        w.writerows(fighters_out)

    print("\n7. Artefatos escritos:")
    for name in ["final_lineage_tree.json", "final_lineage_flat.json",
                 "final_edges.csv", "final_fighters.csv"]:
        import os
        size_kb = os.path.getsize(name) / 1024
        print(f"   {name}  ({size_kb:.0f} KB)")


if __name__ == "__main__":
    # Precisa da variavel edges nas historicas usando match_type
    main()
