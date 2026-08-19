import type { DirectorStyle } from "@/lib/directors-types";

export const DIRECTORS_CATALOG: DirectorStyle[] = [
  {
    id: "nolan",
    name: { ar: "Christopher Nolan", en: "Christopher Nolan" },
    tagline: { ar: "IMAX · زمن · واقعية", en: "IMAX · time · grounded scale" },
    gradient: "from-slate-700/90 to-black",
    look: {
      ar: "إضاءة طبيعية قوية، عدسة واسعة IMAX، عمق ميدان ضحل، حبيبات فيلم خفيفة، حركة كamera handheld واقعية",
      en: "Natural high-contrast light, IMAX wide lens, shallow depth of field, subtle film grain, grounded handheld camera",
    },
  },
  {
    id: "villeneuve",
    name: { ar: "Denis Villeneuve", en: "Denis Villeneuve" },
    tagline: { ar: "جو · صمت · اتساع", en: "Atmosphere · silence · scale" },
    gradient: "from-amber-900/80 to-stone-950",
    look: {
      ar: "ألوان باهتة، ضباب وغبار، لقطات جوية واسعة، إضاءة جانبية ناعمة، إيقاع بطيء",
      en: "Desaturated palette, haze and dust, vast aerial frames, soft sidelight, slow pacing",
    },
  },
  {
    id: "spielberg",
    name: { ar: "Steven Spielberg", en: "Steven Spielberg" },
    tagline: { ar: "دفء · عاطفة · كلاسيك", en: "Warmth · emotion · classic" },
    gradient: "from-amber-600/80 to-orange-950",
    look: {
      ar: "إضاءة دافئة، عدسة 35mm، backlit glow، لحظة إنسانية واضحة، حركة كamera سلسة للأمام",
      en: "Warm backlight, 35mm lens, human moment in frame, smooth dolly-in, classic blockbuster framing",
    },
  },
  {
    id: "tarantino",
    name: { ar: "Quentin Tarantino", en: "Quentin Tarantino" },
    tagline: { ar: "ألوان · retro · إيقاع", en: "Color · retro · punchy rhythm" },
    gradient: "from-red-700/85 to-yellow-950",
    look: {
      ar: "ألوان مشبعة، إطار ثابت درامي، حوار في المقدمة، موسيقى retro، زاوية منخفضة",
      en: "Saturated colors, bold static framing, dialogue-forward scene, retro soundtrack mood, low angle",
    },
  },
  {
    id: "wes-anderson",
    name: { ar: "Wes Anderson", en: "Wes Anderson" },
    tagline: { ar: "تناظر · pastel · سرد", en: "Symmetry · pastel · storybook" },
    gradient: "from-pink-500/70 to-sky-900",
    look: {
      ar: "تكوين متناظر، ألوان pastel، حركة lateral tracking، إطار مركزي، أسلوب storybook",
      en: "Perfect symmetry, pastel palette, lateral tracking shot, centered composition, storybook style",
    },
  },
  {
    id: "kubrick",
    name: { ar: "Stanley Kubrick", en: "Stanley Kubrick" },
    tagline: { ar: "دقة · one-point · برود", en: "Precision · one-point · cold" },
    gradient: "from-zinc-600/90 to-black",
    look: {
      ar: "one-point perspective، إضاءة باردة، إطار هندسي دقيق، صمت بصري، عدسة wide ثابتة",
      en: "One-point perspective, cold clinical lighting, geometric frame, visual silence, wide static lens",
    },
  },
  {
    id: "miyazaki",
    name: { ar: "Hayao Miyazaki", en: "Hayao Miyazaki" },
    tagline: { ar: "أنime · سحر · طبيعة", en: "Anime · wonder · nature" },
    gradient: "from-emerald-500/75 to-teal-950",
    look: {
      ar: "أنime سينمائي، سماء غنية بالغيوم، حركة عضوية، ألوان مائية، شعور بالسحر والطفولة",
      en: "Cinematic anime, painterly clouds, organic motion, watercolor tones, wonder and nature",
    },
  },
  {
    id: "fincher",
    name: { ar: "David Fincher", en: "David Fincher" },
    tagline: { ar: "داكن · دقيق · thriller", en: "Dark · precise · thriller" },
    gradient: "from-green-950/90 to-black",
    look: {
      ar: "إضاءة low-key خضراء، تباين عالٍ، حركة كamera متحكم بها، جو thriller، تفاصيل دقيقة",
      en: "Green-tinted low-key light, high contrast, controlled camera move, thriller mood, crisp detail",
    },
  },
  {
    id: "wong-kar-wai",
    name: { ar: "Wong Kar-wai", en: "Wong Kar-wai" },
    tagline: { ar: "حب · step-print · نيون", en: "Romance · step-print · neon" },
    gradient: "from-fuchsia-700/80 to-indigo-950",
    look: {
      ar: "أضواء نيون، step-print motion blur، إطار ضيق، ألوان حمراء وخضراء، حنين وعزلة",
      en: "Neon lights, step-print motion blur, tight framing, red-green palette, melancholy romance",
    },
  },
  {
    id: "gerwig",
    name: { ar: "Greta Gerwig", en: "Greta Gerwig" },
    tagline: { ar: "حيوية · pastel · حديث", en: "Vibrant · pastel · modern" },
    gradient: "from-pink-400/80 to-rose-950",
    look: {
      ar: "ألوان زاهية، إضاءة ناعمة، حركة handheld خفيفة، طاقة شبابية، إطار قريب من الشخصيات",
      en: "Bright pastel tones, soft daylight, light handheld energy, youthful framing, close character focus",
    },
  },
];
