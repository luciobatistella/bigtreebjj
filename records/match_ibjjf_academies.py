#!/usr/bin/env python3
"""
Gera pistas de pesquisa entre faixas-pretas novos do IBJJF
(ibjjf_black_belts.csv) e pessoas já conhecidas no acervo
(chains_lineage_flat.json), cruzando exclusivamente o NOME DA ACADEMIA/EQUIPE.

Isso NÃO é uma aresta de linhagem nem uma lista de professores candidatos.
Academia igual não prova quem graduou quem: várias pessoas da mesma equipe
podem ter sido promovidas por professores diferentes. O resultado serve apenas
para orientar uma pesquisa posterior com fonte direta.

Toda linha sai marcada como research_lead e nunca pode ser publicada como
linhagem sem uma fonte direta e uma decisão editorial humana.

Requer:
  ibjjf_black_belts.csv       (gerado por ibjjf_scraper.py)
  fighters_details.csv        (BJJ Heroes, pra saber quem ja e conhecido)
  chains_lineage_flat.json    (arvore atual, pra pegar team + contagem de alunos)

Saida:
  data/imports/bjjheroes_local/ibjjf_academy_link_candidates.csv
"""

import csv
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

IBJJF_CSV = "ibjjf_black_belts.csv"
DETAILS_CSV = "fighters_details.csv"
FLAT_JSON = "chains_lineage_flat.json"
OUT_CSV = "data/imports/bjjheroes_local/ibjjf_academy_link_candidates.csv"

MAX_ACADEMY_EXAMPLES = 5
EXCLUDED_LINEAGE_LEADS = {
    # Regra editorial explícita: pertencer à academia de Demian Maia não
    # autoriza sugerir Nelson como parte da linhagem de faixas-pretas dele.
    "nelson de souza lopes",
}


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")


def norm(s):
    s = strip_accents(s or "").lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def main():
    with open(FLAT_JSON, encoding="utf-8") as f:
        flat = json.load(f)
    fighters = {p["id"]: p for p in flat["fighters"]}
    edges = flat["edges"]

    # quantos alunos DIRETOS cada pessoa ja tem na arvore -- usado so pra
    # ordenar os candidatos a professor, do mais "central" pro menos
    direct_children = Counter(e["teacher_id"] for e in edges)

    # academia normalizada -> lista de ids de gente ja conhecida com esse team
    team_index = defaultdict(list)
    for pid, p in fighters.items():
        team = (p.get("team") or "").strip()
        if not pid.startswith("v_") and team:  # ignora ancestrais virtuais (nunca tem team)
            team_index[norm(team)].append(pid)

    known_names = set()
    with open(DETAILS_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            full = f"{r['first_name']} {r['last_name']}".strip()
            known_names.add(norm(full))

    rows_out = []
    matched_athletes = 0
    with open(IBJJF_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if norm(r["name"]) in known_names:
                continue  # ja esta na arvore por nome exato, nao e "novo no"
            if norm(r["name"]) in EXCLUDED_LINEAGE_LEADS:
                continue

            academy_key = norm(r["academy"])
            candidate_ids = team_index.get(academy_key, [])
            if not candidate_ids:
                continue  # sem sinal nenhum de academia -- nao vira candidato ainda

            matched_athletes += 1
            ranked = sorted(
                candidate_ids,
                key=lambda pid: (-direct_children[pid], fighters[pid]["name"]),
            )[:MAX_ACADEMY_EXAMPLES]
            academy_people_names = [fighters[pid]["name"] for pid in ranked]

            rows_out.append({
                "ibjjf_name": r["name"],
                "ibjjf_profile_url": r["profile_url"],
                "academy": r["academy"],
                "gender": r["gender"],
                "ranking_category": r["ranking_category"],
                "ruleset": r["ruleset"],
                "points": r["points"],
                "same_academy_people_ids": "; ".join(ranked),
                "same_academy_people_names": "; ".join(academy_people_names),
                "academy_known_people_count": len(candidate_ids),
                "signal_type": "academy_name_overlap_only",
                "confidence": "research_lead",
                "publication_policy": "never_publish_as_lineage_without_direct_source",
                "evidence": (
                    f"O ranking da IBJJF associa o atleta à academia \"{r['academy']}\"; "
                    f"o acervo possui {len(candidate_ids)} pessoa(s) com o mesmo nome de "
                    "academia. Isso não identifica professor nem comprova graduação."
                ),
            })

    fieldnames = ["ibjjf_name", "ibjjf_profile_url", "academy", "gender",
                  "ranking_category", "ruleset", "points",
                  "same_academy_people_ids", "same_academy_people_names",
                  "academy_known_people_count", "signal_type", "confidence",
                  "publication_policy", "evidence"]
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_out)

    print(f"atletas novos do IBJJF com pelo menos 1 academia batendo: {matched_athletes}")
    print(f"pistas salvas (todas confidence=research_lead) em {OUT_CSV}")

    academias_sem_match = Counter()
    with open(IBJJF_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if norm(r["name"]) in known_names:
                continue
            if norm(r["academy"]) not in team_index and r["academy"]:
                academias_sem_match[r["academy"]] += 1
    print("\ntop 15 academias SEM nenhuma pessoa conhecida na arvore (potencial pra academia nova):")
    for academy, n in academias_sem_match.most_common(15):
        print(f"  {n:5}  {academy}")


if __name__ == "__main__":
    main()
