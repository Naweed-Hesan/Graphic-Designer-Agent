import type { Archetype } from "./schema";

export const ARCHETYPES: { id: Exclude<Archetype, "">; name: string; drive: string; voice: string; examples: string; colors: string }[] = [
  { id: "innocent", name: "The Innocent", drive: "Safety, optimism, simplicity", voice: "Honest, warm, hopeful", examples: "Dove, Coca-Cola", colors: "Soft pastels, white, sky blue" },
  { id: "everyman", name: "The Everyman", drive: "Belonging, connection", voice: "Friendly, humble, down-to-earth", examples: "IKEA, Levi's", colors: "Earthy neutrals, denim blues" },
  { id: "hero", name: "The Hero", drive: "Mastery, courage, achievement", voice: "Bold, confident, motivating", examples: "Nike, FedEx", colors: "Strong reds, black, high contrast" },
  { id: "outlaw", name: "The Outlaw", drive: "Liberation, disruption", voice: "Rebellious, raw, provocative", examples: "Harley-Davidson, Diesel", colors: "Black, acid brights, distressed" },
  { id: "explorer", name: "The Explorer", drive: "Freedom, discovery", voice: "Adventurous, independent", examples: "Patagonia, Jeep", colors: "Forest greens, sand, sky" },
  { id: "creator", name: "The Creator", drive: "Innovation, self-expression", voice: "Imaginative, inspiring, articulate", examples: "Adobe, LEGO", colors: "Vivid primaries, expressive palettes" },
  { id: "ruler", name: "The Ruler", drive: "Control, order, prestige", voice: "Authoritative, refined, assured", examples: "Rolex, Mercedes-Benz", colors: "Black, gold, deep navy" },
  { id: "magician", name: "The Magician", drive: "Transformation, vision", voice: "Visionary, charismatic, mysterious", examples: "Disney, Dyson", colors: "Deep purples, iridescents" },
  { id: "lover", name: "The Lover", drive: "Intimacy, pleasure, beauty", voice: "Sensual, passionate, elegant", examples: "Chanel, Godiva", colors: "Reds, rose, burgundy, cream" },
  { id: "caregiver", name: "The Caregiver", drive: "Service, protection", voice: "Compassionate, reassuring, generous", examples: "Johnson & Johnson, UNICEF", colors: "Soft blues, greens, warm neutrals" },
  { id: "jester", name: "The Jester", drive: "Joy, play, living in the moment", voice: "Witty, playful, irreverent", examples: "Old Spice, M&M's", colors: "Bright, saturated, unexpected combos" },
  { id: "sage", name: "The Sage", drive: "Truth, understanding", voice: "Thoughtful, precise, credible", examples: "Google, BBC", colors: "Blues, greys, restrained accents" },
];

export const PERSONALITY_AXES: { id: string; left: string; right: string }[] = [
  { id: "playful-serious", left: "Playful", right: "Serious" },
  { id: "friendly-authoritative", left: "Friendly", right: "Authoritative" },
  { id: "classic-modern", left: "Classic", right: "Modern" },
  { id: "minimal-expressive", left: "Minimal", right: "Expressive" },
  { id: "accessible-premium", left: "Accessible", right: "Premium" },
  { id: "calm-energetic", left: "Calm", right: "Energetic" },
];
