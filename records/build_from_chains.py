#!/usr/bin/env python3
"""
Constroi a arvore de linhagem a partir das CADEIAS ESTRUTURADAS do BJJ Heroes
(campo 'Lineage:' de cada perfil, coletado pelo step enrich do scraper).

Requer:
  fighters_lineage.csv  (do: python bjjheroes_scraper.py --step enrich)
  fighters_details.csv  (bios/equipes, ja coletado)

Vantagens sobre o build_lineage.py (regex na bio):
  - cadeia COMPLETA ate Maeda, nao so o professor direto
  - inclui ancestrais sem perfil proprio (Marcelo Behring, Waldomiro Perez...)
  - links canonicos resolvem ambiguidade de nomes (2x Rodrigo Medeiros etc)
  - todo elo e dado declarado pelo proprio site => confidence 'high'

Saidas:
  chains_lineage_tree.json  arvore aninhada unica (ou floresta minima)
  chains_lineage_flat.json  nos + arestas para banco
  chains_edges.csv
"""

import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))  # Windows: C long e 32 bits


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def norm(s):
    s = strip_accents(s or "").lower()
    s = re.sub(r"[^a-z\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def url_id(url):
    """ID canonico a partir da URL: ?p=123 -> '123'; /bjj-fighters/slug -> 'slug'."""
    if not url:
        return ""
    m = re.search(r"[?&]p=(\d+)", url)
    if m:
        return m.group(1)
    m = re.search(r"/bjj-fighters/([^/?#]+)", url)
    if m:
        return m.group(1)
    return ""


PAREN_ENTRY_RE = re.compile(r"^\(.*\)[:\s]*$")
QUALIFIERS = {"senior", "junior", "jr", "sr"}

PROSE_STOPWORDS = {
    "was", "were", "and", "who", "which", "their", "many", "most", "others", "other",
    "having", "known", "considered", "among", "today", "legacy", "achievements",
    "still", "also", "especially", "influence", "carried", "regarded", "strongest",
    "fathers", "representatives", "competitors", "instructor", "revolutionized",
    "founder", "successful",
}


def clean_chain(chain):
    """Funde fragmentos de parsing quebrados tipo '(Senior)' na entrada anterior
    da cadeia. Quando o fragmento e o PRIMEIRO elo (sem entrada anterior pra
    fundir -- ex: '(From his First Master):' antes de 'Mitsuyo Maeda'), so
    descarta: e um rotulo da pagina, nao uma pessoa, e vira-lo em no cria um
    ancestral falso acima da raiz de verdade, arrastando a arvore inteira
    (milhares de pessoas) pra debaixo de um perfil fantasma."""
    cleaned = []
    for entry in chain:
        name = (entry.get("name") or "").strip()
        if PAREN_ENTRY_RE.match(name):
            if cleaned:
                prev = cleaned[-1]
                prev["name"] = f"{prev['name']} {name}".strip()
            continue
        cleaned.append(dict(entry))

    # ancestral espurio antes de Maeda: algumas paginas tem um rotulo/nota
    # de rodape ("(From his First Master):", "Dickie Martin's", "1*:") que o
    # parser capturou como se fosse o primeiro elo, empurrando o verdadeiro
    # topo (Mitsuyo Maeda) pra 2a posicao. Ninguem no site e de fato
    # professor de Maeda -- se ele aparece em 2o lugar, o 1o elo e sempre
    # lixo de parsing (confirmado nas 3 ocorrencias reais do dataset).
    if (len(cleaned) >= 2
            and norm(cleaned[1]["name"]) == "mitsuyo maeda"
            and norm(cleaned[0]["name"]) != "mitsuyo maeda"):
        cleaned = cleaned[1:]

    return cleaned


def surname_key(name):
    """Ultima palavra do nome normalizado, ignorando qualificadores tipo 'senior'/'jr'."""
    words = norm(name).split()
    while words and words[-1] in QUALIFIERS:
        words.pop()
    return words[-1] if words else ""


def first_initial(name):
    words = norm(name).split()
    return words[0][0] if words and words[0] else ""


def is_abbrev_name(name):
    """True se o primeiro nome parece uma abreviacao tipo 'M.' ou 'H.'."""
    words = (name or "").strip().split()
    if not words:
        return False
    first_alpha = re.sub(r"[^A-Za-z]", "", words[0])
    return 1 <= len(first_alpha) <= 2


def is_garbage_chain(chain):
    """Algumas paginas do BJJ Heroes falharam na extracao do campo real
    'Lineage:' e o scraper capturou HTML/JS bruto da pagina (meta tags,
    JSON-LD, boilerplate do plugin de SEO) como se cada token fosse um elo --
    vira uma cadeia de centenas de "pessoas" fantasmas (visto em 13 perfis:
    Marcelo Garcia, Oswaldo Fadda, Ricardo Arona etc, com 147-552 elos cada).
    Uma cadeia real de linhagem nunca passa de ~20 elos nem contem esses
    marcadores de codigo.

    Variante mais sutil (Carlson Gracie, Helio Gracie, Luiz Franca, Daniel
    Beleza, Ricardo De La Riva, Sergio Zimmerman, Andre Monteiro, Bruno
    Amorim): quando a extracao falha mas a pagina nao tem HTML solto por
    perto, o scraper cai pra pegar qualquer link + texto entre eles perto da
    bio -- vira uma "cadeia" curta (4-9 elos) feita de pedacos de frase, nao
    nomes. Detecta pela presenca de palavras-funcao que so aparecem em
    prosa em ingles, nunca em nome de pessoa (lista conservadora: nada de
    palavra curta tipo 'in'/'is'/'a', que colide com nomes coreanos, iniciais
    ou fragmentos de acento corrompido tipo 'Fran�a' -> 'a')."""
    if len(chain) > 25:
        return True
    head = " ".join((e.get("name") or "") for e in chain[:4]).lower()
    if "aioseo" in head or "schema.org" in head or "window.datalayer" in head or head.strip() == "html":
        return True
    words = re.findall(r"[a-zA-Z�]{2,}", " ".join((e.get("name") or "") for e in chain).lower())
    return any(w in PROSE_STOPWORDS for w in words)


def main():
    lineage_rows = list(csv.DictReader(open("fighters_lineage.csv", encoding="utf-8")))
    detail_rows = list(csv.DictReader(open("fighters_details.csv", encoding="utf-8")))

    # ---- indice de perfis conhecidos (bio, equipe, foto) ----
    profiles = {}
    for r in detail_rows:
        pid = url_id(r["profile_url"])
        profiles[pid] = {
            "id": pid,
            "name": f"{r['first_name']} {r['last_name']}".strip(),
            "nickname": r.get("nickname") or "",
            "team": r.get("team") or "",
            "url": r["profile_url"],
            "bio": (r.get("bio") or "").strip(),
            "photo": "",
        }
    name_to_id = {norm(p["name"]): pid for pid, p in profiles.items()}

    # fotos vindas do enrich
    for r in lineage_rows:
        pid = url_id(r["profile_url"])
        if pid in profiles and r.get("photo_url"):
            profiles[pid]["photo"] = r["photo_url"]

    # ---- processa cadeias ----
    # cada elo consecutivo (A, B) da cadeia vira aresta B<-A (A e professor de B)
    edges = {}            # (student_id, teacher_id) -> evidence
    virtual = {}          # ancestrais sem perfil na base: name -> vid
    chains_ok = 0
    chains_empty = 0
    chains_garbage = 0

    raw_chains = []  # (row, cadeia_limpa)
    for r in lineage_rows:
        try:
            chain = json.loads(r["lineage_json"] or "[]")
        except json.JSONDecodeError:
            chain = []
        if is_garbage_chain(chain):
            chains_garbage += 1
            continue
        if len(chain) < 2:
            chains_empty += 1
            continue
        chains_ok += 1
        raw_chains.append((r, clean_chain(chain)))

    def get_or_create_virtual(name):
        k = norm(name)
        if k in name_to_id:
            return name_to_id[k]
        vid = "v_" + re.sub(r"\s+", "_", k)
        virtual[k] = vid
        profiles[vid] = {
            "id": vid, "name": name, "nickname": "",
            "team": "", "url": "", "bio": "", "photo": "",
        }
        name_to_id[k] = vid
        return vid

    surname_pool = defaultdict(set)  # (inicial, sobrenome) -> {ids} das formas plenas conhecidas

    def register_full_name(name, pid):
        """Registra a forma textual como alias do id (causa raiz 1) e, se for
        um nome por extenso, alimenta o pool usado pra resolver abreviacoes."""
        k = norm(name)
        if k not in name_to_id:
            name_to_id[k] = pid
        if not is_abbrev_name(name):
            surname_pool[(first_initial(name), surname_key(name))].add(pid)

    # Passo 1: ancora tudo que tem URL primeiro (cria perfil se preciso)
    real_pids = {url_id(r["profile_url"]) for r in detail_rows}
    url_links = []  # (nome_do_elo, pid_bruto) -- alias registrado so depois de canonicalizar
    for _, chain in raw_chains:
        for entry in chain:
            pid = url_id(entry.get("url", ""))
            if not pid:
                continue
            if pid not in profiles:
                profiles[pid] = {
                    "id": pid, "name": entry["name"], "nickname": "",
                    "team": "", "url": entry["url"], "bio": "", "photo": "",
                }
            url_links.append((entry["name"], pid))

    # Canonicaliza IDs duplicados: o bjjheroes referencia a mesma pagina por
    # dois formatos de URL (?p=N legado vs /bjj-fighters/slug), o que faz uma
    # mesma pessoa virar dois perfis (ex: "Cicero Costha" em 1155 x
    # cicero-costha) e quebra o fechamento da arvore em fragmentos soltos.
    # Quando dois ids com o MESMO nome exibido aparecem, funde o "fantasma"
    # (criado so a partir do link numa cadeia, sem bio) no perfil real de
    # fighters_details.csv. So funde quando ha no maximo 1 perfil real no
    # grupo -- 2+ perfis reais com o mesmo nome sao pessoas distintas de fato
    # (ex: duas paginas "Carlos Gracie") e ficam separadas.
    by_name = defaultdict(list)
    for name, pid in url_links:
        group = by_name[norm(name)]
        if pid not in group:
            group.append(pid)

    # obs: um id "real" (de fighters_details.csv) so conta pro grupo se o
    # nome do PROPRIO perfil bate com o nome do grupo -- isso evita que um
    # link quebrado na cadeia (texto "Marco Barbosa" apontando por engano
    # pra pagina real de "Marcos Escobar") trave a fusao do fantasma
    # legitimo; o id real "estranho" fica de fora e mantem sua identidade.
    redirect = {}
    for key, ids in by_name.items():
        if len(ids) < 2:
            continue
        reals_matching = [i for i in ids if i in real_pids and norm(profiles[i]["name"]) == key]
        if len(reals_matching) > 1:
            continue
        mergeable_ghosts = [i for i in ids if i not in real_pids]
        canonical = reals_matching[0] if reals_matching else (mergeable_ghosts[0] if mergeable_ghosts else None)
        if canonical is None:
            continue
        for i in mergeable_ghosts:
            if i != canonical:
                redirect[i] = canonical

    def canon(pid):
        while pid in redirect:
            pid = redirect[pid]
        return pid

    for pid in list(profiles):
        if pid in redirect:
            del profiles[pid]

    # registra o nome no indice, corrigindo a causa raiz 1
    for name, pid in url_links:
        register_full_name(name, canon(pid))

    # Passo 2: nomes sem link e sem abreviacao -> no virtual (se ainda nao existir)
    for _, chain in raw_chains:
        for entry in chain:
            if url_id(entry.get("url", "")):
                continue
            if is_abbrev_name(entry["name"]):
                continue
            pid = get_or_create_virtual(entry["name"])
            register_full_name(entry["name"], pid)

    # Passo 3: abreviacoes -- so funde quando ha exatamente 1 candidato pleno
    # com a mesma combinacao (inicial do primeiro nome + sobrenome); caso
    # contrario deixa sem resolver (ambiguidade genuina, ex: "C. Gracie")
    for _, chain in raw_chains:
        for entry in chain:
            if url_id(entry.get("url", "")):
                continue
            name = entry["name"]
            if not is_abbrev_name(name):
                continue
            k = norm(name)
            if k in name_to_id:
                continue
            candidates = surname_pool.get((first_initial(name), surname_key(name)), set())
            if len(candidates) == 1:
                name_to_id[k] = next(iter(candidates))

    def resolve(entry):
        """Resolve um elo da cadeia para um ID canonico, usando o indice ja
        populado pelos passos 1-3. Link sempre manda; senao usa/cria virtual."""
        pid = url_id(entry.get("url", ""))
        if pid:
            return canon(pid)
        return get_or_create_virtual(entry["name"])

    for r, chain in raw_chains:
        self_id = canon(url_id(r["profile_url"]))
        ids = [resolve(e) for e in chain]
        # o ultimo elo costuma ser o proprio lutador; garante o id certo
        if ids and self_id and ids[-1] != self_id:
            # se o nome bate com o do lutador, corrige para o id canonico
            if norm(chain[-1]["name"]).split()[-1:] == norm(profiles.get(self_id, {}).get("name", "")).split()[-1:]:
                ids[-1] = self_id
        chain_names = " > ".join(e["name"] for e in chain)
        for teacher, student in zip(ids, ids[1:]):
            if teacher == student:
                continue
            key = (student, teacher)
            if key not in edges:
                edges[key] = f"Lineage declarada no perfil: {chain_names}"

    # ---- escolhe 1 pai por aluno (primeiro visto; cadeias divergentes vao p/ revisao) ----
    parent = {}
    conflicts = []
    for (student, teacher), ev in edges.items():
        if student in parent and parent[student][0] != teacher:
            conflicts.append((student, parent[student][0], teacher))
            continue
        parent[student] = (teacher, ev)

    children = defaultdict(list)
    for s, (t, _) in parent.items():
        children[t].append(s)

    # quebra ciclos
    def cyclic(start):
        seen, cur = set(), start
        while cur in parent:
            cur = parent[cur][0]
            if cur == start or cur in seen:
                return True
            seen.add(cur)
        return False
    for s in list(parent):
        if cyclic(s):
            t, _ = parent.pop(s)
            children[t].remove(s)

    roots = [pid for pid in profiles if pid not in parent and children.get(pid)]

    def build(nid, path=None, depth=0):
        path = path or set()
        if nid in path or depth > 30:
            return None
        p = profiles[nid]
        ev = parent.get(nid, (None, ""))[1]
        node = {
            "id": nid, "name": p["name"], "nickname": p["nickname"],
            "team": p["team"], "url": p["url"], "bio": p["bio"][:400],
            "photo": p["photo"],
            "confidence": "high" if nid in parent else "root",
            "source": "site_lineage_field" if nid in parent else "root",
            "evidence": ev,
        }
        kids = [build(c, path | {nid}, depth + 1)
                for c in sorted(children.get(nid, []), key=lambda x: profiles[x]["name"])]
        kids = [k for k in kids if k]
        if kids:
            node["children"] = kids
        return node

    forest = [t for t in (build(r) for r in roots) if t]

    def size(n): return 1 + sum(size(c) for c in n.get("children", []))
    forest.sort(key=lambda n: -size(n))

    json.dump(forest, open("chains_lineage_tree.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    edges_out = [{
        "student_id": s, "student_name": profiles[s]["name"],
        "teacher_id": t, "teacher_name": profiles[t]["name"],
        "confidence": "high", "source": "site_lineage_field",
        "evidence": ev,
    } for (s, t), ev in edges.items()]

    flat = {
        "meta": {
            "source": "bjjheroes.com campo Lineage estruturado",
            "profiles_total": len(profiles),
            "virtual_ancestors": len(virtual),
            "edges_total": len(edges_out),
            "chains_parsed": chains_ok,
            "chains_empty": chains_empty,
            "chains_garbage": chains_garbage,
            "conflicting_parents": len(conflicts),
        },
        "fighters": list(profiles.values()),
        "edges": edges_out,
    }
    json.dump(flat, open("chains_lineage_flat.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    with open("chains_edges.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(edges_out[0].keys()) if edges_out else
                           ["student_id", "student_name", "teacher_id", "teacher_name",
                            "confidence", "source", "evidence"])
        w.writeheader()
        w.writerows(edges_out)

    print(f"cadeias com dados:      {chains_ok}")
    print(f"cadeias vazias:         {chains_empty}")
    print(f"cadeias descartadas (lixo de scraping): {chains_garbage}")
    print(f"perfis (com virtuais):  {len(profiles)} ({len(virtual)} ancestrais virtuais)")
    print(f"arestas:                {len(edges_out)}")
    print(f"pais conflitantes:      {len(conflicts)} (ver saida p/ revisao)")
    print(f"arvores:                {len(forest)}")
    if forest:
        print("maiores:")
        for t in forest[:6]:
            print(f"  {t['name']:30} {size(t):5} nos")
    if conflicts[:10]:
        print("\nconflitos (aluno com 2 pais declarados):")
        for s, t1, t2 in conflicts[:10]:
            print(f"  {profiles[s]['name']}: {profiles[t1]['name']} vs {profiles[t2]['name']}")


if __name__ == "__main__":
    main()