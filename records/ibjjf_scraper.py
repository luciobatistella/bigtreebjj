#!/usr/bin/env python3
"""
Scraper do ranking oficial de faixas-pretas adultas do IBJJF
(https://ibjjf.com/2026-athletes-ranking)

Traz nome, academia/equipe, posicao e pontuacao -- NAO traz professor nem
linhagem (a pagina de ranking/perfil do IBJJF nao tem esse dado). Serve pra
descobrir nomes novos e a equipe atual de cada um, nao pra gerar arestas de
linhagem diretamente.

Cobre as 4 combinacoes de ranking geral adulto faixa-preta:
    gi/no-gi x male/female
paginando ate a pagina voltar vazia.

Uso:
    python ibjjf_scraper.py                  # gera ibjjf_black_belts.csv
    python ibjjf_scraper.py --delay 2         # mais devagar
    python ibjjf_scraper.py --limit-pages 3   # testar com poucas paginas por combo
"""

import argparse
import csv
import json
import os
import random
import sys
import time
from urllib.parse import urlencode, urljoin

import requests
try:
    import cloudscraper
    HAS_CLOUDSCRAPER = True
except ImportError:
    HAS_CLOUDSCRAPER = False
from bs4 import BeautifulSoup

BASE_URL = "https://ibjjf.com"
RANKING_PATH = "/2026-athletes-ranking"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

# so faixa-preta adulta, como combinado -- as 4 combinacoes de ranking geral existentes
RULESETS = ["ranking-geral-gi", "ranking-geral-no-gi"]
GENDERS = ["male", "female"]

OUT_CSV = "ibjjf_black_belts.csv"
CHECKPOINT_FILE = "ibjjf_scraper_checkpoint.json"


class NotFoundError(Exception):
    pass


def get_with_retry(session, url, max_retries=5, timeout=20):
    """GET com backoff exponencial. Respeita Retry-After em 429.
    Trata 400/403/429/5xx como possivel bloqueio de firewall (WAF) e espera mais."""
    for attempt in range(max_retries):
        try:
            resp = session.get(url, headers=HEADERS, timeout=timeout)
            if resp.status_code == 404:
                raise NotFoundError(f"404 Not Found: {url}")
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", 15))
                print(f"  [429] Rate limited. Esperando {wait}s...")
                time.sleep(wait)
                continue
            if resp.status_code in (400, 403) or resp.status_code >= 500:
                wait = min(90, 8 * (2 ** attempt))
                print(f"  [{resp.status_code}] Possivel bloqueio de firewall. Esperando {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as e:
            wait = min(90, 8 * (2 ** attempt))
            print(f"  [erro de rede] {e}. Retry em {wait}s...")
            time.sleep(wait)
    raise RuntimeError(f"Falha ao buscar {url} apos {max_retries} tentativas")


def make_session():
    if HAS_CLOUDSCRAPER:
        return cloudscraper.create_scraper(
            browser={"browser": "chrome", "platform": "windows", "mobile": False}
        )
    return requests.Session()


def ranking_url(ruleset, gender, page):
    params = {
        "filters[belt]": "black",
        "filters[gender]": gender,
        "filters[ranking_category]": "adult",
        "filters[s]": ruleset,
        "filters[search]": "",
        "filters[weight]": "",
        "page": page,
    }
    return f"{BASE_URL}{RANKING_PATH}?{urlencode(params)}"


def parse_ranking_page(html):
    """Extrai as linhas da tabela de ranking. Retorna lista vazia se a pagina
    nao tiver nenhum atleta (sinal de que passou do fim da paginacao)."""
    soup = BeautifulSoup(html, "lxml")
    table = soup.find("table")
    if table is None:
        return []

    rows = []
    for tr in table.find_all("tr"):
        name_cell = tr.find("td", class_="name-academy")
        if name_cell is None:
            continue  # linha de cabecalho ou lixo
        link = name_cell.find("a", href=True)
        if not link:
            continue
        academy_div = name_cell.find("div", class_="academy")
        position_cell = tr.find("td", class_="position")
        points_cell = tr.find("td", class_="pontuation")

        rows.append({
            "name": link.get_text(strip=True),
            "profile_url": urljoin(BASE_URL, link["href"]),
            "academy": academy_div.get_text(strip=True) if academy_div else "",
            "position": position_cell.get_text(strip=True) if position_cell else "",
            "points": points_cell.get_text(strip=True) if points_cell else "",
        })
    return rows


def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_checkpoint(state):
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f)


def scrape_combo(session, ruleset, gender, delay, limit_pages, writer, out_file, seen_urls):
    """Pagina uma combinacao (ruleset, gender) ate a pagina voltar vazia."""
    page = 1
    consecutive_failures = 0
    while True:
        if limit_pages and page > limit_pages:
            print(f"  [{ruleset}/{gender}] limite de {limit_pages} paginas atingido, parando combo.")
            break

        url = ranking_url(ruleset, gender, page)
        print(f"[{ruleset}/{gender}] pagina {page} -> {url}")

        try:
            resp = get_with_retry(session, url)
            rows = parse_ranking_page(resp.text)
        except KeyboardInterrupt:
            raise
        except NotFoundError:
            print("  404 -- fim da paginacao.")
            break
        except BaseException as e:
            consecutive_failures += 1
            print(f"  Falhou ({consecutive_failures}x seguidas): {e}. Pulando pagina.")
            if consecutive_failures >= 3:
                cooldown = 120
                print(f"  Muitas falhas seguidas -- pausando {cooldown}s e renovando sessao...")
                time.sleep(cooldown)
                session = make_session()
                consecutive_failures = 0
            page += 1
            continue

        consecutive_failures = 0

        if not rows:
            print("  pagina vazia -- fim da paginacao.")
            break

        for r in rows:
            if r["profile_url"] in seen_urls:
                continue  # mesmo atleta pode repetir entre paginas (raro, mas seguro)
            seen_urls.add(r["profile_url"])
            writer.writerow({
                "name": r["name"],
                "profile_url": r["profile_url"],
                "academy": r["academy"],
                "belt": "black",
                "ranking_category": "adult",
                "gender": gender,
                "ruleset": "gi" if ruleset == "ranking-geral-gi" else "no-gi",
                "position": r["position"],
                "points": r["points"],
            })
        out_file.flush()

        page += 1
        time.sleep(delay + random.uniform(0, 0.5))


def main():
    parser = argparse.ArgumentParser(description="Scraper de ranking de faixas-pretas adultas do IBJJF")
    parser.add_argument("--delay", type=float, default=2.0, help="Segundos de espera entre requisicoes (padrao 2.0)")
    parser.add_argument("--limit-pages", type=int, default=None,
                         help="Limitar paginas por combinacao gi/no-gi x male/female (util pra testar)")
    args = parser.parse_args()

    if HAS_CLOUDSCRAPER:
        print("(usando cloudscraper para contornar protecao anti-bot)")
    else:
        print("AVISO: cloudscraper nao instalado -- rode 'pip install cloudscraper' "
              "se continuar tomando 403/400. Usando requests puro por enquanto.")
    session = make_session()

    try:
        session.get(BASE_URL, headers=HEADERS, timeout=20)
        time.sleep(1)
    except requests.exceptions.RequestException:
        pass

    checkpoint = load_checkpoint()
    done_combos = set(checkpoint.get("done_combos", []))
    seen_urls = set(checkpoint.get("seen_urls", []))

    fieldnames = ["name", "profile_url", "academy", "belt", "ranking_category",
                  "gender", "ruleset", "position", "points"]
    file_exists = os.path.exists(OUT_CSV)

    with open(OUT_CSV, "a", newline="", encoding="utf-8") as out_file:
        writer = csv.DictWriter(out_file, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()

        for ruleset in RULESETS:
            for gender in GENDERS:
                combo_key = f"{ruleset}|{gender}"
                if combo_key in done_combos:
                    print(f"[{ruleset}/{gender}] ja concluido (checkpoint), pulando.")
                    continue

                scrape_combo(session, ruleset, gender, args.delay, args.limit_pages,
                             writer, out_file, seen_urls)

                done_combos.add(combo_key)
                save_checkpoint({"done_combos": list(done_combos), "seen_urls": list(seen_urls)})

    print(f"Concluido. {len(seen_urls)} atletas unicos salvos em {OUT_CSV}")


if __name__ == "__main__":
    main()
