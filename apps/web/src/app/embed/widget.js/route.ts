const WIDGET_SOURCE = String.raw`(() => {
  const script = document.currentScript;
  if (!script || !script.src) return;
  const origin = new URL(script.src, document.baseURI).origin;
  const tagName = "the-big-tree-bjj";
  const valid = {
    lang: new Set(["pt", "en"]),
    theme: new Set(["gold", "light"]),
    view: new Set(["full", "lineage", "compact"])
  };

  const cleanPerson = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120);

  class TheBigTreeBjj extends HTMLElement {
    static get observedAttributes() {
      return ["person", "lang", "theme", "view"];
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.onMessage = this.onMessage.bind(this);
    }

    connectedCallback() {
      window.addEventListener("message", this.onMessage);
      this.render();
    }

    disconnectedCallback() {
      window.removeEventListener("message", this.onMessage);
    }

    attributeChangedCallback(name, previous, next) {
      if (previous !== next && this.isConnected) this.render();
    }

    option(name, fallback) {
      const value = String(this.getAttribute(name) || "").toLowerCase();
      return valid[name].has(value) ? value : fallback;
    }

    render() {
      const person = cleanPerson(this.getAttribute("person"));
      const lang = this.option(
        "lang",
        String(document.documentElement.lang || "").toLowerCase().startsWith("en") ? "en" : "pt"
      );
      const theme = this.option("theme", "gold");
      const view = this.option("view", "full");

      this.shadowRoot.innerHTML = "";
      const style = document.createElement("style");
      style.textContent =
        ":host{display:block;width:100%;min-width:0;contain:content}" +
        "iframe{display:block;width:100%;height:620px;border:0;border-radius:28px;background:transparent;transition:height .28s ease}" +
        "@media(max-width:720px){iframe{height:780px;border-radius:20px}}" +
        "@media(prefers-reduced-motion:reduce){iframe{transition:none}}";
      const iframe = document.createElement("iframe");
      iframe.title = person
        ? "Official jiu-jitsu lineage of " + person.replace(/-/g, " ")
        : "Official lineage · The Big Tree BJJ";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      );
      iframe.src =
        origin +
        "/embed/" +
        encodeURIComponent(person || "unknown") +
        "?lang=" +
        lang +
        "&theme=" +
        theme +
        "&view=" +
        view;
      this.shadowRoot.append(style, iframe);
      this.iframe = iframe;
      this.person = person;
    }

    onMessage(event) {
      if (
        event.origin !== origin ||
        !this.iframe ||
        event.source !== this.iframe.contentWindow ||
        !event.data ||
        event.data.type !== "tbt:embed:resize" ||
        event.data.slug !== this.person
      ) {
        return;
      }
      const height = Math.max(320, Math.min(5000, Number(event.data.height) || 620));
      this.iframe.style.height = Math.ceil(height) + "px";
    }
  }

  if (!customElements.get(tagName)) {
    customElements.define(tagName, TheBigTreeBjj);
  }
})();`;

export function GET() {
  return new Response(WIDGET_SOURCE, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

