---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: "Mobile AI app: video (character A) + reference image (character B) → output video with same scene/background and B performing A's motion; WAN 2.2 Animate Replace as candidate model"
session_goals: "Sharpen and detail the concept for a subsequent PRD (scope, flows, constraints, open questions)"
selected_approach: ai-recommended
techniques_used:
  - Question Storming
  - Morphological Analysis
  - Six Thinking Hats
ideas_generated: 33
context_file: ''
current_technique: Six Thinking Hats (completed)
question_storming_status: partial_complete
morphological_analysis_status: partial_complete
six_thinking_hats_status: complete
technique_execution_complete: true
workflow_completed: true
session_active: false
facilitation_notes: "Collaborative PRD-prep focus; Question Storming + partial Morphological grid + full Six Hats; user expressed uncertainty/worry—captured as risk signal."
---

# Brainstorming Session Results

**Facilitator:** Nam
**Date:** 2026-03-22

## Session Overview

**Topic:** Mobile application where the user provides a video containing character A and an image of character B; the system produces a new video preserving scene and background while replacing A with B so that B follows the same actions and timing as A. Pre-research points to WAN 2.2 Animate Replace as a capable model for this pipeline.

**Goals:** Increase clarity and depth of the idea so it can drive a structured PRD next (problem statement, users, journeys, functional and non-functional requirements, dependencies, and risks).

### Context Guidance

_No external context file was attached; framing is from this conversation._

### Session Setup

Session parameters were confirmed with Nam on 2026-03-22. Next step is selecting how to run ideation (technique library path).

## Technique Selection

**Approach:** AI-Recommended Techniques  
**Analysis context:** Mobile character-replace video app with PRD-prep goals (scope, journeys, requirements, constraints).

**Recommended techniques (sequence):**

1. **Question Storming** — Frame the problem space with questions before locking requirements; surfaces PRD discovery areas.
2. **Morphological Analysis** — Map product dimensions (inputs, pipeline, UX, limits) to make scope explicit.
3. **Six Thinking Hats** — Structured sweep (facts, benefits, risks, creativity, process) for PRD-ready bullets.

**AI rationale:** PRD work needs correct problem definition and explicit parameter space; structured + deep methods match technical precision and system complexity better than pure “wild” ideation alone.

## Technique execution

### Question Storming — Lens: Who and why (round 1)

_Questions only; answers deferred._

- Can this application make a profit?
- How many potential users are there?
- What does the user get from the app?
- How can we differentiate from others?
- What is the cost of making the app?

### Question Storming — Threads: profit/cost, users/value, differentiation (round 2)

_Nam selected all three threads. Below: facilitator-added questions to react to (still unanswered)._

**Profit / cost**

- Who pays—consumer subscription, per-export credits, B2B API, or ads?
- What has to be true per exported minute (or per job) for gross margin to work?
- Is the dominant cost inference, storage, bandwidth, review/ops, or fraud?
- At what scale does self-hosting vs API vs bundled SDK change the model?
- What revenue would still be “not worth it” given legal/brand risk?

**Users / value**

- Which segment is v1: casual social, creator/pro, internal brand, or education?
- If this disappeared tomorrow, what workflow would users fall back to?
- What’s the one-sentence “before → after” for the primary persona?
- Is the core value “believable swap,” “speed,” “control,” or “safety”?
- What would make a user try once but never return?

**Differentiation**

- Who are “others”: generic video editors, character tools, face-swap apps, or cloud APIs?
- Do we compete on model quality, latency, price, guidance, or policy?
- What would we refuse (e.g. certain content, no public gallery, no anonymous)?
- Is differentiation mostly product, distribution, or trust/compliance?
- What would a “good enough” competitor copy in a weekend?

### Question Storming — transition (on request: next technique)

**Status:** Partial completion — strong question bank for PRD discovery; trust/misuse lens not fully explored (can revisit later).

**Captured focus:** Viability (who pays, unit economics, cost drivers), user outcome and segment, competitive frame and “refuse to do.”

**Next technique:** Morphological Analysis — build explicit product dimensions and option sets for PRD scope.

---

### Morphological Analysis — in progress

**Goal:** Name **parameters** (rows) and **options** (cells) for the product system so PRD scope is combinatorial and explicit, not one vague “app.”

**Element 1 (current):** Agree on **parameter list** (what dimensions matter). Starter draft below — edit freely.

| Parameter (dimension) | Example options (not final) |
| --- | --- |
| **Primary payer / GTM** | Consumer; creator/pro; SMB/brand; API partner |
| **Inference runtime** | Cloud job queue; on-device; hybrid (preview cloud, export device) |
| **Input constraints** | Max duration; max resolution; single vs multi-character; reference image count |
| **Consent & identity** | None; self-only; attest + optional ID; enterprise contract |
| **Monetization** | Subscription; credits per export; freemium + watermark; B2B seat |
| **Output policy** | Watermark; resolution cap; export formats; re-download limits |
| **Differentiation axis** | Model quality; speed; guided UX; safety/compliance; price |

_Next step after you react: pick one row to expand options, or add new rows._

### Morphological Analysis — transition (on request: next technique)

**Status:** Partial completion — starter **parameter grid** captured; Nam did not yet customize rows/options (combinations and “v1 pick” not finalized).

**Carry-forward:** Dimensions for PRD: payer/GTM, runtime, inputs, consent, monetization, output policy, differentiation.

**Next technique:** Six Thinking Hats — structured sweep for PRD-ready bullets (facts, benefits, risks, creativity, emotion, process).

---

### Six Thinking Hats — in progress

**Process (Blue hat, one minute):** Goal of this pass = material for **PRD** (problem, scope, NFRs, risks). We rotate hats; **only one mode at a time**. Order below.

| Hat | Focus |
| --- | --- |
| **White** | Facts / knowns / gaps (no opinions) |
| **Yellow** | Benefits / value / why ship |
| **Black** | Risks / failure / abuse / cost |
| **Green** | Creative options / scope cuts / experiments |
| **Red** | Gut reaction / fears / excitement (brief) |
| **Blue** | Summarize and “what’s still open” |

**White hat (facts / stated intent) — captured**

_Facilitator seed (you may strike):_

- Inputs: user-supplied video + still image of target character; output preserves scene; character motion follows source performance.
- Pre-research: a model family described as WAN 2.2 Animate Replace aligns with the desired behavior.
- Unknown until spec’d: hosting, limits, consent UX, pricing, exact model license/API.

_Nam — White hat additions:_

- **Simplicity:** Product intent — **simple application** (minimal flow / UI surface).
- **Audience:** Stated target — **young users (under 40)**. _(Broad demographic; can refine personas later in PRD.)_
- **Distribution:** Ship on **Apple App Store** and **Google Play** (iOS + Android).

**Yellow hat (benefits) — captured**

_Nam:_

- **Ease of use:** Positioning — **easier to use than alternatives** (simpler UX vs other tools in the space).
- **Market opportunity:** Belief — **relatively few competitors today** in this specific niche (room to win early).

**Black hat (risks) — captured**

_Nam:_

- **Distribution / GTM:** Risk — **cannot reach customers** (discovery, ads, ASO, content, partnerships).
- **Willingness to pay:** Risk — users **may not be willing to pay** (price sensitivity, “good enough” free tools).
- **Capital:** Constraint — **low budget** for **building and operating** the app (infra, inference, support).
- **Demand / trend:** Risk — **demand may be limited** and the **trend could fade** (novelty / hype cycle).

**Green hat (options / scope) — captured**

_Nam:_

- **Cost / quality tradeoff:** Default to **lower-but-sufficient output resolution** (or tier) to **reduce inference cost** and keep economics workable—users still get an acceptable result. _(If you meant a specific **model** or **mode** name, add it in PRD.)_
- **UX simplicity:** **Minimal-step** flow — **super user-friendly UI** so users reach “done” in **as few steps as possible** (supports differentiation vs complex tools).

**Red hat (gut) — captured**

_Nam:_

- **Unsure** — confidence in direction/decisions not yet settled.
- **Worry** — emotional weight on outcomes (market, money, execution).

**Blue hat (process / summary)**

**What we covered in this Six Hats pass**

- **White:** Core I/O concept; WAN 2.2–class model lead; **simple** app; **under-40** audience; **iOS + Android**; many ops/legal/pricing details still **unknown**.
- **Yellow:** **Easier UX** than alternatives; **few competitors** (hypothesis to validate).
- **Black:** **Customer reach**, **willingness to pay**, **low build/ops budget**, **uncertain demand / possible trend decay**.
- **Green:** **Default lower-but-OK resolution** to control cost; **minimal-step** friendly UI.
- **Red:** **Unsure** and **worried** — normal at pre-PRD stage; worth naming in **risk/assumptions** and **success metrics**.

**Still open for the PRD (not resolved in-session)**

- **Trust / misuse / consent** (Question Storming lens deferred).
- **Morphological “v1 pick”** (which combination of payer, runtime, caps, monetization).
- **Competitive landscape** evidence and **differentiation** proof points.
- **Concrete unit economics** (per job) and **store compliance** for synthetic media.

---

**Six Thinking Hats — complete.**

## Technique execution results

**Question Storming (partial):** Strong **question inventory** for PRD discovery—profit/cost, users/value, differentiation; trust/misuse lens deferred.

**Morphological Analysis (partial):** **Starter parameter grid** captured (payer, runtime, inputs, consent, monetization, output, differentiation); **v1 combination** not finalized.

**Six Thinking Hats (complete):** **White** intent (simple, <40, dual stores); **Yellow** (ease, few competitors); **Black** (reach, WTP, budget, demand/trend); **Green** (resolution tier, minimal-step UX); **Red** (unsure, worry); **Blue** synthesis and open PRD gaps.

**User creative strengths:** Clear product intuition (simplicity, cost-aware quality), honest risk naming, willingness to constrain scope for economics.

**Energy / engagement:** Pragmatic, future-PRD-oriented; session stayed grounded in viability.

---

## Idea organization and prioritization

### Thematic organization

**Theme 1: Product definition and UX**

_Focus: What the app is and how it feels to use._

- Core I/O: video + reference image → swapped character video; scene preserved; motion matched.
- **Simple** app, **minimal steps**, **super user-friendly** UI.
- **Default lower-but-sufficient output resolution** to manage inference cost and pricing pressure.
- Technical direction: **WAN 2.2 Animate Replace** (or equivalent) as lead capability.

**Pattern:** A coherent **v1 story**: magic output with **frictionless** flow and **cost-aware** defaults.

**Theme 2: Audience and go-to-market**

_Focus: Who it’s for and how it gets discovered._

- Target: **young users (under 40)**—broad; refine personas in PRD.
- Distribution: **App Store + Google Play**.
- Yellow: **easier than alternatives**; **not many competitors** (validate with research).
- Black: **cannot reach customers**—discovery, ASO, content, partnerships.

**Pattern:** **Positioning** is optimistic; **distribution** is the main execution risk.

**Theme 3: Economics and viability**

_Focus: Money, budget, and durability of demand._

- Question Storming: profit, user count, value prop, differentiation, build cost.
- Black: **low budget** build/ops; **users may not pay**; **demand may be weak**; **trend may fade**.
- Green: resolution tier as **COGS lever**.

**Pattern:** **Unit economics** and **WTP** must be explicit in the PRD—not assumed.

**Theme 4: Emotional signal and meta-risk**

_Focus: How the project feels and what to track._

- Red: **unsure**, **worry** → treat as **assumptions to validate** and **leading indicators** (retention, share, conversion), not as stop signals.

**Cross-cutting (PRD backbone):** Unanswered **Question Storming** list + **morph grid** = backlog of **decisions** and **experiments**.

**Breakthrough / wedge concepts:** **Resolution-tier defaults** + **few-step UX** as a **differentiated, low-budget** path vs heavier tools.

**Implementation-ready (for PRD writing):** White-hat **constraints** (simple, <40, dual store); Black-hat **risk register**; Green-hat **scope levers**.

### Prioritization results (PRD-oriented)

Aligned with session goals (**clarity for PRD**), suggested emphasis:

| Priority | Focus | Rationale |
| --- | --- | --- |
| **P1** | **v1 scope** — pick morphological row values (caps, runtime, monetization sketch, consent stance) | Unlocks every other PRD section. |
| **P2** | **Evidence** — competitor scan + “few competitors” + differentiation proof | Reduces **reach / WTP / trend** uncertainty. |
| **P3** | **Trust & policy** — likeness, consent, misuse, store rules for synthetic media | Deferred in brainstorm; high **Black-hat** impact if ignored. |

**Quick wins for the PRD doc:** Copy **Question Storming** lists into an **Open questions** appendix; draft **one primary persona** from “young (under 40)” + use case; sketch **happy-path** journey (**minimal steps**).

**Longer-horizon:** Trend-dependent **roadmap** (if novelty fades, what’s the “second act”?).

### Action planning (next phase: PRD)

**1. Lock v1 scope (this week)**

1. Fill **morphological grid** with **one chosen option per row** (or mark “v2”).
2. Define **max duration, resolution, and default export tier** (per Green hat).
3. Write **one paragraph** “What we will not ship in v1.”

**Resources:** Your time; optional spreadsheet; model/API **pricing sheet** if available.

**Success:** A **scope table** you can paste into the PRD.

**2. Validate market story (this week)**

1. List **10 “others”** (apps, APIs, editors) and note **overlap** with your niche.
2. Capture **3 proof points** for “easier than alternatives” (steps, time-to-first-output).

**Resources:** Web research, short screen recordings of competitors.

**Success:** PRD **Competitive landscape** + honest **gap analysis**.

**3. Draft risk and policy section (early PRD pass)**

1. Brainstorm **misuse cases** + **mitigations** (even if v1 is minimal).
2. Check **Apple/Google** guidance relevant to **synthetic media / face / likeness** (summarize, don’t legal-advice).

**Resources:** Policy docs, optional legal consult if budget allows later.

**Success:** PRD **Risks & mitigations** + **open compliance questions**.

**Success metrics for “PRD ready”:** Scope row filled; competitor table; explicit **unit economics assumptions**; **consent/trust** section started; **persona v0** + **happy path**.

---

## Session summary and insights

**Achievements**

- **33** tracked idea/question items; **3** techniques used (two partial, one complete).
- **Structured outputs** for PRD: questions, dimensions, hats-based facts/risks/options.
- **Honest** articulation of **budget**, **GTM**, and **emotional** risk.

**Breakthroughs**

- **Economics + UX** pairing: **cheaper default resolution** + **few steps** as a coherent **low-budget strategy**.
- **Blue hat** made explicit **gaps**: trust/consent, morph “v1 pick,” store compliance, competitor validation.

**Reflections**

- **Uncertainty/worry** are **data**—good inputs for **assumptions** and **validation plan** in the PRD.
- Finishing **Morphological Analysis** with real choices will convert this session from **exploration** to **spec**.

**Next steps (you)**

1. Re-read this file when drafting the PRD.
2. Execute **action plan 1–3** above in order.
3. When the PRD draft exists, revisit **deferred Question Storming** (trust/misuse).

---

_Brainstorming workflow status: **complete** (steps 1–4)._
