from html.parser import HTMLParser

from .config import CATALOG_URL, SOURCE_NAME
from .normalizers import absolute_url, normalize_space, stable_id


class CatalogLinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links: list[dict] = []
        self._href: str | None = None

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        attrs_dict = dict(attrs)
        href = attrs_dict.get("href")
        if href and "bjj-fighters" in href:
            self._href = href

    def handle_data(self, data):
        if self._href:
            name = normalize_space(data)
            if name:
                url = absolute_url(self._href)
                self.links.append({
                    "id": stable_id("bjjh-profile", {"url": url}),
                    "source_name": SOURCE_NAME,
                    "external_name": name,
                    "source_profile_url": url,
                    "evidence_level": "specialized_source",
                    "status": "pending_review",
                    "source_locator": "A-Z catalogue",
                })

    def handle_endtag(self, tag):
        if tag == "a":
            self._href = None


def parse_catalog(html: str) -> list[dict]:
    parser = CatalogLinkParser()
    parser.feed(html)
    seen = set()
    results = []
    for link in parser.links:
        if link["source_profile_url"] in seen:
            continue
        seen.add(link["source_profile_url"])
        results.append(link)
    return results


def catalog_seed_record() -> dict:
    return {"source_name": SOURCE_NAME, "catalog_url": CATALOG_URL, "status": "pending_review"}
