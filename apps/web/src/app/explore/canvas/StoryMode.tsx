"use client";

import type { StoryStep } from "./useStorySequence";

export function StoryModeBar({
  steps,
  stepIndex,
  playing,
  onNext,
  onPrev,
  onTogglePlay,
  onClose
}: {
  steps: StoryStep[];
  stepIndex: number;
  playing: boolean;
  onNext: () => void;
  onPrev: () => void;
  onTogglePlay: () => void;
  onClose: () => void;
}) {
  if (!steps.length) return null;
  const step = steps[stepIndex];

  return (
    <div className="story-mode-bar">
      <div className="story-mode-progress">
        {steps.map((_, index) => (
          <span key={index} className={index === stepIndex ? "active" : index < stepIndex ? "done" : ""} />
        ))}
      </div>
      <div className="story-mode-body">
        <div className="story-mode-copy">
          <strong>{step.name}</strong>
          <p>{step.caption}</p>
        </div>
        <div className="story-mode-controls">
          <button onClick={onPrev} disabled={stepIndex === 0} aria-label="Previous step">
            ‹
          </button>
          <button onClick={onTogglePlay} aria-label={playing ? "Pause" : "Play"}>
            {playing ? "Pause" : "Play"}
          </button>
          <button onClick={onNext} disabled={stepIndex === steps.length - 1} aria-label="Next step">
            ›
          </button>
          <span className="story-mode-count">
            {stepIndex + 1} / {steps.length}
          </span>
          <button onClick={onClose} aria-label="Close story mode">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
