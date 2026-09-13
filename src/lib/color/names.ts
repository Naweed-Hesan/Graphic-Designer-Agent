/**
 * A compact vocabulary of colour names designers actually use, with a
 * nearest-neighbour lookup in OKLab. Used to auto-name swatches.
 */
import { converter } from "culori";

export interface NamedColor {
  name: string;
  hex: string;
}

export const COLOR_NAMES: NamedColor[] = [
  // Reds
  { name: "Crimson", hex: "#DC143C" },
  { name: "Scarlet", hex: "#FF2400" },
  { name: "Ruby", hex: "#9B111E" },
  { name: "Cherry", hex: "#D2042D" },
  { name: "Brick", hex: "#B22222" },
  { name: "Maroon", hex: "#7A1F2B" },
  { name: "Burgundy", hex: "#800020" },
  { name: "Wine", hex: "#722F37" },
  { name: "Oxblood", hex: "#4A0A0A" },
  { name: "Rust", hex: "#B7410E" },
  { name: "Terracotta", hex: "#E2725B" },
  { name: "Coral", hex: "#FF7F50" },
  { name: "Salmon", hex: "#FA8072" },
  { name: "Tomato", hex: "#FF6347" },
  { name: "Vermilion", hex: "#E34234" },
  { name: "Raspberry", hex: "#E30B5C" },
  { name: "Cranberry", hex: "#9E003A" },
  { name: "Cardinal", hex: "#C41E3A" },
  { name: "Watermelon", hex: "#FD4659" },
  { name: "Cerise", hex: "#DE3163" },
  // Oranges
  { name: "Tangerine", hex: "#F28500" },
  { name: "Ember", hex: "#E07A3F" },
  { name: "Apricot", hex: "#FBCEB1" },
  { name: "Peach", hex: "#FFCBA4" },
  { name: "Amber", hex: "#FFBF00" },
  { name: "Pumpkin", hex: "#FF7518" },
  { name: "Burnt Orange", hex: "#CC5500" },
  { name: "Copper", hex: "#B87333" },
  { name: "Carrot", hex: "#ED9121" },
  { name: "Marigold", hex: "#EAA221" },
  { name: "Saffron", hex: "#F4C430" },
  { name: "Papaya", hex: "#FF9F5A" },
  // Yellows
  { name: "Gold", hex: "#D4AF37" },
  { name: "Lemon", hex: "#FFF44F" },
  { name: "Mustard", hex: "#E1AD01" },
  { name: "Honey", hex: "#EBA937" },
  { name: "Butter", hex: "#FFF1A8" },
  { name: "Cream", hex: "#FFFDD0" },
  { name: "Vanilla", hex: "#F3E5AB" },
  { name: "Sand", hex: "#C2B280" },
  { name: "Straw", hex: "#E4D96F" },
  { name: "Canary", hex: "#FFEF00" },
  { name: "Ochre", hex: "#CC7722" },
  { name: "Dijon", hex: "#C49102" },
  { name: "Sunflower", hex: "#FFDA03" },
  { name: "Wheat", hex: "#F5DEB3" },
  // Greens
  { name: "Lime", hex: "#BFFF00" },
  { name: "Chartreuse", hex: "#7FFF00" },
  { name: "Olive", hex: "#808000" },
  { name: "Moss", hex: "#8A9A5B" },
  { name: "Sage", hex: "#9CAF88" },
  { name: "Fern", hex: "#4F7942" },
  { name: "Forest", hex: "#228B22" },
  { name: "Pine", hex: "#01796F" },
  { name: "Emerald", hex: "#50C878" },
  { name: "Jade", hex: "#00A86B" },
  { name: "Mint", hex: "#98FF98" },
  { name: "Seafoam", hex: "#93E9BE" },
  { name: "Kelly", hex: "#4CBB17" },
  { name: "Hunter", hex: "#355E3B" },
  { name: "Evergreen", hex: "#05472A" },
  { name: "Basil", hex: "#579229" },
  { name: "Pistachio", hex: "#93C572" },
  { name: "Avocado", hex: "#568203" },
  { name: "Juniper", hex: "#3A5F4B" },
  { name: "Eucalyptus", hex: "#5F8575" },
  { name: "Shamrock", hex: "#009E60" },
  { name: "Matcha", hex: "#8FBF6A" },
  // Teals & cyans
  { name: "Teal", hex: "#008080" },
  { name: "Aqua", hex: "#00FFFF" },
  { name: "Turquoise", hex: "#40E0D0" },
  { name: "Cyan", hex: "#00B7EB" },
  { name: "Aquamarine", hex: "#7FFFD4" },
  { name: "Lagoon", hex: "#3AAFA9" },
  { name: "Petrol", hex: "#005F6A" },
  { name: "Peacock", hex: "#1B7F8C" },
  { name: "Aurora Teal", hex: "#0F7B6C" },
  { name: "Glacier", hex: "#BDE3E9" },
  { name: "Fjord", hex: "#A9C7C1" },
  // Blues
  { name: "Navy", hex: "#000080" },
  { name: "Midnight", hex: "#0B1B2B" },
  { name: "Cobalt", hex: "#0047AB" },
  { name: "Royal Blue", hex: "#4169E1" },
  { name: "Sapphire", hex: "#0F52BA" },
  { name: "Azure", hex: "#007FFF" },
  { name: "Sky", hex: "#87CEEB" },
  { name: "Baby Blue", hex: "#89CFF0" },
  { name: "Powder", hex: "#B0E0E6" },
  { name: "Cerulean", hex: "#007BA7" },
  { name: "Denim", hex: "#1560BD" },
  { name: "Indigo", hex: "#4B0082" },
  { name: "Ultramarine", hex: "#3F00FF" },
  { name: "Steel", hex: "#4682B4" },
  { name: "Prussian", hex: "#003153" },
  { name: "Ocean", hex: "#0077BE" },
  { name: "Cornflower", hex: "#6495ED" },
  { name: "Periwinkle", hex: "#CCCCFF" },
  { name: "Iceberg", hex: "#71A6D2" },
  { name: "Arctic", hex: "#E6F2FF" },
  { name: "Storm", hex: "#4F666A" },
  { name: "Ink", hex: "#14161A" },
  // Purples
  { name: "Violet", hex: "#8F00FF" },
  { name: "Lavender", hex: "#E6E6FA" },
  { name: "Lilac", hex: "#C8A2C8" },
  { name: "Plum", hex: "#8E4585" },
  { name: "Orchid", hex: "#DA70D6" },
  { name: "Amethyst", hex: "#9966CC" },
  { name: "Grape", hex: "#6F2DA8" },
  { name: "Eggplant", hex: "#614051" },
  { name: "Mauve", hex: "#C9A0DC" },
  { name: "Magenta", hex: "#FF00FF" },
  { name: "Fuchsia", hex: "#C154C1" },
  { name: "Iris", hex: "#5A4FCF" },
  { name: "Mulberry", hex: "#C54B8C" },
  { name: "Aubergine", hex: "#3D0734" },
  { name: "Thistle", hex: "#D8BFD8" },
  { name: "Wisteria", hex: "#B9A5D9" },
  { name: "Byzantium", hex: "#702963" },
  // Pinks
  { name: "Pink", hex: "#FFC0CB" },
  { name: "Hot Pink", hex: "#FF69B4" },
  { name: "Bubblegum", hex: "#FFC1CC" },
  { name: "Flamingo", hex: "#FC8EAC" },
  { name: "Rose", hex: "#E8467C" },
  { name: "Blush", hex: "#DE5D83" },
  { name: "Rose Quartz", hex: "#F7CAC9" },
  { name: "Peony", hex: "#F19CBB" },
  // Browns
  { name: "Chocolate", hex: "#7B3F00" },
  { name: "Coffee", hex: "#6F4E37" },
  { name: "Mocha", hex: "#967969" },
  { name: "Caramel", hex: "#AF6E4D" },
  { name: "Chestnut", hex: "#954535" },
  { name: "Walnut", hex: "#5C4033" },
  { name: "Cinnamon", hex: "#D2691E" },
  { name: "Tan", hex: "#D2B48C" },
  { name: "Taupe", hex: "#8B8589" },
  { name: "Khaki", hex: "#C3B091" },
  { name: "Camel", hex: "#C19A6B" },
  { name: "Sienna", hex: "#A0522D" },
  { name: "Umber", hex: "#635147" },
  { name: "Mahogany", hex: "#C04000" },
  { name: "Espresso", hex: "#3C2218" },
  { name: "Hazelnut", hex: "#B89B7A" },
  { name: "Latte", hex: "#C5A98B" },
  { name: "Beige", hex: "#F5F5DC" },
  { name: "Biscuit", hex: "#D6B98C" },
  { name: "Cocoa", hex: "#4E3629" },
  // Neutrals
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Charcoal", hex: "#36454F" },
  { name: "Graphite", hex: "#3B3B3B" },
  { name: "Slate", hex: "#708090" },
  { name: "Ash", hex: "#B2BEB5" },
  { name: "Stone", hex: "#928E85" },
  { name: "Pewter", hex: "#8E9294" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "Platinum", hex: "#E5E4E2" },
  { name: "Smoke", hex: "#848884" },
  { name: "Dove", hex: "#7C7C7C" },
  { name: "Concrete", hex: "#A8A9AD" },
  { name: "Fog", hex: "#D9D9D9" },
  { name: "Cloud", hex: "#F2F2F2" },
  { name: "Snow", hex: "#F4F1EA" },
  { name: "Ivory", hex: "#FFFFF0" },
  { name: "Bone", hex: "#E3DAC9" },
  { name: "Linen", hex: "#FAF0E6" },
  { name: "Oat", hex: "#D9C5A3" },
  { name: "Alabaster", hex: "#F2F0E6" },
  { name: "Pearl", hex: "#EAE0C8" },
  { name: "Chalk", hex: "#F7F5F0" },
  { name: "Onyx", hex: "#353839" },
  { name: "Jet", hex: "#232323" },
  { name: "Obsidian", hex: "#151515" },
  { name: "Gunmetal", hex: "#2A3439" },
  { name: "Pebble", hex: "#A09F9B" },
  { name: "Greige", hex: "#BAB2A9" },
  { name: "Mushroom", hex: "#A89F91" },
];

const oklabOf = converter("oklab");

const INDEX = COLOR_NAMES.map((n) => {
  const c = oklabOf(n.hex);
  return { name: n.name, hex: n.hex, l: c?.l ?? 0, a: c?.a ?? 0, b: c?.b ?? 0 };
});

/** The nearest designer-friendly name for a hex colour. */
export function nearestColorName(hex: string): string {
  const c = oklabOf(hex);
  if (!c) return "Custom";
  let best = INDEX[0];
  let bestD = Infinity;
  for (const n of INDEX) {
    const d = (n.l - c.l) ** 2 + (n.a - c.a) ** 2 + (n.b - c.b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best.name;
}

/**
 * Names a whole set at once, disambiguating duplicates
 * ("Teal", "Teal 2" → "Teal", "Deep Teal") so a palette reads cleanly.
 */
export function nameColors(hexes: string[]): string[] {
  const names = hexes.map(nearestColorName);
  const seen = new Map<string, number>();
  return names.map((name, i) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    const l = oklabOf(hexes[i])?.l ?? 0.5;
    const first = oklabOf(hexes[names.indexOf(name)])?.l ?? 0.5;
    return l < first ? `Deep ${name}` : `Pale ${name}`;
  });
}
