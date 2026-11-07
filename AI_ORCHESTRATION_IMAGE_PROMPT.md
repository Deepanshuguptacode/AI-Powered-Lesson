# AI Orchestration Architecture — Visual Composition & Image Generation Prompts

This document provides a comprehensive visual description and ready-to-use generation prompts for creating high-fidelity, presentation-grade architectural diagrams of the **AILessonGenerator Multi-Agent Orchestration Platform & Iterative QC Workflow**.

---

## 🎨 1. Detailed Visual Layout & Scene Composition Description

### Canvas Structure & Orientation
- **Aspect Ratio**: 16:9 widescreen (`1920x1080` or `3840x2160`).
- **Composition Style**: Left-to-right (or top-to-bottom pipeline) flow diagram with semi-translucent glassmorphic cards, luminous glowing data pipelines, and a distinct **circular neon amber self-correction loop**.
- **Background**: Deep slate navy / obsidian matte finish (`#090d16` to `#0f172a`) with subtle isometric circuit traces, micro-grid dots, and soft ambient volumetric backlighting.

---

### Step-by-Step Node Layout

#### 1. Stage 1: Input Guardrails Gate (Far Left / Top Left)
- **Visual Element**: Hexagonal shield-shaped glassmorphic container glowing in **Electric Indigo / Violet** (`#6366f1`).
- **Icons**: Holographic security badge, lock, and AI prompt scanner.
- **Labels**: `"Stage 1: Input Guardrails"`, `"openai/gpt-oss-20b"`, `"Prompt Injection & Safety Scan"`.

#### 2. Stage 2: ReAct Supervisor Planning Node
- **Visual Element**: Rectangular crystalline module with pulsating **Teal / Emerald** (`#10b981`) edge glow.
- **Icons**: Brain icon with branching search nodes.
- **Labels**: `"Stage 2: Supervisor Planning Agent"`, `"Decomposes Objectives into Tri-Domain Queries"`.

#### 3. Stage 3: Tri-Domain Parallel Research Swarm (Split & Join)
- **Visual Element**: The pipeline branches into three parallel floating glass cards with green holographic connectors:
  - **Web Agent**: Globe icon, crawling academic websites, Wikipedia, official docs (`#22c55e`).
  - **Book Agent**: Open textbook icon, ISBN search, chapter indexing (`#16a34a`).
  - **YouTube Agent**: Play button icon, video transcripts, durations, and channels (`#ef4444`).
- **Join Point**: The three data streams converge into an **Evidence Aggregator & Normalizer** node.

#### 4. Stage 4 & 4b: The Iterative QC Self-Correction Core (Centerpiece)
- **Visual Element**: A large, highlighted container framed with a subtle gold/amber neon border. Inside sits:
  - **Node A (Synthesizer)**: Glowing cyan card labeled `"45-Minute Lesson Synthesizer (openai/gpt-oss-120b)"`.
  - **Node B (Duration Validator)**: Meter gauge showing `"5+12+8+7+6+4+3 = Exactly 45m"`.
  - **Node C (Dual Parallel QC Auditors)**: Split card showing `"Factual QC Agent"` (Shield) and `"Instructional QC Agent"` (Grading Rubric).
  - **Node D (Conditional Evaluation Diamond)**: Decision node labeled `"Score ≥ 80%?"`.
  - **The Iterative Feedback Loop (Key Visual Feature)**:
    - A dramatic, glowing **Neon Amber / Warm Gold curved arrow** looping from the decision diamond *backwards* into the Synthesizer node.
    - Floating tag above the loop arrow: `"Score < 80%: Auto-Remediation with QC Critique & Increments Version (v1.0 -> v2.0)"`.
    - Downward glowing green arrow: `"Score ≥ 80%: Finalized"`.

#### 5. Stage 5: Instructor Dashboard & Human-in-the-Loop Governance
- **Visual Element**: Sleek UI panel with purple/magenta accent lighting (`#a855f7`).
- **Details**: Mini toggle switches for `"Accept / Reject / Modify"`, version badge (`"v2.0 (QC Improved)"`), and a glowing holographic **"Formal Instructor Approval"** stamp.

#### 6. Stage 6: Certified Publication Export Engine (Far Right)
- **Visual Element**: High-tech document vault illuminated in **Cobalt Blue** (`#3b82f6`).
- **Outputs**: Two crisp glowing document emblems:
  - **PDF Package** (Crimson badge with embedded QC audit pages).
  - **DOCX Package** (Blue Word badge with editable classroom formatting).

---

## 🚀 2. Production Prompts for AI Image Generators

### Prompt 1: Midjourney v6 (Recommended for Best Visual Fidelity)

```text
A hyper-detailed, clean enterprise AI architecture diagram representing a multi-agent educational orchestration workflow, wide 16:9 infographic. Dark obsidian and slate navy background with subtle glowing micro-circuit grid. 
Left to right pipeline flow: 
Node 1 glowing indigo hexagonal shield labeled "Input Guardrails (openai/gpt-oss-20b)". 
Node 2 teal supervisor planner branching into three parallel glowing glass cards labeled "Web Research", "Textbook Search", and "YouTube Indexer". 
Centerpiece stage inside a highlighted gold frame labeled "LangGraph Iterative Self-Correction Engine": showing a cyan "45-Minute Lesson Synthesizer" node connecting to dual parallel "Factual & Instructional QC Auditors" with score gauges, and a prominent bright luminous amber curved feedback arrow looping back from the QC decision diamond to the synthesizer with label "Autonomous Iterative Loop (Score < 80%)". 
Right stage showing a purple glassmorphic "Human-in-the-Loop Instructor Dashboard" with approval stamp, leading to glowing blue "Certified PDF & DOCX Export" document icons. 
Ultra-modern UI, sleek glassmorphism, octane render, clean legible vector typography, isometric 3D accents, vibrant neon cyan, electric indigo, emerald green, and glowing amber accent lighting, corporate tech presentation aesthetic, 8k resolution --ar 16:9 --style raw --v 6.0
```

---

### Prompt 2: OpenAI DALL-E 3

```text
An ultra-modern, high-tech architectural system diagram showing an autonomous multi-agent AI pipeline for generating 45-minute lesson plans. 
The diagram is set on a dark slate background with glowing neon circuitry lines and sleek glassmorphic UI cards arranged horizontally from left to right:
1. On the left: "Stage 1: Input Guardrails" shown as a glowing violet cyber shield scanning prompt safety.
2. Next: "Stage 2: Supervisor Planning Agent" in emerald green branching into three parallel research pods labeled "Web Agent", "Book Agent", and "YouTube Agent" with small icons.
3. In the center: A prominent highlighted module titled "Stage 4: LangGraph Iterative QC Feedback Loop". Inside, a lesson synthesizer node connects to a duration validator (showing "45 Minutes Total") and two parallel QC auditing nodes ("Factual QC" and "Instructional QC"). A glowing orange-amber curved feedback arrow arcs backward from the QC test to the synthesizer node, illustrating autonomous self-correction when quality is under 80%.
4. On the right: A human-in-the-loop "Instructor Dashboard" with version badges (v1.0, v2.0) and an instructor approval gate.
5. Far right: The "Certified Document Export Engine" producing glowing PDF and Word DOCX document icons with attached QC audit stamps.
Clean, crisp enterprise design, premium tech infographic, legible typography, 3D volumetric glow, cyberpunk-inspired corporate aesthetics.
```

---

### Prompt 3: Stable Diffusion XL / ComfyUI

#### Positive Prompt:
```text
(masterpiece, best quality, ultra-detailed:1.2), enterprise software architecture diagram, 16:9 widescreen infographic, multi-agent AI system workflow, dark mode aesthetic, slate background (#0f172a) with subtle blue grid traces, modular glassmorphic nodes connected by luminous fiber optic data streams,
left node: hexagonal shield "Input Guardrails" glowing electric purple,
subsequent node: green "Supervisor Planner" splitting into 3 parallel cards "Web Search", "Book Research", "YouTube Indexing",
central highlighted container: "LangGraph Iterative QC Feedback Loop" with cyan "Lesson Synthesizer", "45-Min Duration Validator", split "Factual & Instructional QC" evaluator cards, prominent glowing amber curved feedback loop arrow returning back to generator with "Autonomous Self-Correction" badge,
right node: purple glassmorphic "Instructor Review & Approval Gate",
final node: blue "Publication Engine" outputting certified PDF and DOCX documents with gold QC badges,
crisp vector typography, modern UI design, Figma presentation style, volumetric lighting, isometric 3D icons, clean composition, 8k UHD
```

#### Negative Prompt:
```text
(worst quality, low quality, blurry, deformed text, messy layout, hand-drawn sketch, low resolution, noisy, artifact, cluttered, illegible scribble, cartoonish, oversaturated, photorealistic human faces, photographic clutter:1.4)
```

---

## 🎨 3. Aesthetic Style Variations

### Style Variation A: Modern Clean Enterprise 3D Isometric (Ideal for Whitepapers)
> **Description**: Pure white / light titanium background with soft ambient shadows, floating 3D isometric rounded glass tiles, pastel color coding (Indigo, Emerald, Coral, Royal Blue), and polished metallic edges.
>
> **Midjourney Prompt Modifier**:
> `Clean white minimalist studio background, 3D isometric floating glass blocks, Apple developer keynote presentation aesthetic, soft directional studio lighting, elegant pastel color accents, clean sans-serif typography, architectural infographic --ar 16:9 --v 6.0`

### Style Variation B: Dark Neon Cyberpunk / HUD Infographic (Ideal for Dark Mode READMEs)
> **Description**: High-contrast matte black background, vibrant neon cyan (`#00f2fe`), neon magenta (`#fe0979`), and glowing amber laser lines, wireframe grid terrain in perspective, holographic HUD displays.
>
> **Midjourney Prompt Modifier**:
> `Sci-fi cyberpunk HUD interface, dark obsidian background, glowing holographic wireframes, neon cyan and hot magenta laser conduits, glowing amber circular iteration loop, high-tech AI telemetry command center --ar 16:9 --v 6.0`

### Style Variation C: Minimalist Technical Architectural Blueprint (Ideal for Engineering RFCs)
> **Description**: Deep navy blueprint background with fine white and light-cyan technical drafting lines, precise grid coordinates, schematic symbols, and vector node connectors.
>
> **Midjourney Prompt Modifier**:
> `Technical architectural software blueprint, deep cyan blueprint paper, crisp white drafting schematics, precise engineering vector lines, clean flow diagram of multi-agent loop, CAD style typography, minimalist schematic --ar 16:9 --v 6.0`

---

## 📋 4. Usage Instructions

1. **Midjourney**:
   - Open Discord and access the Midjourney bot.
   - Enter `/imagine prompt:` followed by the text in **Prompt 1**.
   - Select the desired upscaled variation (U1, U2, U3, or U4).
2. **DALL-E 3**:
   - Paste **Prompt 2** into ChatGPT Plus (GPT-4) or the OpenAI API with `model: "dall-e-3"`, `size: "1792x1024"`, `quality: "hd"`.
3. **Saving to Repository**:
   - Save the rendered image as `ai-orchestration-architecture.png` in the `public/images/` or root directory of the repository to embed directly into `README.md` and `AI_ORCHESTRATION_ARCHITECTURE.md`.

