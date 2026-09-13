/** Registry of procedural mockup templates, grouped by category. */
import { APPAREL } from "./templates/apparel";
import { DIGITAL } from "./templates/digital";
import { PACKAGING } from "./templates/packaging";
import { PRINT } from "./templates/print";
import { SIGNAGE } from "./templates/signage";
import { SOCIAL } from "./templates/social";
import { STATIONERY } from "./templates/stationery";
import { CATEGORY_ORDER, type MockupCategory, type MockupTemplate } from "./types";

export type { MockupCategory, MockupScene, MockupTemplate, SceneOptions, SceneLogos, SceneColors, LogoVariantChoice } from "./types";
export { CATEGORY_LABELS, CATEGORY_ORDER, DEFAULT_OPTIONS } from "./types";

export const MOCKUP_TEMPLATES: MockupTemplate[] = [...STATIONERY, ...PACKAGING, ...SIGNAGE, ...APPAREL, ...DIGITAL, ...SOCIAL, ...PRINT];

export const TEMPLATE_BY_ID: Record<string, MockupTemplate> = Object.fromEntries(MOCKUP_TEMPLATES.map((t) => [t.id, t]));

export function templatesByCategory(): { category: MockupCategory; templates: MockupTemplate[] }[] {
  return CATEGORY_ORDER.map((category) => ({ category, templates: MOCKUP_TEMPLATES.filter((t) => t.category === category) })).filter((g) => g.templates.length > 0);
}

/** The templates that make up the presentation board, in order. */
export function featuredTemplates(count = 6): MockupTemplate[] {
  return [...MOCKUP_TEMPLATES].filter((t) => t.featured !== undefined).sort((a, b) => (a.featured ?? 99) - (b.featured ?? 99)).slice(0, count);
}
