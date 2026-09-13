import { uid } from "@/lib/utils";
import { Genome, parseGenome, type Genome as GenomeT, type BrandColor } from "./schema";
import { PERSONALITY_AXES } from "./archetypes";
import { STAGES } from "./stages";

export function createGenome(name = "Untitled brand"): GenomeT {
  const now = Date.now();
  return parseGenome({
    id: uid(10),
    name,
    createdAt: now,
    updatedAt: now,
    strategy: { personality: PERSONALITY_AXES.map((a) => ({ ...a, value: 50 })) },
    stages: Object.fromEntries(STAGES.map((s) => [s.id, "todo"])),
    history: [{ id: uid(8), ts: now, actor: "system", summary: "Project created" }],
  });
}

export function color(name: string, hex: string, role: BrandColor["role"], usage = ""): BrandColor {
  return { id: uid(6), name, hex, role, usage, locked: false };
}

/** A fully worked example so first-run users see every lab lit up. */
export function createSampleGenome(): GenomeT {
  const g = createGenome("Aurora Roasters");
  g.brief = {
    clientName: "Aurora Roasters",
    projectName: "Aurora Roasters brand identity",
    industry: "Specialty coffee",
    description:
      "A small-batch coffee roaster in Reykjavík sourcing single-origin beans and roasting under the northern lights. Opening a flagship café and launching direct-to-consumer subscriptions.",
    goals: "Stand out from generic 'craft' coffee brands; feel premium yet warm; work on bags, cups, signage and Instagram.",
    audience: "Design-literate urban coffee drinkers 25–45, tourists seeking a Reykjavík ritual, and specialty cafés buying wholesale.",
    deliverables: ["Logo system", "Color palette", "Typography", "Packaging", "Social templates", "Brand guidelines"],
    timeline: "6 weeks",
    constraints: "Must print well in one color on kraft paper. Avoid clichéd coffee-bean iconography.",
    references: "Nordic minimalism, aurora gradients, old Icelandic woodcuts.",
    competitors: [
      { name: "Reykjavík Roasters", note: "Rustic, hand-drawn, very established" },
      { name: "Blue Bottle", note: "Clinical minimalism; we should feel warmer" },
    ],
  };
  g.strategy = {
    positioning: "For curious coffee drinkers who want a sense of place, Aurora Roasters is the specialty roaster that turns Reykjavík's long nights into bright, precise cups.",
    mission: "Roast coffee that tastes like a clear northern morning.",
    vision: "Become the coffee ritual people associate with Iceland.",
    values: ["Precision", "Warmth", "Curiosity", "Honesty"],
    archetype: "explorer",
    secondaryArchetype: "sage",
    personality: [
      { id: "playful-serious", left: "Playful", right: "Serious", value: 55 },
      { id: "friendly-authoritative", left: "Friendly", right: "Authoritative", value: 40 },
      { id: "classic-modern", left: "Classic", right: "Modern", value: 65 },
      { id: "minimal-expressive", left: "Minimal", right: "Expressive", value: 35 },
      { id: "accessible-premium", left: "Accessible", right: "Premium", value: 70 },
      { id: "calm-energetic", left: "Calm", right: "Energetic", value: 30 },
    ],
    tagline: "Roasted under the lights.",
    taglineOptions: ["Roasted under the lights.", "Bright cups, long nights.", "Coffee with a sense of north."],
    tone: {
      voice: "Calm, precise and quietly poetic. Short sentences. Facts about origin and roast, then one line of wonder.",
      dos: ["Name the farm and altitude", "Use weather and light as metaphors", "Be specific about flavour"],
      donts: ["Say 'artisanal' or 'handcrafted'", "Use exclamation marks", "Over-explain"],
      sample: "Ethiopia, Guji. 2,100 m. Washed. Tastes like bergamot and the first hour of daylight.",
    },
    keywords: ["aurora", "north", "precision", "warmth", "light", "volcanic", "quiet"],
    differentiators: ["Roast profiles designed for Iceland's water", "Transparent farm-gate pricing", "Café doubles as a light-therapy room in winter"],
    nameOptions: [],
  };
  g.visual.palette = {
    colors: [
      color("Aurora Teal", "#0F7B6C", "primary", "Logo, headlines, primary buttons"),
      color("Midnight", "#0B1B2B", "secondary", "Backgrounds, packaging base"),
      color("Ember", "#E07A3F", "accent", "Highlights, calls to action, stamps"),
      color("Fjord", "#A9C7C1", "neutral", "Tints, secondary surfaces"),
      color("Snow", "#F4F1EA", "background", "Paper, light backgrounds"),
      color("Ink", "#14161A", "text", "Body copy"),
    ],
    rationale: "A cool aurora teal anchored by a near-black midnight, with an ember accent for warmth. Snow keeps print feeling like paper, not screen.",
    dark: {},
  };
  g.visual.typography.display = { family: "Fraunces", source: "google", category: "serif", weights: [400, 600], fallback: "serif", variable: true };
  g.visual.typography.body = { family: "Inter", source: "google", category: "sans-serif", weights: [400, 500, 600], fallback: "sans-serif", variable: true };
  g.visual.typography.scale = { base: 16, ratio: 1.25 };
  g.visual.typography.rationale = "Fraunces brings warmth and a slightly old-world softness to headlines; Inter keeps labels and origin data crisp and neutral.";
  g.visual.logo.wordmarkText = "Aurora";
  g.visual.logo.concept = "A single continuous line that reads as both a rising sun over a horizon and a curl of steam.";
  g.visual.logo.usageRules = ["Prefer the primary lockup on light backgrounds", "Use the mark alone at sizes under 32px", "Never place on busy photography without the Midnight scrim"];
  g.visual.logo.doNots = ["Do not stretch or skew", "Do not add drop shadows", "Do not recolor outside the palette"];
  g.visual.imagery = {
    medium: "Editorial photography with a matte film look",
    lighting: "Low winter sun, long shadows, soft blue hour",
    composition: "Generous negative space, subject low in frame, wide horizons",
    colorTreatment: "Cool shadows, warm ember highlights, muted saturation",
    subjects: "Steam, hands, ceramic cups, volcanic rock, sea light, roasting drum details",
    mood: ["quiet", "precise", "warm", "expansive"],
    avoid: ["latte art", "coffee beans in a heart", "stock-photo smiles", "neon"],
    promptSuffix: "",
    referenceAssetIds: [],
    guidance: "Show the place before the product. Coffee appears as ritual, never as a pile of beans.",
  };
  g.visual.elements = {
    shapes: ["Horizon arc", "Steam curl", "Concentric light rings"],
    patterns: ["Thin aurora line pattern at 8% opacity", "Topographic contour of Esja"],
    iconStyle: { style: "outline", strokeWidth: 1.5, cornerRadius: 2 },
    notes: "One-color line work only. Icons share the mark's stroke weight.",
  };
  g.visual.motion = {
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    durationBase: 600,
    principles: ["Slow reveals, like light arriving", "No bounces", "Ember accent moves last"],
    preset: "draw-on",
    notes: "",
  };
  g.stages = { brief: "done", strategy: "done", logo: "in-progress", color: "done", type: "done", imagery: "in-progress", motion: "todo", mockups: "todo", guidelines: "todo", export: "todo" };
  return Genome.parse(g);
}
