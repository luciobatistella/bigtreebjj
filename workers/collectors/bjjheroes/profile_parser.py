import re
from html.parser import HTMLParser

from .config import SOURCE_NAME
from .normalizers import content_hash, normalize_space, source_attribution, stable_id, truncate_excerpt


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.text_chunks: list[str] = []
        self._in_title = False
        self.image_urls: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        if tag == "img":
            src = dict(attrs).get("src")
            if src:
                self.image_urls.append(src)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        text = normalize_space(data)
        if not text:
            return
        if self._in_title:
            self.title += f" {text}"
        else:
            self.text_chunks.append(text)


def _extract_name(title: str) -> str:
    title = normalize_space(title)
    return re.split(r"\s*[-|]\s*", title)[0].replace("BJJ Heroes", "").strip()


def _extract_field(text: str, labels: list[str]) -> str:
    pattern = "|".join(re.escape(label) for label in labels)
    stop_labels = r"Nickname|Nicknames|Also known as|Team/Association|Team|Association|Name"
    match = re.search(rf"(?:{pattern})\s*:?\s*(.{{1,120}}?)(?=\s+(?:{stop_labels})\s*:|$)", text, re.IGNORECASE)
    return normalize_space(match.group(1)) if match else ""


def parse_profile(html: str, url: str, captured_at: str) -> dict:
    parser = TextParser()
    parser.feed(html)
    full_text = normalize_space(" ".join(parser.text_chunks))
    external_name = _extract_name(parser.title) or _extract_field(full_text, ["Name"])
    nickname = _extract_field(full_text, ["Nickname", "Nicknames", "Also known as"])
    listed_team = _extract_field(full_text, ["Team/Association", "Team", "Association"])
    intro = truncate_excerpt(full_text, 160)
    raw_hash = content_hash(html)
    return {
        "id": stable_id("external-profile", {"url": url}),
        "source_name": SOURCE_NAME,
        "source_profile_url": url,
        "external_name": external_name,
        "nickname": nickname,
        "listed_team_text": listed_team,
        "captured_at": captured_at,
        "source_status": "fetched",
        "raw_hash": raw_hash,
        "created_at": captured_at,
        "source_locator": "profile metadata",
        "intro_locator": "introductory paragraph" if intro else "",
        "intro_excerpt": intro,
        "image_downloaded": False,
        "images_seen_count": len(parser.image_urls),
        "source_attribution": source_attribution(url),
    }
