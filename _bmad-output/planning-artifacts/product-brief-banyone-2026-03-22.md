---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - _bmad-output/brainstorming/brainstorming-session-2026-03-22-100809.md
date: 2026-03-22
author: Nam
productBriefStatus: complete
completedAt: 2026-03-22
---

# Product Brief: banyone

## Executive Summary

**banyone** is a mobile application for **iOS and Android** that takes a user-supplied **video** (with a clear performer, “character A”) and a **reference image** of another character (“character B”), then produces a **new video** that **preserves the scene and background** while **replacing A with B** so that **B performs the same actions and timing** as in the source. The intent is a **simple, minimal-step, approachable UI** with **cost-aware defaults** (for example, a **lower-but-acceptable output resolution tier**) so inference and operations remain viable under a **constrained build and run budget**. Technical direction from discovery points to a **WAN 2.2–class “animate replace”** capability (or equivalent) as the core model path.

The first audience is framed broadly as **younger users (under 40)**—to be tightened into concrete personas in the PRD. **Differentiation** is hypothesized around **ease and speed to a good result** versus heavier tools, and a **relatively open niche**—both require **evidence** (competitor scan, proof points). **Open PRD work** includes **monetization**, **trust and consent / misuse**, **app store policy for synthetic media**, and **explicit unit economics**.

---

## Core Vision

### Problem Statement

People who want **character replacement in video**—**same scene and motion**, not a generic edit—still face **complex toolchains**, **pro-centric software**, or **raw APIs** without a **guided, mobile-first** path. Getting a **believable** result **quickly** remains harder than it should for **casual and creator** use cases.

### Problem Impact

Users **lose time** on workarounds (desktop pipelines, multiple apps, manual compositing) or **drop the idea**. **Creativity and sharing** stall when the **cost and complexity** of production are too high; teams with **limited capital** cannot sustain **open-ended inference** or **heavy ops**.

### Why Existing Solutions Fall Short

**Generic video editors** are not optimized for **motion-matched character swap** with **scene preservation**. **Face-swap or lighter apps** may not deliver **full-body performance transfer** and **environment fidelity**. **Developer APIs** may lack **end-user guidance** and a **minimal-step** journey. Many alternatives **optimize for power users**, not for **fast first success** on a phone.

### Proposed Solution

A **focused mobile app**: **video + reference image → swapped output video**, with **defaults tuned for acceptable quality at controlled cost**, shipped on the **App Store** and **Google Play**, starting from a **young (under 40)** demographic as a **broad v0 segment** to refine into **primary and secondary personas**.

### Key Differentiators

- **Friction**: **Few steps** and a **friendly** path from input to export versus complex multi-tool workflows.
- **Economics**: **Resolution or quality tiers** (and similar levers) as a deliberate **COGS and pricing** strategy, not an afterthought.
- **Focus**: **Animate-replace–style** output as the **core job**; competitive **proof** to be captured in the PRD.

## Target Users

### Primary Users

**Casual–creator “motion swap” users (v0 segment: roughly under 40)**

- **Who:** People making **short-form or personal video** who want a **character replacement** that **keeps the scene and motion** from the source clip, without a **pro editing stack**.
- **Context:** **Mobile-first**; motivated by **fun, novelty, self-expression**, or **light creator** workflows; sensitive to **time, friction, and price**.
- **Problem experience:** **App-hopping**, **abandoning** the idea, or accepting **weaker** tools that don’t match **full performance** and **environment**.
- **Success:** **Few steps** from **video + reference image → shareable output**; result is **“good enough”** at the **default quality tier** for their use (social clip, message, draft idea).

**Aspiring creator (same primary bucket, higher intent)**

- Wants **faster iteration** than desktop pipelines; may trade **absolute fidelity** for **speed and simplicity** if the app stays **dependable**.

### Secondary Users

- **Viewers** of shared clips (no direct product use)—value is **indirect**.
- **Brands / SMB / API customers** are **not** detailed personas for v1; revisit in PRD if strategy shifts.

### User Journey

- **Discovery:** App Store / Play **search**, **paid/organic social**, creator **word-of-mouth**, or **trend-driven** pull (to validate in GTM).
- **Onboarding:** Install → short **value explanation** → permissions only as needed.
- **Core usage:** Select **source video** → select **reference image** → **submit job** → **wait** with clear status → **preview** → **export / share**.
- **Success moment:** First **end-to-end** result where **motion reads correctly** and the swap is **believable enough** to post or iterate on.
- **Long-term:** **Repeat use** when new footage appears; retention tied to **quality**, **latency**, **pricing**, and **trust** (policy/safety).

## Success Metrics

Success measures should connect **user outcomes** to **unit economics** and **risk**, consistent with the brainstorming themes (reach, WTP, budget, trend).

### User-oriented signals

- **Activation:** Share of new users who reach **first successful export** in **session one** or within **24 hours** (exact target in PRD).
- **Journey health:** **Funnel completion** by step (upload, queue, preview, export); **median time** to first preview.
- **Outcome proxy:** **Retry rate**, simple **in-app feedback**, or **share/save** as **“good enough”** indicators until deeper studies run.
- **Retention:** **D1 / D7** among users who completed **first export**.

### Business objectives

- **~3 months:** Confirm **real demand** and rough **WTP** while respecting **low build/ops budget**; know **COGS per job**.
- **~12 months:** **Sustainable** export economics; **scale marketing** only if **margin and compliance** support it.

### Key performance indicators

| Area | Examples (set targets in PRD) |
| --- | --- |
| Growth | Installs, **cost per first completed export** |
| Engagement | **First-job completion rate**, exports per active user |
| Economics | **Inference cost** per minute of output, **tier mix** (resolution/quality) |
| Monetization | Conversion when **paid/credits** exist, **ARPU** |
| Risk / trust | Moderation volume, **policy** flags, **appeals** |

## MVP Scope

### Core features

- **Pipeline:** **One video + one reference image → one output video** with **scene preserved** and **target character** following **source motion** (WAN 2.2–class **animate replace** or equivalent).
- **Constraints:** Documented **caps** (duration, resolution, format) aligned with **cost-aware default tier**.
- **Client:** **iOS + Android** apps with **minimal-step** UX: pick inputs, submit, track job, preview, export/share.
- **Backend:** **Job queue**, storage, and inference integration sufficient for **defined** caps and **predictable** failure handling.
- **Basics:** Minimal **account/device identity** if required for **rate limits**, **abuse prevention**, and **store** policy.

### Out of scope for MVP

- **Multi-character** jobs, **batch** processing, **full NLE**-style timeline editing, **user-trained models**, **B2B API** as a product surface, **in-app social network**.
- **Enterprise** consent stacks and **deep** identity programs—**unless** PRD mandates a **minimal** bar for launch.

*Note:* **Safety, misuse prevention, and store rules for synthetic media** are **not** optional forever; MVP must still define a **baseline** in the PRD even if features stay thin.

### MVP success criteria

- **Ship:** Reliable **happy path** within published **limits**.
- **Learn:** Measurable **first-export** completion and **qualitative** ease vs. a **small competitor set**.
- **Decide:** Clear **per-job cost** model and **go / pivot / kill** inputs for **post-MVP investment**.

### Future vision

- **Higher** quality/speed **tiers**, **better controls** (e.g. hints, masks), **creator** and **partner** surfaces, possible **API**, and **stronger** trust/consent tooling as the product and budget allow.
