"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  { label: "Who gave Demian Maia his black belt?", query: "demian maia" },
  { label: "Show the lineage of Rolls Gracie", query: "rolls gracie" },
  { label: "Explore the full Mitsuyo Maeda tree", query: "" }
];

function stripDiacritics(value: string) {
  return value
    .split("")
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 0x300 || code > 0x36f;
    })
    .join("");
}

function slugify(value: string) {
  return stripDiacritics(value.normalize("NFD"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const go = (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      router.push("/explore");
      return;
    }
    router.push(`/people/${slugify(normalized)}`);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    go(query);
  };

  return (
    <div className="home-hero-search">
      <form onSubmit={handleSubmit} className="home-search-form">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for a fighter, instructor, or academy…"
          autoComplete="off"
        />
        <button type="submit" aria-label="Search">
          →
        </button>
      </form>
      <div className="home-search-examples">
        {EXAMPLES.map((example) => (
          <button key={example.label} type="button" onClick={() => go(example.query)}>
            {example.label}
          </button>
        ))}
      </div>
    </div>
  );
}
