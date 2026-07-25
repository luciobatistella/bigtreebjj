"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type StoryStep = {
  id: string;
  name: string;
  caption: string;
};

type PublicPersonProfile = {
  lineagePath: Array<{ id: string; fullName: string }>;
  publicRelationships: Array<{
    studentPersonId: string;
    teacherPersonId: string | null;
    relationshipLabel: string;
    evidenceLevel: string;
    sourceCount: number;
  }>;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const AUTOPLAY_DELAY_MS = 4200;

/**
 * Drives "Story Mode": reuses GET /public/people/:id, which already computes
 * the root-to-person ancestor chain (lineagePath) and the claims that connect
 * each hop (publicRelationships) — no backend changes needed.
 */
export function useStorySequence(options: {
  ensureNodeLoaded: (step: { name: string; id: string }) => Promise<void>;
  selectNodeId: (id: string) => void;
}) {
  const [steps, setSteps] = useState<StoryStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const goTo = useCallback(async (index: number, currentSteps: StoryStep[]) => {
    const step = currentSteps[index];
    if (!step) return;
    await optionsRef.current.ensureNodeLoaded({ name: step.name, id: step.id });
    optionsRef.current.selectNodeId(step.id);
    setStepIndex(index);
  }, []);

  const start = useCallback(
    async (personEntityId: string) => {
      setLoading(true);
      try {
        const response = await fetch(`${apiBase}/public/people/${personEntityId}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Profile not found");
        const profile = (await response.json()) as PublicPersonProfile;
        const path = profile.lineagePath ?? [];
        const built: StoryStep[] = path.map((entry, index) => {
          const previous = path[index - 1];
          const claim = previous
            ? profile.publicRelationships.find((rel) => rel.teacherPersonId === previous.id && rel.studentPersonId === entry.id)
            : undefined;
          const caption =
            index === 0
              ? "Root of the recorded lineage."
              : claim
              ? `${claim.relationshipLabel} under ${previous?.fullName} — ${claim.evidenceLevel}, ${claim.sourceCount} source${claim.sourceCount === 1 ? "" : "s"}.`
              : `Connected to ${previous?.fullName}.`;
          return { id: `person:${entry.id}`, name: entry.fullName, caption };
        });
        setSteps(built);
        setStepIndex(0);
        setPlaying(built.length > 1);
        if (built.length) await goTo(0, built);
      } finally {
        setLoading(false);
      }
    },
    [goTo]
  );

  const stop = useCallback(() => {
    setPlaying(false);
    setSteps([]);
    setStepIndex(0);
  }, []);

  const next = useCallback(() => {
    if (stepIndex < steps.length - 1) goTo(stepIndex + 1, steps);
    else setPlaying(false);
  }, [stepIndex, steps, goTo]);

  const prev = useCallback(() => {
    if (stepIndex > 0) goTo(stepIndex - 1, steps);
  }, [stepIndex, steps, goTo]);

  useEffect(() => {
    if (!playing || steps.length < 2) return;
    const timer = setTimeout(() => {
      if (stepIndex < steps.length - 1) goTo(stepIndex + 1, steps);
      else setPlaying(false);
    }, AUTOPLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [playing, stepIndex, steps, goTo]);

  return { steps, stepIndex, playing, loading, start, stop, next, prev, setPlaying };
}
