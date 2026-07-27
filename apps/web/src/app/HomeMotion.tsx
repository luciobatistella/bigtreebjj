"use client";

import { useEffect, useRef } from "react";

export function HomeMotion() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let dispose = () => {};

    async function setupMotion() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger")
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);
      const media = gsap.matchMedia();
      const listenerCleanup: Array<() => void> = [];

      media.add("(prefers-reduced-motion: no-preference)", () => {
        const context = gsap.context(() => {
          if (progressRef.current) {
            gsap.to(progressRef.current, {
              scaleX: 1,
              ease: "none",
              scrollTrigger: {
                start: 0,
                end: "max",
                scrub: 0.15
              }
            });
          }

          gsap.to(".ed-hero-logo", {
            y: -9,
            duration: 4.2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
          });
          gsap.to(".ed-hero-orbit-outer", {
            rotation: 360,
            duration: 48,
            repeat: -1,
            ease: "none"
          });
          gsap.to(".ed-hero-orbit-inner", {
            rotation: -360,
            duration: 36,
            repeat: -1,
            ease: "none"
          });

          gsap.from(".ed-index-track > *", {
            yPercent: 42,
            opacity: 0,
            stagger: 0.055,
            duration: 0.58,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ".ed-index",
              start: "top 96%",
              once: true
            }
          });

          const intro = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: {
              trigger: ".ed-intro",
              start: "top 78%",
              once: true
            }
          });
          intro
            .from(".ed-intro .ed-eyebrow", { y: 14, opacity: 0, duration: 0.45, immediateRender: false })
            .from(
              ".ed-intro h1 > span, .ed-intro h1 > em",
              {
                yPercent: 55,
                opacity: 0,
                clipPath: "inset(0 0 100% 0)",
                stagger: 0.12,
                duration: 0.9,
                immediateRender: false
              },
              "-=0.18"
            )
            .from(
              ".ed-hero-lede, .ed-hero-actions > *",
              { y: 18, opacity: 0, stagger: 0.08, duration: 0.5, immediateRender: false },
              "-=0.1"
            )
            .from(
              ".ed-hero-thesis, .ed-stats",
              { y: 34, opacity: 0, stagger: 0.12, duration: 0.7, immediateRender: false },
              "-=0.22"
            );

          const methodHero = gsap.timeline({
            defaults: { ease: "power3.out" },
            scrollTrigger: {
              trigger: ".ed-method-document-hero",
              start: "top 76%",
              once: true
            }
          });
          methodHero
            .from(".ed-method-document-hero .ed-doc-mono", {
              y: 14,
              opacity: 0,
              duration: 0.45,
              immediateRender: false
            })
            .from(".ed-method-document-hero h2", {
              y: 52,
              opacity: 0,
              duration: 0.9,
              immediateRender: false
            }, "-=.2")
            .from(".ed-method-hero-belt > span:first-child", {
              scaleX: 0,
              transformOrigin: "0 50%",
              duration: 0.9,
              immediateRender: false,
              ease: "power2.inOut"
            }, "-=.48")
            .from(".ed-method-hero-belt .ed-proof-tip", {
              x: -28,
              opacity: 0,
              duration: 0.44,
              immediateRender: false
            }, "-=.2")
            .from(".ed-method-hero-belt i", {
              scaleY: 0,
              transformOrigin: "50% 50%",
              stagger: 0.07,
              duration: 0.32,
              immediateRender: false,
              ease: "back.out(2)"
            }, "-=.1")
            .from(".ed-method-hero-foot p", {
              y: 14,
              opacity: 0,
              stagger: 0.08,
              duration: 0.42,
              immediateRender: false
            }, "-=.18");

          document.querySelectorAll<HTMLElement>(".ed-chronology-track").forEach((track) => {
            const fill = track.querySelector(".ed-chronology-fill");
            if (!fill) return;
            gsap.to(fill, {
              height: "100%",
              ease: "none",
              scrollTrigger: {
                trigger: track,
                start: "top 70%",
                end: "bottom 60%",
                scrub: 0.4
              }
            });
          });

          document.querySelectorAll<HTMLElement>(".ed-chronology-event").forEach((event) => {
            const eventTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: event,
                start: "top 84%",
                once: true
              }
            });
            eventTimeline
              .from(event, {
                y: 34,
                opacity: 0,
                duration: 0.7,
                immediateRender: false,
                ease: "power2.out"
              })
              .from(event.querySelectorAll(".ed-chronology-mark i"), {
                scaleY: 0,
                transformOrigin: "50% 50%",
                stagger: 0.07,
                duration: 0.3,
                ease: "back.out(2)"
              }, "-=.4")
              .from(event.querySelector("time"), {
                x: -28,
                opacity: 0,
                duration: 0.48,
                ease: "power2.out"
              }, "-=.34");
          });

          document.querySelectorAll<HTMLElement>(".ed-stats strong").forEach((element) => {
            const target = Number(element.textContent);
            if (!Number.isFinite(target)) return;
            const counter = { value: 0 };
            gsap.to(counter, {
              value: target,
              duration: 1.15,
              ease: "power2.out",
              scrollTrigger: {
                trigger: element,
                start: "top 90%",
                once: true
              },
              onUpdate: () => {
                element.textContent = String(Math.round(counter.value));
              }
            });
          });

          gsap.to(".ed-hero-emblem", {
            yPercent: 16,
            scale: 0.92,
            opacity: 0.28,
            ease: "none",
            scrollTrigger: {
              trigger: ".ed-hero",
              start: "top top",
              end: "bottom top",
              scrub: true
            }
          });

          gsap.to(".ed-intro h1", {
            yPercent: 10,
            ease: "none",
            scrollTrigger: {
              trigger: ".ed-intro",
              start: "top top",
              end: "bottom top",
              scrub: true
            }
          });

          gsap.to(".ed-hero-thesis", {
            yPercent: -10,
            ease: "none",
            scrollTrigger: {
              trigger: ".ed-intro",
              start: "top top",
              end: "bottom top",
              scrub: true
            }
          });

          document.querySelectorAll<HTMLElement>(".ed-section-heading, .ed-historiography").forEach((heading) => {
            const eyebrow = heading.querySelector(".ed-eyebrow");
            const title = heading.querySelector("h2");
            const copy = heading.querySelector(":scope > p:not(.ed-eyebrow)");
            const timeline = gsap.timeline({
              scrollTrigger: {
                trigger: heading,
                start: "top 84%",
                once: true
              }
            });
            if (eyebrow) timeline.from(eyebrow, { x: -20, opacity: 0, duration: 0.4 });
            if (title) {
              timeline.from(
                title,
                {
                  y: 42,
                  opacity: 0,
                  clipPath: "inset(0 0 100% 0)",
                  duration: 0.75,
                  ease: "power3.out"
                },
                "-=0.18"
              );
            }
            if (copy) timeline.from(copy, { y: 16, opacity: 0, duration: 0.5 }, "-=0.28");
          });

          const revealBatches: Array<{
            selector: string;
            from: gsap.TweenVars;
            interval?: number;
          }> = [
            {
              selector: ".ed-grade-row",
              from: { y: 36, opacity: 0 },
              interval: 0.12
            },
            {
              selector: ".ed-method-fields li, .ed-method-plates figure",
              from: { y: 34, opacity: 0 },
              interval: 0.07
            },
            {
              selector: ".ed-link-row",
              from: { x: -24, opacity: 0 },
              interval: 0.035
            },
            {
              selector: ".ed-entry",
              from: { x: -20, opacity: 0 },
              interval: 0.035
            },
            {
              selector: ".ed-conflict-grid article",
              from: { y: 42, opacity: 0, scale: 0.98 },
              interval: 0.08
            },
            {
              selector: ".ed-fight-list article",
              from: { x: -28, opacity: 0 },
              interval: 0.05
            },
            {
              selector: ".ed-source-grid article",
              from: { y: 38, opacity: 0, scale: 0.97 },
              interval: 0.07
            },
            {
              selector: ".ed-historiography article",
              from: { y: 34, opacity: 0 },
              interval: 0.1
            }
          ];

          revealBatches.forEach(({ selector, from, interval = 0.08 }) => {
            ScrollTrigger.batch(selector, {
              start: "top 92%",
              once: true,
              interval,
              batchMax: 8,
              onEnter: (batch) =>
                gsap.from(batch, {
                  ...from,
                  stagger: interval,
                  duration: 0.65,
                  clearProps: "transform,opacity",
                  ease: "power2.out"
                })
            });
          });

          document
            .querySelectorAll<HTMLElement>(".ed-section, .ed-method-document, .ed-master-chronology")
            .forEach((section) => {
            if (!section.id) return;
            const link = document.querySelector<HTMLAnchorElement>(`.ed-index-link[href="#${section.id}"]`);
            if (!link) return;
            ScrollTrigger.create({
              trigger: section,
              start: "top 42%",
              end: "bottom 42%",
                onToggle: ({ isActive }) => link.classList.toggle("ed-nav-current", isActive)
              });
            });

          const finePointer = window.matchMedia("(pointer: fine)").matches;
          if (finePointer) {
            const tiltCards = document.querySelectorAll<HTMLElement>(
              ".ed-conflict-grid article, .ed-source-grid article, .ed-hero-thesis"
            );
            tiltCards.forEach((card) => {
              const rotateX = gsap.quickTo(card, "rotationX", { duration: 0.35, ease: "power2.out" });
              const rotateY = gsap.quickTo(card, "rotationY", { duration: 0.35, ease: "power2.out" });
              const onMove = (event: PointerEvent) => {
                const bounds = card.getBoundingClientRect();
                const x = (event.clientX - bounds.left) / bounds.width - 0.5;
                const y = (event.clientY - bounds.top) / bounds.height - 0.5;
                rotateX(y * -4);
                rotateY(x * 5);
              };
              const onLeave = () => {
                rotateX(0);
                rotateY(0);
              };
              card.addEventListener("pointermove", onMove);
              card.addEventListener("pointerleave", onLeave);
              listenerCleanup.push(() => {
                card.removeEventListener("pointermove", onMove);
                card.removeEventListener("pointerleave", onLeave);
              });
            });

            document.querySelectorAll<HTMLElement>(".ed-button, .ed-index-explorer").forEach((button) => {
              const moveX = gsap.quickTo(button, "x", { duration: 0.25, ease: "power2.out" });
              const moveY = gsap.quickTo(button, "y", { duration: 0.25, ease: "power2.out" });
              const onMove = (event: PointerEvent) => {
                const bounds = button.getBoundingClientRect();
                moveX((event.clientX - bounds.left - bounds.width / 2) * 0.12);
                moveY((event.clientY - bounds.top - bounds.height / 2) * 0.16);
              };
              const onLeave = () => {
                moveX(0);
                moveY(0);
              };
              button.addEventListener("pointermove", onMove);
              button.addEventListener("pointerleave", onLeave);
              listenerCleanup.push(() => {
                button.removeEventListener("pointermove", onMove);
                button.removeEventListener("pointerleave", onLeave);
              });
            });
          }

          gsap.from(".ed-footer > *", {
            y: 20,
            opacity: 0,
            stagger: 0.08,
            duration: 0.6,
            scrollTrigger: {
              trigger: ".ed-footer",
              start: "top 90%",
              once: true
            }
          });
        });

        return () => context.revert();
      });

      dispose = () => {
        listenerCleanup.forEach((cleanup) => cleanup());
        media.revert();
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      };

      requestAnimationFrame(() => ScrollTrigger.refresh());
    }

    void setupMotion();
    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  return <div ref={progressRef} className="ed-scroll-progress" aria-hidden="true" />;
}
