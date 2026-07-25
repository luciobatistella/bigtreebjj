#!/usr/bin/env python3
"""
Constroi a arvore de linhagem a partir do fighters_details.csv.

Etapas:
 1. Extrai o(s) professor(es) de cada bio via padroes linguisticos
 2. Resolve cada nome extraido contra os lutadores da base (entity resolution)
 3. Emite lineage.json (arvore) + lineage_review.csv (casos duvidosos)

Cada aresta carrega:
  - confidence: high | medium | low
  - evidence:   o trecho exato da bio que gerou a aresta
  - source_url: URL do perfil de origem
"""

import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict

csv.field_size_limit(sys.maxsize)

IN_CSV = "fighters_details.csv"
OUT_JSON = "lineage.json"
OUT_REVIEW = "lineage_review.csv"
OUT_EDGES = "lineage_edges.csv"

# Ruido comum que aparece grudado nos nomes por causa de links sem espaco
KNOWN_TOKENS = set()  # preenchido em main() com nomes reais da base

STOPWORDS = {
    "the", "and", "his", "her", "him", "who", "which", "that", "with", "from",
    "black", "belt", "brazilian", "jiu", "jitsu", "jiu-jitsu", "team", "academy",
    "professor", "coach", "master", "at", "in", "of", "a", "an", "he", "she",
    "having", "also", "before", "after", "later", "while", "during", "under",
    "is", "was", "were", "been", "being", "this", "these", "those", "it",
}


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def norm(s):
    """Normaliza para comparacao: sem acento, minusculo, so letras e espaco."""
    s = strip_accents(s or "").lower()
    s = re.sub(r"[^a-z\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# Palavras coladas no FIM de um nome por links sem espaco:
#   "Fabio Gurgelof Alliance", "Leo Vieiraon November", "Regis Lebreand"
# CUIDADO: nao pode quebrar nomes legitimos que CONTEM essas letras
# (Carlson -> "Carls on", Wanderlei -> "Wander lei"). Por isso exigimos:
#   - pelo menos 4 letras antes da cauda (nome de verdade)
#   - a cauda seguida de espaco+Maiuscula, pontuacao ou fim de texto
GLUE_TAIL = re.compile(
    r"(?<=[a-zà-ÿ]{4})"
    r"(of|and|who|which|from|being|having|while)"
    r"(?=\s+[A-ZÀ-Ý0-9]|[,\.;]|$)"
)


NICKNAME_Q = re.compile(r"[\"“”‘’']\s*[^\"“”‘’']{1,25}?\s*[\"“”‘’']")


def normalize_ws(text):
    """nbsp e aspas tipograficas viram equivalentes ASCII para os regex."""
    return (text.replace("\xa0", " ").replace("\u2019", "'")
                .replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"'))


def split_glued(text):
    text = normalize_ws(text)
    """Normaliza o texto sujo do site antes de aplicar os padroes. Casos:
    1. 'underLloyd Irvin'   -> minuscula seguida de maiuscula
    2. 'Fabio Gurgelof'     -> nome seguido de preposicao colada
    3. 'Marcio "Pe de Pano" Cruz' -> apelido entre aspas no meio do nome
    O apelido e removido AQUI (antes do regex) porque as aspas interrompem
    a captura do sobrenome que vem depois.
    """
    text = re.sub(r"([a-zà-ÿ])([A-ZÀ-Ý])", r"\1 \2", text)
    text = NICKNAME_Q.sub(" ", text)
    text = GLUE_TAIL.sub(r" \1", text)
    return re.sub(r"\s{2,}", " ", text)


def clean_name(raw):
    """Limpa um nome candidato extraido da bio."""
    if not raw:
        return None
    n = split_glued(raw)
    # Remove apelido entre aspas: Alan "Finfou" do Nascimento -> Alan do Nascimento
    n = re.sub(r"[\"“”'‘’]\s*[^\"“”'‘’]{1,20}\s*[\"“”'‘’]", " ", n)
    n = re.sub(r"\s+", " ", n).strip(" ,.;:—-\u2013\u2014")

    # Remove cauda colada palavra a palavra: "Vieiraon"->"Vieira", "Gurgelof"->"Gurgel".
    # SO removemos se o resultado ainda for um sobrenome conhecido da base
    # (KNOWN_TOKENS). Sem essa checagem, "Carlson" viraria "Carls".
    TAILS = ("of", "and", "who", "which", "from", "on", "at", "in", "is", "was")
    fixed = []
    for w in n.split():
        core = re.sub(r"[^\wÀ-ÿ]", "", w)
        lc = core.lower()
        for t in TAILS:
            if len(core) > len(t) + 2 and lc.endswith(t):
                stem = lc[: -len(t)]
                # so corta se o radical for nome conhecido E a palavra inteira nao for
                if stem in KNOWN_TOKENS and lc not in KNOWN_TOKENS:
                    w = w[: len(w) - len(t)]
                break
        fixed.append(w)
    n = " ".join(fixed)

    # O site duplica nomes de links: "Leo NogueiraLeo Nogueira"
    words = n.split()
    half = len(words) // 2
    if len(words) >= 4 and words[:half] == words[half:]:
        words = words[:half]
        n = " ".join(words)

    # Corta no primeiro stopword (pega "Lloyd Irvin having also" -> "Lloyd Irvin").
    # Particulas de nome (de/da/do/la...) so valem se houver nome depois delas.
    PARTICLES = {"de", "da", "do", "dos", "das", "la", "van", "von", "del"}
    kept = []
    for i, w in enumerate(words):
        nw = norm(w)
        if nw in PARTICLES:
            nxt = norm(words[i + 1]) if i + 1 < len(words) else ""
            if nxt and nxt not in STOPWORDS:
                kept.append(w)
                continue
            break
        if nw in STOPWORDS:
            break
        kept.append(w)
    n = " ".join(kept).strip(" .,;:")
    words = n.split()

    if not (2 <= len(n.split()) <= 5):
        return None
    if len(n) < 5 or len(n) > 45:
        return None
    # Precisa parecer nome proprio (particulas minusculas sao aceitas)
    PARTICLES = {"de", "da", "do", "dos", "das", "la", "van", "von", "del"}
    for w in n.split():
        if not w or not w[0].isalpha():
            continue
        if not w[0].isupper() and norm(w) not in PARTICLES:
            return None
    return n


# Titulos/apostos que precedem o nome e devem ser pulados.
# Cobrem "under the prestigiousCrolin Gracie", "under GF Team's leader, MasterJulio Cesar",
# "under his father, Alexandre Vomero Manara", "under two of the best coaches..., Vini Campelo".
TITLES = (
    r"(?:"
    r"the\s+(?:prestigious|illustrious|legendary|famous|renowned|great)|"
    r"master|masters|mestre|coach|professor|prof\.?|"
    r"his\s+father|her\s+father|his\s+brother|her\s+brother|his\s+uncle|her\s+uncle|"
    r"ADCC\s+medalist|black\s+belt|"
    r"[A-ZÀ-Ý][A-Za-zÀ-ÿ'\-\.]*(?:\s+[A-Za-zÀ-ÿ'\-\.]+){0,3}[’']s\s+(?:leader|founder|head\s+coach)|"
    r"two\s+of\s+the\s+best\s+coaches\s+in\s+the\s+world"
    r")"
    r"[\s,]+"
)

NAME_CHARS = (r"[A-ZÀ-Ý][A-Za-zÀ-ÿ'\-\.]*"
              r"(?:\s+(?:de|da|do|dos|das|van|von)\s+[A-Za-zÀ-ÿ'\-\.]+)?"
              r"(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ'\-\.]*){0,3}")

# "black belt" pode vir com muita coisa no meio antes do "under":
#   black belt under / black belt in jiu-jitsu under / 3rd degree black belt under
BB = r"black[\-\s]?belt(?:\s+in\s+[A-Za-zÀ-ÿ\-\s]{0,25}?)?"

PATTERNS = [
    ("high",   re.compile(BB + r"\s+under\s+(?:" + TITLES + r"){0,3}(" + NAME_CHARS + ")", re.I)),
    ("high",   re.compile(BB + r"\s+(?:from|by)\s+(?:" + TITLES + r"){0,3}(" + NAME_CHARS + ")", re.I)),
    ("high",   re.compile(r"promoted to black belt by\s+(?:" + TITLES + r"){0,3}(" + NAME_CHARS + ")", re.I)),
    ("high",   re.compile(r"received (?:his|her) black belt from\s+(?:" + TITLES + r"){0,3}(" + NAME_CHARS + ")", re.I)),
    ("medium", re.compile(r"promoted by\s+(?:" + TITLES + r"){0,3}(" + NAME_CHARS + ")", re.I)),
    ("medium", re.compile(r"graduated (?:to black belt )?by\s+(?:" + TITLES + r"){0,3}(" + NAME_CHARS + ")", re.I)),
    ("low",    re.compile(r"under the (?:guidance|tutelage) of\s+(?:" + TITLES + r"){0,3}(" + NAME_CHARS + ")", re.I)),
    ("low",    re.compile(r"student of\s+(?:" + TITLES + r"){0,3}(" + NAME_CHARS + ")", re.I)),
]

# Conjuncoes que ligam multiplos professores: "under X and Y"
MULTI_SPLIT = re.compile(r"\s+and\s+|\s*&\s*|\s*,\s*", re.I)


# "black belt by Carlos Gracie Senior's son, X" -> o professor e o FILHO, nao Carlos.
# Marcamos essas arestas como baixa confianca em vez de afirmar o parentesco errado.
POSSESSIVE_AFTER = re.compile(r"^['’]s\s+(?:son|brother|father|nephew|cousin|student|daughter)", re.I)


def extract_teachers(bio):
    """Retorna lista de (nome_bruto, confianca, trecho_evidencia)."""
    if not bio:
        return []
    text = split_glued(bio)
    found = []
    seen = set()

    for conf, pat in PATTERNS:
        for m in pat.finditer(text):
            start = max(0, m.start() - 20)
            end = min(len(text), m.end() + 60)
            evidence = text[start:end].strip()

            # Tenta capturar co-professores logo depois: "under X and Y"
            tail = text[m.end():m.end() + 60]
            candidates = [m.group(1)]
            tail_m = re.match(r"\s+and\s+(" + NAME_CHARS + ")", tail)
            if tail_m:
                candidates.append(tail_m.group(1))

            # Se logo depois do nome vem "'s son/brother/...", o professor real
            # e outra pessoa -- rebaixa a confianca para revisao manual.
            conf_here = conf
            if POSSESSIVE_AFTER.match(text[m.end():m.end() + 30]):
                conf_here = "low"

            for raw in candidates:
                name = clean_name(raw)
                if not name:
                    continue
                key = norm(name)
                if key in seen:
                    continue
                seen.add(key)
                found.append((name, conf_here, evidence))

        if found and conf == "high" and all(f[1] == "high" for f in found):
            break  # nao mistura padroes fracos quando ja achou um forte

    return found


def build_index(rows):
    """Indices para resolver nomes contra a base."""
    by_full = defaultdict(list)
    by_last = defaultdict(list)
    for r in rows:
        full = norm(f"{r['first_name']} {r['last_name']}")
        if full:
            by_full[full].append(r)
        last = norm(r["last_name"])
        if last:
            by_last[last].append(r)
        nick = norm(r.get("nickname") or "")
        if nick and len(nick) > 3:
            by_full[nick].append(r)
    return by_full, by_last


def resolve(name, by_full, by_last):
    """Casa um nome extraido com um perfil da base.
    Retorna (row|None, match_type)."""
    key = norm(name)
    if key in by_full:
        cands = by_full[key]
        return (cands[0], "exact") if len(cands) == 1 else (cands[0], "ambiguous")

    parts = key.split()
    if len(parts) >= 2:
        first, last = parts[0], parts[-1]
        cands = by_last.get(last, [])
        # mesmo sobrenome + mesma inicial do primeiro nome
        narrowed = [c for c in cands if norm(c["first_name"]).startswith(first[0])]
        exact_first = [c for c in narrowed if norm(c["first_name"]) == first]
        if len(exact_first) == 1:
            return exact_first[0], "exact"
        if len(narrowed) == 1:
            return narrowed[0], "initial"
        if len(narrowed) > 1:
            return narrowed[0], "ambiguous"
    return None, "unmatched"


def main():
    rows = list(csv.DictReader(open(IN_CSV, encoding="utf-8")))
    for r in rows:
        r["_id"] = r["profile_url"].split("=")[-1]
        r["_name"] = f"{r['first_name']} {r['last_name']}".strip()

    # Vocabulario de nomes reais: usado para validar cortes de palavras coladas
    for r in rows:
        for part in (r["first_name"] + " " + r["last_name"]).split():
            p = norm(part)
            if len(p) > 2:
                KNOWN_TOKENS.add(p)

    by_full, by_last = build_index(rows)
    by_id = {r["_id"]: r for r in rows}

    edges = []
    review = []
    stats = defaultdict(int)

    for r in rows:
        teachers = extract_teachers(r["bio"])
        if not teachers:
            stats["no_pattern"] += 1
            review.append({
                "fighter": r["_name"], "fighter_url": r["profile_url"],
                "extracted_name": "", "issue": "nenhum padrao encontrado",
                "evidence": (r["bio"] or "")[:200],
            })
            continue

        matched_any = False
        for name, conf, evidence in teachers:
            target, mtype = resolve(name, by_full, by_last)

            if target is None:
                stats["unmatched"] += 1
                review.append({
                    "fighter": r["_name"], "fighter_url": r["profile_url"],
                    "extracted_name": name, "issue": "professor sem perfil na base",
                    "evidence": evidence,
                })
                continue

            if target["_id"] == r["_id"]:
                continue  # auto-referencia, descarta

            matched_any = True
            # confianca final combina forca do padrao + qualidade do match
            if mtype == "ambiguous":
                final_conf = "low"
                review.append({
                    "fighter": r["_name"], "fighter_url": r["profile_url"],
                    "extracted_name": name, "issue": f"match ambiguo -> {target['_name']}",
                    "evidence": evidence,
                })
            elif mtype == "initial" and conf == "high":
                final_conf = "medium"
            elif mtype == "initial":
                final_conf = "low"
            else:
                final_conf = conf

            stats[f"edge_{final_conf}"] += 1
            edges.append({
                "student_id": r["_id"], "student_name": r["_name"],
                "teacher_id": target["_id"], "teacher_name": target["_name"],
                "confidence": final_conf, "match_type": mtype,
                "evidence": evidence, "source_url": r["profile_url"],
            })

        if not matched_any:
            stats["pattern_but_unmatched"] += 1

    # ---- Monta a arvore ----
    # Um aluno pode ter varios professores; para a ARVORE escolhemos o de maior
    # confianca (o resto fica registrado em lineage_edges.csv como co-professor).
    rank = {"high": 0, "medium": 1, "low": 2}
    best_parent = {}
    for e in edges:
        sid = e["student_id"]
        if sid not in best_parent or rank[e["confidence"]] < rank[best_parent[sid]["confidence"]]:
            best_parent[sid] = e

    children = defaultdict(list)
    for sid, e in best_parent.items():
        children[e["teacher_id"]].append(sid)

    # Detecta e quebra ciclos (A promoveu B, B promoveu A)
    def has_cycle(start):
        seen, cur = set(), start
        while cur in best_parent:
            cur = best_parent[cur]["teacher_id"]
            if cur in seen or cur == start:
                return True
            seen.add(cur)
        return False

    removed_cycles = 0
    for sid in list(best_parent.keys()):
        if has_cycle(sid):
            e = best_parent.pop(sid)
            children[e["teacher_id"]].remove(sid)
            removed_cycles += 1
            review.append({
                "fighter": e["student_name"], "fighter_url": e["source_url"],
                "extracted_name": e["teacher_name"], "issue": "ciclo detectado - aresta removida",
                "evidence": e["evidence"],
            })

    roots = [r["_id"] for r in rows if r["_id"] not in best_parent and children.get(r["_id"])]

    def build(nid, depth=0, path=None):
        path = path or set()
        if nid in path or depth > 25:
            return None
        r = by_id[nid]
        e = best_parent.get(nid)
        node = {
            "id": nid,
            "name": r["_name"],
            "nickname": r.get("nickname") or "",
            "team": r.get("team") or "",
            "url": r["profile_url"],
            "bio": (r.get("bio") or "")[:400],
            "confidence": e["confidence"] if e else "root",
            "evidence": e["evidence"] if e else "",
        }
        kids = []
        for c in sorted(children.get(nid, []), key=lambda x: by_id[x]["_name"]):
            sub = build(c, depth + 1, path | {nid})
            if sub:
                kids.append(sub)
        if kids:
            node["children"] = kids
        return node

    forest = [build(rid) for rid in roots]
    forest = [f for f in forest if f]
    forest.sort(key=lambda n: -len(json.dumps(n)))

    json.dump(forest, open(OUT_JSON, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    with open(OUT_EDGES, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["student_id", "student_name", "teacher_id",
                                          "teacher_name", "confidence", "match_type",
                                          "evidence", "source_url"])
        w.writeheader()
        w.writerows(edges)

    with open(OUT_REVIEW, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["fighter", "fighter_url", "extracted_name",
                                          "issue", "evidence"])
        w.writeheader()
        w.writerows(review)

    total = len(rows)
    print(f"lutadores na base:        {total}")
    print(f"arestas extraidas:        {len(edges)}")
    print(f"  alta confianca:         {stats['edge_high']}")
    print(f"  media confianca:        {stats['edge_medium']}")
    print(f"  baixa confianca:        {stats['edge_low']}")
    print(f"alunos com professor:     {len(best_parent)} ({100*len(best_parent)/total:.1f}%)")
    print(f"sem padrao na bio:        {stats['no_pattern']}")
    print(f"professor fora da base:   {stats['unmatched']}")
    print(f"ciclos removidos:         {removed_cycles}")
    print(f"raizes (arvores):         {len(forest)}")
    print(f"casos para revisao:       {len(review)}")
    if forest:
        def size(n):
            return 1 + sum(size(c) for c in n.get("children", []))
        print("\nmaiores arvores:")
        for f in forest[:8]:
            print(f"  {f['name']:32} {size(f):5} descendentes")


if __name__ == "__main__":
    main()
