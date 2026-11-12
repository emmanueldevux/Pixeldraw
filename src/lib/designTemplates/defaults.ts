// ============================================================
// UXLLY — Built-in design templates (seeded once into the database)
// After seeding, admins edit them in /admin → Templates; this file is
// only the starting point.
// ============================================================

import type { DesignTemplate } from "./types";

type Seed = Omit<DesignTemplate, "id" | "usageCount" | "kind" | "refImages" | "packDna" | "refDnas">;

export const TEMPLATE_1: Seed = {
  number: 1,
  title: "Product campaign ad (9:16)",
  description:
    "Upload a photo of your packaged product and get a finished, scroll-stopping vertical campaign ad. The AI art director picks the best of nine proven ad styles for your product and keeps your pack exactly as it is.",
  category: "Product ads",
  tags: ["vertical-ad", "packaging-accurate", "product-reproduction", "lifestyle-ads", "scroll-stopping", "brand-campaign", "mobile-first"],
  aspect: "9:16",
  coverImages: [],
  needsProduct: true,
  useBrandBrain: true,
  published: true,
  sortOrder: 1,
  prompt: `You are a senior art director at a top creative agency. Look at [[Product Description]] and turn it into one finished, scroll-stopping 9:16 vertical brand-campaign ad. Do not explain anything, just generate the image.

STEP 1: READ THE PRODUCT
Silently identify the brand name, product name, product type, flavour or variant, pack shape, pack colours, logo style and every word printed on the pack. Note which [[Claims]].

STEP 2: KEEP THE PACK EXACT
Reproduce the product exactly as in the uploaded image: [[Pack Shape]], spelled correctly. Do not redesign, simplify, translate or add anything to the packaging. The label must be sharp and readable.

STEP 3: PICK THE BEST AD STYLE FOR THIS PRODUCT
[[STYLES]]

STEP 4: BUILD THE AD AROUND THE BRAND
- Colour palette: [[BRAND_COLOURS]]. The product must stand out clearly from the background.
- Props: only real ingredients, flavours or objects that belong to this product (the fruit in the flavour name, coffee beans for coffee, pearls and water for marine collagen). Fresh, glossy, photoreal, some floating at different depths with soft shadows.
- Headline: [[Headline]], readable at phone size. Use the product name, flavour, or a claim printed on the pack.
- Callouts and icons: ONLY use claims, numbers and ingredients that are printed on the pack. Never invent health benefits, specs, percentages, awards or prices.
- Typography: modern and premium, maximum two typefaces, clear hierarchy, plenty of breathing room, every word spelled correctly. No text touches the frame edges.

STEP 5: FINISH
Photoreal commercial product photography quality, lighting that suits the chosen style, realistic shadows and reflections, crisp detail on the pack, rich colour, clean composition built for a 9:16 Instagram or Meta ad. No watermark, no extra logos, no text other than what you placed deliberately.`,
  params: [
    {
      key: "Product Description",
      defaultValue: "the product in the uploaded image",
      userEditable: true,
      userLabel: "What is the product? (optional)",
      userPlaceholder: "e.g. Zobo hibiscus drink, 50cl bottle",
      wrap: "the product in the uploaded image ({value})",
    },
    {
      key: "Claims",
      defaultValue: 'claims are actually printed on it (for example SPF, protein grams, "no added sugar", quantity, key ingredient)',
      userEditable: true,
      userLabel: "Claims printed on the pack (optional)",
      userPlaceholder: "e.g. No added sugar, 50cl, Vitamin C",
      wrap: "claims are printed on it; the owner confirms these: {value}",
    },
    {
      key: "Pack Shape",
      defaultValue: "same shape, proportions, materials, colours, logo, fonts, label layout and every word on the pack",
      userEditable: false,
      userLabel: "",
      userPlaceholder: "",
      wrap: "",
    },
    {
      key: "Headline",
      defaultValue: "short, clever, 2 to 6 words, written in the brand's tone",
      userEditable: true,
      userLabel: "Headline (optional)",
      userPlaceholder: "Leave empty and the AI writes one",
      wrap: 'exactly "{value}"',
    },
  ],
  styles: [
    {
      key: "A",
      name: "COLOUR-BLOCK ARC",
      description:
        "a tall curved panel in the brand's deepest colour bleeding off one side, carrying one giant cropped vertical word; a stacked condensed headline on the other side with one line in the accent colour; a thin divider, three spaced-out spec lines and a column of three thin line-icons with labels.",
      bestFor: "drinks, juices, sodas, packaged food",
    },
    {
      key: "B",
      name: "FLUFFY 3D DREAM",
      description: "the product held by a giant soft furry paw or resting on plush fur, with puffy 3D fur-textured headline letters and fluffy clouds on a pastel background.",
      bestFor: "beauty, lip, kids, cute or playful products",
    },
    {
      key: "C",
      name: "SKY FLOAT",
      description: "the product floating in a bright blue sky with wispy clouds, shot from slightly below in real sunlight, with a two-line headline below and three thin white icons with short captions.",
      bestFor: "skincare, toners, water, fresh or clean products",
    },
    {
      key: "D",
      name: "BIG NUMBER POUR",
      description:
        "a huge number from the pack (count, grams, percentage) in a bright accent colour, a short three-line statement with one highlighted line, and the product tilted with its contents pouring or tumbling beside it in a frozen moment.",
      bestFor: "gummies, supplements, snacks, anything with a hero number",
    },
    {
      key: "E",
      name: "EXPLODED LAYERS",
      description: "the food item split into floating horizontal layers in a vertical stack, each layer labelled with a callout line, the pack floating below, on a vivid sky or solid background.",
      bestFor: "bars, wafers, sandwiches, layered food",
    },
    {
      key: "F",
      name: "EDITORIAL FLAT LAY",
      description:
        "three identical packs in a diagonal zigzag on a cream surface shot from above, a thin elegant headline at the top, four callouts with curved thin lines, and a few loose units (tablets, capsules) beside the packs.",
      bestFor: "supplements, vitamins, wellness",
    },
    {
      key: "G",
      name: "HAND AND BOWL HOOK",
      description:
        'a manicured hand lifting one pack from the top of the frame, more packs nestled in a ribbed glass bowl piled with the product\'s real ingredient, a big question headline with the last words in a bright italic accent, and a circle-arrow with "swipe to see" text.',
      bestFor: "flavoured drinks and cans",
    },
    {
      key: "H",
      name: "MONOCHROME FLOAT",
      description:
        "a single-colour backdrop pulled from the pack, a giant tone-on-tone word behind the product, a small spaced-out category line on top, and the real ingredients and leaves floating around the product with condensation or dew.",
      bestFor: "premium drinks, bottles, fragrances",
    },
    {
      key: "I",
      name: "HERO SPLASH OR ELEMENT",
      description:
        "the product in its natural element at peak drama (liquid crown splash, water surface with ripples, sun, ice, crumbs bursting) with a giant tone-on-tone word behind and a short two-line headline.",
      bestFor: "tech, coffee, chocolate, anything that needs energy",
    },
  ],
};


export const TEMPLATE_2: Seed = {
  number: 2,
  title: "Premium campaign poster (4:5)",
  description:
    "Turn your product photo into a premium, photorealistic campaign poster for Instagram and Facebook feeds. Six art directions, from steamy food scenes and refreshing splashes to luxury still life, action sports and dramatic studio hero shots.",
  category: "Product ads",
  tags: ["feed-ad", "4:5", "premium", "photoreal", "campaign-poster", "product-hero", "luxury"],
  aspect: "4:5",
  coverImages: [],
  needsProduct: true,
  useBrandBrain: true,
  published: true,
  sortOrder: 2,
  prompt: `Create a premium, photorealistic commercial advertising poster for [[Product Description]]. Exact canvas: Instagram portrait 4:5, full-bleed finished ad. The image will be trimmed to 4:5, so keep every word and the whole product inside the central 4:5 area and leave the top and bottom edges as quiet background.

STEP 1: READ THE PRODUCT
Silently identify the brand name, product name, product type, variant, pack or product shape, colours, logo style and every word printed on it.

HERO PRODUCT:
Reproduce the product exactly as in the uploaded image: same shape, proportions, materials, colours, logo, fonts, label layout and every printed word, spelled correctly. Do not redesign, simplify, translate or add anything to it. It must be crisp, realistic, physically grounded and the unmistakable hero of the poster.

ART DIRECTION:
[[STYLES]]

COLOUR:
Background, light glows, panels and headline accents: [[BRAND_COLOURS]]. The product must stand out clearly from the background.

TYPOGRAPHY:
- Headline: [[Headline]]. Set it in clean premium type, with the one key word emphasised in an expressive accent (brush, script or a bold colour change) exactly as the chosen art direction describes.
- Supporting line: [[Supporting Line]].
- Feature callouts: [[Features]]. Use small elegant line icons beside them where the art direction calls for a feature stack or feature row.
- Maximum two typefaces plus one expressive accent style, clear hierarchy, generous negative space, every word spelled correctly, no text touching the frame edges. Only use claims, numbers and ingredients that are printed on the product or given above. Never invent health benefits, specs, percentages, awards or prices.

STYLE:
Luxury commercial advertising photography, award-winning campaign quality, photorealistic textures, realistic skin and hair where people appear, cinematic contrast, controlled highlights, premium retouching, subtle depth of field, natural shadows and reflections, no clutter.

IMPORTANT:
No random objects, no extra products or packs unless the art direction asks for them, no distorted hands or bodies, no warped packaging, no distorted logo, no gibberish or unreadable text, no cartoon or 3D-render look, no plastic-looking food or liquids, no excessive effects, glow or lens flare. Keep the design clean, intentional and believable, like a real professional campaign. Output only the finished poster.`,
  params: [
    {
      key: "Product Description",
      defaultValue: "the product in the uploaded image",
      userEditable: true,
      userLabel: "What is the product? (optional)",
      userPlaceholder: "e.g. Spicy jollof seasoning, 100g sachet",
      wrap: "the product in the uploaded image ({value})",
    },
    {
      key: "Headline",
      defaultValue: "a short, premium headline of 3 to 6 words written in the brand's tone, with one key word to emphasise",
      userEditable: true,
      userLabel: "Headline (optional)",
      userPlaceholder: "Leave empty and the AI writes one",
      wrap: 'exactly "{value}"',
    },
    {
      key: "Supporting Line",
      defaultValue: 'one short supporting line in the brand\'s tone; a three-beat rhythm such as "CRUNCHY. CREAMY. IRRESISTIBLE." works well, built only from qualities that are true for this product',
      userEditable: true,
      userLabel: "Supporting line (optional)",
      userPlaceholder: "e.g. Bold. Smoky. Proudly Nigerian.",
      wrap: 'exactly "{value}"',
    },
    {
      key: "Features",
      defaultValue: "up to three short feature labels, taken only from claims printed on the product",
      userEditable: true,
      userLabel: "Features to show (optional)",
      userPlaceholder: "e.g. No MSG, Ready in 5 minutes, Family pack",
      wrap: "these exact labels: {value}",
    },
  ],
  styles: [
    {
      key: "A",
      name: "STEAMY APPETITE SCENE",
      description:
        "a warm, energetic scene in a rich, deep version of the brand colour, with cinematic restaurant-style lighting, glowing highlights and realistic steam. The product sits large and front-facing in the lower-centre/right foreground on a dark wooden serving surface. A steaming bowl or plate of the prepared food sits in the lower-left foreground with visible texture, plus a few real ingredients naturally scattered. Behind the product, a person enjoys the food with eyes gently closed in genuine satisfaction, softly out of focus (shallow depth of field). Hierarchy: product first, food second, person third. Bold hand-painted brush headline in the upper-right with the key word in the accent colour, a small circular badge on the right, and a small bottom-right callout with a hand-drawn arrow.",
      bestFor: "instant food, noodles, snacks, sauces, spices, seasonings, restaurant dishes",
    },
    {
      key: "B",
      name: "REFRESHMENT IN MOTION",
      description:
        "a crisp, high-key studio scene on a bright cool-white or light-grey background with a soft gradient. One cold product, tilted diagonally from lower-left to upper-right, floats in the centre, sharply focused and covered in realistic condensation droplets. Dynamic arcs and splashes of crystal-clear water surround it with individual droplets, refraction and motion, plus one subtle ribbon of the drink's own colour behind it for contrast. An oversized, cropped brand word sits in the background, partly hidden behind the product and water. Headline top-left with its last word in the accent colour, the supporting line bottom-right, a short sign-off bottom-centre. The water frames the product and never covers the label. No hands, no fruit, no ice unless needed.",
      bestFor: "canned and bottled drinks, sodas, water, energy drinks, juices",
    },
    {
      key: "C",
      name: "INDULGENT SPLASH",
      description:
        "a rich, indulgent world on a deep background in the brand's deepest colour with a subtle vignette and dramatic studio lighting. The product sits large and diagonal in the centre-right foreground, opened so the product inside is visible (glossy pieces, a freshly broken edge, real texture). Elegant arcs of the product's own melted or liquid form flow behind and around it, with a few crumbs and real ingredient pieces suspended mid-air for motion. Clean negative space on the left holds the headline in a clean sans-serif combined with expressive brush lettering, the key phrase in warm gold or the accent colour, plus a left-side feature stack with small elegant icons. Bottom: the three-beat supporting line and a small signature-style line.",
      bestFor: "chocolate, sweets, desserts, ice cream, spreads, coffee",
    },
    {
      key: "D",
      name: "LUXURY BOTANICAL STILL LIFE",
      description:
        "a warm, sophisticated still life against a soft beige or cream plaster wall with subtle natural texture, warm directional sunlight from the upper-right and delicate botanical shadows. The product stands upright on the right on a pale stone pedestal with a gentle glow. One large fresh flower or real ingredient that belongs to the product rests in the lower-left foreground with a few deep-green leaves; softly blurred blooms and stems frame the upper-right corner. The left side stays quiet and spacious: brand name in elegant, widely spaced high-fashion serif, the product name below in refined serif and small uppercase, then the three-word line lower-left with a thin gold divider and small copy. Minimal, restrained, editorial.",
      bestFor: "fragrance, skincare, cosmetics, candles, jewellery, premium bottles",
    },
    {
      key: "E",
      name: "ACTION PERFORMANCE",
      description:
        "a dynamic close-up of the product in use in a dark urban or modern concrete environment, shot from an extreme low angle as it moves toward the camera so its key details are highly visible. Only the relevant part of a person appears, mid-motion, with realistic anatomy and natural fabric folds. A dramatic diagonal opening of light in the background, wet or slightly reflective ground catching the silhouette, strong rim light from the upper-right, deep shadows and crisp highlights. Upper-left: a large stacked headline in bold white condensed sans-serif with one word in energetic accent-colour brush lettering. Lower-left: the supporting copy. Along the bottom: three small feature icons with labels.",
      bestFor: "sportswear, shoes, fitness gear, gadgets, tools, outdoor products",
    },
    {
      key: "F",
      name: "DRAMATIC STUDIO HERO",
      description:
        "a dramatic black-to-charcoal studio or industrial environment with controlled warm light streaks entering from the left. The product dominates the lower half in a powerful low three-quarter view, slightly facing the viewer, on a polished dark floor with realistic reflections beneath it. Behind it, an enormous subtle tone-on-tone product name or number fills the upper-middle background with one spaced uppercase word across it, always behind the product. Top-left: a small uppercase line with a thin gold line beneath. Bottom-left: the headline, a thin divider and one or two sentences of premium copy. Along the bottom: three short specification lines. Restrained black palette with one accent.",
      bestFor: "cars, electronics, watches, appliances, premium tech, machinery",
    },
  ],
};

export const TEMPLATE_3: Seed = {
  number: 3,
  title: "Ingredient-world benefit poster (4:5)",
  description:
    "A clean, ultra-premium product poster: your product as the hero, surrounded by a world built from its key ingredient or benefit, with a bold stacked headline and benefit icons written from your brand. Six looks, from fresh fruit splash and icy cool to golden liquid, futuristic gel, candy burst and road at dusk.",
  category: "Product ads",
  tags: ["feed-ad", "4:5", "fmcg", "beauty", "benefit-icons", "ingredient-world", "premium"],
  aspect: "4:5",
  coverImages: [],
  needsProduct: true,
  useBrandBrain: true,
  published: true,
  sortOrder: 3,
  prompt: `Create an ultra-premium advertising poster for [[Product Description]]. Exact canvas: Instagram portrait 4:5, full-bleed finished ad. The image will be trimmed to 4:5, so keep every word and the whole product inside the central 4:5 area and leave the top and bottom edges as quiet background.

STEP 1: READ THE PRODUCT
Silently identify the brand name, product name, product type, variant, shape, colours, logo and every word printed on it, and its key ingredient or main benefit.

HERO PRODUCT:
Reproduce the product exactly as in the uploaded image: same shape, proportions, materials, colours, logo, fonts, label layout and every printed word, spelled correctly. Do not redesign, simplify, translate or add anything to it. Show it large, centre or centre-right, from a slightly low angle, label sharp and readable, physically grounded with real shadows and reflections.

ART DIRECTION:
[[STYLES]]
Build the world around the product from its own key ingredient or benefit, never from unrelated props.

LAYOUT SYSTEM:
- Top-left: a bold headline stacked in 2 to 3 short lines: [[Headline]]. Set the last line or the key word in the accent colour. Directly under it, one small subtext line: [[Subtext]].
- Benefits: [[Benefits]]. Show them the way the art direction describes: either a left-side column of 3 to 4 items, each with a small round line icon, a bold 2-4 word label and a short sub-line; or a bottom row of 3 icon features separated by thin vertical dividers.
- Brand: the brand name or logo exactly as printed on the product, small, top-right or bottom-centre. Never invent a new logo.
- An optional small round seal with one short phrase, only if it is supported by the brand context or the pack.

COLOUR:
[[BRAND_COLOURS]]. Keep the whole poster in one harmonious colour family with one accent; the product must stand out clearly from the background.

FINISH:
Ultra-premium commercial advertising campaign, award-winning Behance-style commercial design, Photoshop-quality compositing, cinematic product photography, ultra-realistic product and ingredient photography, premium editorial branding, ultra high detail, hyper-realistic, photorealistic, commercial advertising quality, luxury visual storytelling, magazine-cover aesthetics, world-class creative direction, premium colour grading.

IMPORTANT:
Every word spelled correctly, maximum two typefaces, clear hierarchy, generous breathing room, no text touching the frame edges. Numbers, percentages, durations and claims only if they are printed on the product or given in the brand context; never invent health benefits, specs, awards, rankings or prices. No random objects, no extra products unless the art direction asks for loose pieces, no warped packaging, no distorted logo, no gibberish text, no cartoon or 3D-render look, no clutter. Output only the finished poster.`,
  params: [
    {
      key: "Product Description",
      defaultValue: "the product in the uploaded image",
      userEditable: true,
      userLabel: "What is the product? (optional)",
      userPlaceholder: "e.g. Shea butter body lotion with vitamin E, 400ml",
      wrap: "the product in the uploaded image ({value})",
    },
    {
      key: "Headline",
      defaultValue:
        'written by you from the brand context in the brand\'s voice, 2 to 3 very short lines with a rhythm like "Nourish. Hydrate. Glow Naturally." or "Chewy. Cool. Irresistible."',
      userEditable: true,
      userLabel: "Headline (optional)",
      userPlaceholder: "Leave empty and the AI writes one from your brand",
      wrap: 'exactly "{value}" (split into 2-3 lines)',
    },
    {
      key: "Subtext",
      defaultValue: "one short line written from the brand's promise or the product's main selling point",
      userEditable: true,
      userLabel: "Subtext (optional)",
      userPlaceholder: "e.g. Powered by the goodness of real shea",
      wrap: 'exactly "{value}"',
    },
    {
      key: "Benefits",
      defaultValue:
        "three or four benefits written by you from the brand context (the product's true selling points, the brand's promise and what customers care about) and from what the pack shows; each a bold 2-4 word label with a 3-6 word sub-line",
      userEditable: true,
      userLabel: "Benefits (optional)",
      userPlaceholder: "Leave empty and the AI writes them from your brand",
      wrap: "these exact benefits: {value}",
    },
  ],
  styles: [
    {
      key: "A",
      name: "FRESH FRUIT SPLASH",
      description:
        "a soft monochrome backdrop in a light tint of the brand colour; the product stands tall on a low round plinth with a second plinth beside it. The real fruit or botanical from the product sits at its base and in the foreground, whole and halved, glossy and dewy, with a crisp water splash and flying droplets; a few fresh leaves frame the upper-right. Soft daylight, gentle shadows, fresh and clean. Headline top-left on the open background; benefits as a small subtext under the headline.",
      bestFor: "body lotion, skincare, juices, natural and fruit-based products",
    },
    {
      key: "B",
      name: "ICY COOL",
      description:
        "a deep icy-blue scene; the product sits centre on a bed of crushed ice and frost, with large clear ice cubes flying around it, fresh mint leaves, water spray, condensation and cold mist, cool rim light. A huge number from the pack (temperature, percentage or count) can lead the headline top-left. Bottom: a row of 3 icon features separated by thin dividers.",
      bestFor: "body wash, menthol and cooling products, mouthwash, deodorant, cold drinks",
    },
    {
      key: "C",
      name: "GOLDEN LIQUID",
      description:
        "a warm gold and amber monochrome world; flowing ribbons and swirls of the product's own liquid (oil, honey, serum) wrap around the product with glowing droplets and bubbles suspended in the air. The product stands centred; a refined serif headline is centred at the top with a small spaced uppercase line above it; a left-side column of 3 benefits with thin round line icons; brand small at the bottom centre. Luxurious glow and glossy highlights.",
      bestFor: "hair oil, serums, honey, premium oils, shampoo, luxury liquids",
    },
    {
      key: "D",
      name: "FUTURISTIC GEL",
      description:
        "a deep, rich gradient studio in the brand colour; the product stands tall with a metallic sheen, slightly angled, in front of a glossy translucent swirl of its own gel or cream texture with tiny bubbles. One clean related object (an applicator, a clear accessory) rests on a reflective glossy floor. Elegant serif headline top-left in three lines with the last line in a lighter accent, a short paragraph, a left-side column of 4 benefits with round icons, a round seal on the right, and a bottom row of 3-4 short proof points with thin dividers.",
      bestFor: "oral care, clinical skincare, supplements, beauty tech, devices",
    },
    {
      key: "E",
      name: "CANDY BURST",
      description:
        "an energetic deep scene in the brand colour with light rays from the top; the pack is big and tilted in the centre, with loose pieces of the product, ice cubes, splashing water droplets and fresh leaves flying around it at different depths with motion. Extra-bold condensed stacked headline top-left with a small coloured tagline, a bold ribbon badge lower-right, and a bottom row of 3 icon features.",
      bestFor: "sweets, mints, gum, snacks, soft drinks, energy drinks",
    },
    {
      key: "F",
      name: "ROAD AT DUSK",
      description:
        "a cinematic dusk scene in purple and navy: a modern city skyline, sweeping architecture and a wet, reflective road with light trails curving into the distance. The product is huge in the foreground at a low angle, crisp and rim-lit. Clean headline top-left mixing a light weight and a bold weight, a subtext line and a short sentence; a left-side column of 4 benefits with small round icons; bottom-left a two-line slogan, bottom-right a row of 3 small line icons.",
      bestFor: "tyres, car care, auto parts, phones, electronics, outdoor gear",
    },
  ],
};

export const BUILT_IN_TEMPLATES: Seed[] = [TEMPLATE_1, TEMPLATE_2, TEMPLATE_3];

/** One-time upgrade for a Template 1 that was saved before brand colours existed. */
export const TEMPLATE_1_OLD_COLOUR_LINE = "- Colour palette: taken from the pack itself. Use [[Pack Colours]].";
export const TEMPLATE_1_NEW_COLOUR_LINE = "- Colour palette: [[BRAND_COLOURS]].";
