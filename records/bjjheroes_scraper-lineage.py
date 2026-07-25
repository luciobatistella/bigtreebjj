#!/usr/bin/env python3
"""
Scraper para coleta massiva do banco de dados de lutadores do BJJ Heroes
(https://www.bjjheroes.com/a-z-bjj-fighters-list)

ETAPA 1: coleta a lista A-Z (nome, sobrenome, apelido, equipe, url do perfil)
ETAPA 2: visita cada perfil e extrai bio, conquistas e "grappling record"

Uso:
    python bjjheroes_scraper.py --step list                 # gera fighters_list.csv
    python bjjheroes_scraper.py --step details              # gera fighters_details.csv (com resume)
    python bjjheroes_scraper.py --step details --limit 50   # testar com poucos primeiro

Boas práticas incluídas:
    - User-Agent identificado + delay entre requisições (--delay, padrão 1.5s)
    - Checkpoint em disco: se cair a conexão, roda de novo e ele continua de onde parou
    - Retry com backoff exponencial em erros de rede / 429 / 5xx
    - Log de progresso
"""

import argparse
import csv
import json
import os
import random
import re
import sys
import time
from urllib.parse import urljoin

import requests
try:
    import cloudscraper
    HAS_CLOUDSCRAPER = True
except ImportError:
    HAS_CLOUDSCRAPER = False
from bs4 import BeautifulSoup

BASE_URL = "https://www.bjjheroes.com"
LIST_URL = f"{BASE_URL}/a-z-bjj-fighters-list"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

LIST_CSV = "fighters_list.csv"
DETAILS_CSV = "fighters_details.csv"
CHECKPOINT_FILE = "scraper_checkpoint.json"


class NotFoundError(Exception):
    """Página não existe (404) — perfil removido ou URL mudou."""
    pass


def get_with_retry(session, url, max_retries=5, timeout=20):
    """GET com backoff exponencial. Respeita Retry-After em 429.
    Trata 400/403/429/5xx como possível bloqueio de firewall (WAF) e espera mais."""
    for attempt in range(max_retries):
        try:
            resp = session.get(url, headers=HEADERS, timeout=timeout)
            if resp.status_code == 404:
                # Página não existe (perfil removido/renomeado) — não adianta tentar de novo.
                raise NotFoundError(f"404 Not Found: {url}")
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", 15))
                print(f"  [429] Rate limited. Esperando {wait}s...")
                time.sleep(wait)
                continue
            if resp.status_code in (400, 403) or resp.status_code >= 500:
                wait = min(90, 8 * (2 ** attempt))  # 8, 16, 32, 64, 90...
                print(f"  [{resp.status_code}] Possível bloqueio de firewall. Esperando {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as e:
            wait = min(90, 8 * (2 ** attempt))
            print(f"  [erro de rede] {e}. Retry em {wait}s...")
            time.sleep(wait)
    raise RuntimeError(f"Falha ao buscar {url} após {max_retries} tentativas")


def step_list(session):
    """Coleta a lista A-Z completa de lutadores (uma única página com tabela grande)."""
    print(f"Buscando {LIST_URL} ...")
    resp = get_with_retry(session, LIST_URL)
    soup = BeautifulSoup(resp.text, "lxml")

    # A tabela principal é a primeira <table> dentro do conteúdo do artigo
    table = soup.find("table")
    if table is None:
        raise RuntimeError("Não encontrei a tabela de lutadores — o layout do site pode ter mudado.")

    rows = table.find_all("tr")
    fighters = []
    seen_urls = set()

    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue  # linha de cabeçalho ou lixo

        first_cell, last_cell, nickname_cell, team_cell = cells[0], cells[1], cells[2], cells[3]

        link_tag = first_cell.find("a") or last_cell.find("a")
        if not link_tag or not link_tag.get("href"):
            continue

        profile_url = urljoin(BASE_URL, link_tag["href"])
        if profile_url in seen_urls:
            continue
        seen_urls.add(profile_url)

        first_name = first_cell.get_text(strip=True)
        last_name = last_cell.get_text(strip=True)
        nickname = nickname_cell.get_text(strip=True)
        team = team_cell.get_text(strip=True)

        fighters.append({
            "first_name": first_name,
            "last_name": last_name,
            "nickname": nickname,
            "team": team,
            "profile_url": profile_url,
        })

    print(f"Encontrados {len(fighters)} lutadores.")

    with open(LIST_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["first_name", "last_name", "nickname", "team", "profile_url"])
        writer.writeheader()
        writer.writerows(fighters)

    print(f"Salvo em {LIST_CSV}")
    return fighters


LINEAGE_RE = re.compile(r"Lineage[:\s]*", re.I)


def parse_lineage_chain(soup):
    """Extrai a linha estruturada 'Lineage: A > B > C' dos perfis.
    Retorna lista de dicts {name, url} na ordem da cadeia (raiz -> lutador).
    Muito mais confiavel que regex na bio: e um campo do proprio site."""
    # A linha fica num <p> ou <strong> contendo 'Lineage:'
    label = soup.find(string=LINEAGE_RE)
    if not label:
        return []
    # sobe ate o container do paragrafo
    container = label.parent
    for _ in range(3):
        if container.name in ("p", "div", "li"):
            break
        container = container.parent

    chain = []
    # percorre os nos do container na ordem: links viram {name,url},
    # texto solto e dividido por '>'
    for el in container.descendants:
        if getattr(el, "name", None) == "a" and el.get("href"):
            name = el.get_text(strip=True)
            if name and not LINEAGE_RE.match(name):
                chain.append({"name": name, "url": el["href"]})
        elif isinstance(el, str):
            txt = LINEAGE_RE.sub("", el)
            for part in txt.split(">"):
                part = part.strip(" \u00a0\t\r\n>")
                if part and len(part) > 2:
                    chain.append({"name": part, "url": ""})
    # dedup preservando ordem (links geram texto duplicado as vezes)
    seen, out = set(), []
    for c in chain:
        key = c["name"].lower()
        if key not in seen:
            seen.add(key)
            out.append(c)
    return out


def parse_photo(soup):
    """URL da foto do lutador via og:image."""
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return og["content"]
    return ""


def parse_profile(html):
    """Extrai bio, conquistas e grappling record de uma página de perfil."""
    soup = BeautifulSoup(html, "lxml")
    data = {}

    # Título / nome completo
    h1 = soup.find("h1")
    data["full_name_title"] = h1.get_text(strip=True) if h1 else ""

    # Bio: geralmente o primeiro(s) parágrafo(s) do conteúdo do artigo
    content = soup.find("article") or soup.find("div", class_=re.compile("content|entry"))
    bio_parts = []
    if content:
        for p in content.find_all("p", limit=6):
            text = p.get_text(strip=True)
            if text:
                bio_parts.append(text)
    data["bio"] = " ".join(bio_parts[:2])  # só os 2 primeiros parágrafos como resumo

    # Grappling record: procura tabela com colunas tipo "Opponent | Method | Competition | Year"
    record_rows = []
    for table in soup.find_all("table"):
        header_text = table.get_text(" ", strip=True).lower()
        if "opponent" in header_text or "method" in header_text:
            for tr in table.find_all("tr")[1:]:
                cols = [td.get_text(strip=True) for td in tr.find_all("td")]
                if cols:
                    record_rows.append(cols)
    data["record_rows_json"] = json.dumps(record_rows, ensure_ascii=False)
    data["record_row_count"] = len(record_rows)

    # Linha estruturada de linhagem (campo do proprio site) + foto
    data["lineage_json"] = json.dumps(parse_lineage_chain(soup), ensure_ascii=False)
    data["photo_url"] = parse_photo(soup)

    return data


ENRICH_CSV = "fighters_lineage.csv"
ENRICH_CHECKPOINT = "enrich_checkpoint.json"


def step_enrich(session, delay, limit=None):
    """Repassa por todos os perfis coletando APENAS a cadeia de linhagem
    estruturada e a URL da foto. Nao mexe no fighters_details.csv existente."""
    if not os.path.exists(LIST_CSV):
        print(f"Rode antes: --step list (nao encontrei {LIST_CSV})")
        sys.exit(1)

    with open(LIST_CSV, newline="", encoding="utf-8") as f:
        fighters = list(csv.DictReader(f))
    if limit:
        fighters = fighters[:limit]

    done = set()
    if os.path.exists(ENRICH_CHECKPOINT):
        done = set(json.load(open(ENRICH_CHECKPOINT, encoding="utf-8")))

    file_exists = os.path.exists(ENRICH_CSV)
    fieldnames = ["profile_url", "first_name", "last_name",
                  "lineage_json", "photo_url"]

    consecutive_failures = 0
    with open(ENRICH_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()

        total = len(fighters)
        for i, fighter in enumerate(fighters, 1):
            url = fighter["profile_url"]
            if url in done:
                continue
            print(f"[{i}/{total}] {fighter['first_name']} {fighter['last_name']}")

            try:
                resp = get_with_retry(session, url)
                soup = BeautifulSoup(resp.text, "lxml")
                chain = parse_lineage_chain(soup)
                photo = parse_photo(soup)
            except KeyboardInterrupt:
                raise
            except NotFoundError as e:
                print(f"  {e}. Pulando.")
                done.add(url)
                json.dump(list(done), open(ENRICH_CHECKPOINT, "w"))
                continue
            except BaseException as e:
                consecutive_failures += 1
                print(f"  Falhou ({consecutive_failures}x): {e}")
                if consecutive_failures >= 3:
                    print("  Pausando 120s e renovando sessao...")
                    time.sleep(120)
                    session = make_session()
                    consecutive_failures = 0
                continue

            consecutive_failures = 0
            writer.writerow({
                "profile_url": url,
                "first_name": fighter["first_name"],
                "last_name": fighter["last_name"],
                "lineage_json": json.dumps(chain, ensure_ascii=False),
                "photo_url": photo,
            })
            f.flush()
            done.add(url)
            json.dump(list(done), open(ENRICH_CHECKPOINT, "w"))
            time.sleep(delay + random.uniform(0, 0.5))

    print(f"Concluido. Dados em {ENRICH_CSV}")


def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
            return set(json.load(f))
    return set()


def save_checkpoint(done_urls):
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(list(done_urls), f)


def make_session():
    if HAS_CLOUDSCRAPER:
        return cloudscraper.create_scraper(
            browser={"browser": "chrome", "platform": "windows", "mobile": False}
        )
    return requests.Session()


def step_details(session, delay, limit=None):
    """Visita cada perfil da lista e extrai os detalhes, com resume via checkpoint."""
    if not os.path.exists(LIST_CSV):
        print(f"Rode antes: --step list (não encontrei {LIST_CSV})")
        sys.exit(1)

    with open(LIST_CSV, newline="", encoding="utf-8") as f:
        fighters = list(csv.DictReader(f))

    if limit:
        fighters = fighters[:limit]

    done_urls = load_checkpoint()
    file_exists = os.path.exists(DETAILS_CSV)

    fieldnames = ["first_name", "last_name", "nickname", "team", "profile_url",
                  "full_name_title", "bio", "record_rows_json", "record_row_count"]

    consecutive_failures = 0

    with open(DETAILS_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()

        total = len(fighters)
        for i, fighter in enumerate(fighters, 1):
            url = fighter["profile_url"]
            if url in done_urls:
                continue

            print(f"[{i}/{total}] {fighter['first_name']} {fighter['last_name']} -> {url}")

            try:
                resp = get_with_retry(session, url)
                details = parse_profile(resp.text)
            except KeyboardInterrupt:
                raise  # deixa Ctrl+C funcionar normalmente
            except NotFoundError as e:
                # Perfil não existe mais — não é bloqueio, não conta pra cooldown.
                print(f"  {e}. Marcando como visitado e seguindo.")
                done_urls.add(url)
                save_checkpoint(done_urls)
                continue
            except BaseException as e:
                # Captura QUALQUER erro (não só de rede) pra nunca derrubar a coleta inteira.
                consecutive_failures += 1
                print(f"  Falhou ({consecutive_failures}x seguidas): {e}. Pulando por ora.")

                if consecutive_failures >= 3:
                    cooldown = 120
                    print(f"  Muitas falhas seguidas — parece bloqueio temporário do site. "
                          f"Pausando {cooldown}s e renovando sessão...")
                    time.sleep(cooldown)
                    session = make_session()
                    consecutive_failures = 0
                continue

            consecutive_failures = 0

            row = {**fighter, **details}
            writer.writerow(row)
            f.flush()

            done_urls.add(url)
            save_checkpoint(done_urls)

            time.sleep(delay + random.uniform(0, 0.5))  # jitter pra não bater sempre no mesmo intervalo

    print(f"Concluído. Dados salvos em {DETAILS_CSV}")


def main():
    parser = argparse.ArgumentParser(description="Scraper BJJ Heroes")
    parser.add_argument("--step", choices=["list", "details", "enrich"], required=True)
    parser.add_argument("--delay", type=float, default=3.0, help="Segundos de espera entre requisições (padrão 3.0)")
    parser.add_argument("--limit", type=int, default=None, help="Limitar número de perfis (útil pra testar)")
    args = parser.parse_args()

    if HAS_CLOUDSCRAPER:
        print("(usando cloudscraper para contornar proteção anti-bot)")
    else:
        print("AVISO: cloudscraper não instalado — rode 'pip install cloudscraper' "
              "se continuar tomando 403/400. Usando requests puro por enquanto.")
    session = make_session()

    # "Esquenta" a sessão visitando a home primeiro, para pegar cookies
    # (alguns sites bloqueiam requests que vão direto numa página interna sem isso)
    try:
        session.get(BASE_URL, headers=HEADERS, timeout=20)
        time.sleep(1)
    except requests.exceptions.RequestException:
        pass

    if args.step == "list":
        step_list(session)
    elif args.step == "enrich":
        step_enrich(session, delay=args.delay, limit=args.limit)
    else:
        step_details(session, delay=args.delay, limit=args.limit)


if __name__ == "__main__":
    main()
