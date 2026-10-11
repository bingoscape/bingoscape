import { SKILLS } from "@wise-old-man/utils"

export function getMetricName(metric: string): string {
  const customNames: Record<string, string> = {
    chambers_of_xeric_challenge_mode: "Chambers of Xeric (CM)",
    tombs_of_amascut_expert: "Tombs of Amascut (Expert)",
    theatre_of_blood_hard_mode: "Theatre of Blood (HM)",
    bounty_hunter_hunter: "Bounty Hunter (Hunter)",
    bounty_hunter_rogue: "Bounty Hunter (Rogue)",
    clue_scrolls_all: "Clue Scrolls (All)",
    clue_scrolls_beginner: "Clue Scrolls (Beginner)",
    clue_scrolls_easy: "Clue Scrolls (Easy)",
    clue_scrolls_medium: "Clue Scrolls (Medium)",
    clue_scrolls_hard: "Clue Scrolls (Hard)",
    clue_scrolls_elite: "Clue Scrolls (Elite)",
    clue_scrolls_master: "Clue Scrolls (Master)",
    lms_rank: "LMS Rank",
    pvp_arena_rank: "PvP Arena Rank",
    soul_wars_zeal: "Soul Wars Zeal",
    rifts_closed: "Rifts Closed (GotR)",
    abyssal_sire: "Abyssal Sire",
    alchemical_hydra: "Alchemical Hydra",
    barrows_chests: "Barrows Chests",
    bryophyta: "Bryophyta",
    callisto: "Callisto",
    cerberus: "Cerberus",
    chambers_of_xeric: "Chambers of Xeric",
    chaos_elemental: "Chaos Elemental",
    chaos_fanatic: "Chaos Fanatic",
    commander_zilyana: "Commander Zilyana",
    corporeal_beast: "Corporeal Beast",
    crazy_archaeologist: "Crazy Archaeologist",
    dagannoth_prime: "Dagannoth Prime",
    dagannoth_rex: "Dagannoth Rex",
    dagannoth_supreme: "Dagannoth Supreme",
    deranged_archaeologist: "Deranged Archaeologist",
    duke_sucellus: "Duke Sucellus",
    general_graardor: "General Graardor",
    giant_mole: "Giant Mole",
    grotesque_guardians: "Grotesque Guardians",
    hespori: "Hespori",
    kalphite_queen: "Kalphite Queen",
    king_black_dragon: "King Black Dragon",
    kraken: "Kraken",
    kreearra: "Kree'Arra",
    kril_tsutsaroth: "K'ril Tsutsaroth",
    mimic: "Mimic",
    nex: "Nex",
    nightmare: "Nightmare",
    phosanis_nightmare: "Phosani's Nightmare",
    obor: "Obor",
    phantom_muspah: "Phantom Muspah",
    sarachnis: "Sarachnis",
    scorpia: "Scorpia",
    skotizo: "Skotizo",
    spindel: "Spindel",
    tempoross: "Tempoross",
    the_gauntlet: "The Gauntlet",
    the_corrupted_gauntlet: "The Corrupted Gauntlet",
    the_leviathan: "The Leviathan",
    the_whisperer: "The Whisperer",
    theatre_of_blood: "Theatre of Blood",
    thermonuclear_smoke_devil: "Thermonuclear Smoke Devil",
    tombs_of_amascut: "Tombs of Amascut",
    tzkal_zuk: "TzKal-Zuk",
    tztok_jad: "TzTok-Jad",
    venenatis: "Venenatis",
    vetion: "Vet'ion",
    vorkath: "Vorkath",
    wintertodt: "Wintertodt",
    zalcano: "Zalcano",
    zulrah: "Zulrah",
    ehp: "Efficient Hours Played (EHP)",
    ehb: "Efficient Hours Bossing (EHB)",
    league_points: "League Points",
  }

  if (customNames[metric]) return customNames[metric]

  // Fallback: "abyssal_sire" -> "Abyssal Sire"
  return metric
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

export function getWikiIconUrl(metric: string): string {
  // Edge cases for Wiki image names
  const wikiImageMap: Record<string, string> = {
    // Bosses & Raids (usually just the name)
    abyssal_sire: "Abyssal_Sire.png",
    alchemical_hydra: "Alchemical_Hydra.png",
    barrows_chests: "Barrows_icon.png",
    bryophyta: "Bryophyta.png",
    callisto: "Callisto.png",
    cerberus: "Cerberus.png",
    chambers_of_xeric: "Chambers_of_Xeric.png",
    chambers_of_xeric_challenge_mode: "Chambers_of_Xeric.png",
    chaos_elemental: "Chaos_Elemental.png",
    chaos_fanatic: "Chaos_Fanatic.png",
    commander_zilyana: "Commander_Zilyana.png",
    corporeal_beast: "Corporeal_Beast.png",
    crazy_archaeologist: "Crazy_archaeologist.png",
    dagannoth_prime: "Dagannoth_Prime.png",
    dagannoth_rex: "Dagannoth_Rex.png",
    dagannoth_supreme: "Dagannoth_Supreme.png",
    deranged_archaeologist: "Deranged_archaeologist.png",
    duke_sucellus: "Duke_Sucellus.png",
    general_graardor: "General_Graardor.png",
    giant_mole: "Giant_Mole.png",
    grotesque_guardians: "Grotesque_Guardians.png",
    hespori: "Hespori.png",
    kalphite_queen: "Kalphite_Queen.png",
    king_black_dragon: "King_Black_Dragon.png",
    kraken: "Kraken.png",
    kreearra: "Kree'arra.png",
    kril_tsutsaroth: "K'ril_Tsutsaroth.png",
    mimic: "The_Mimic.png",
    nex: "Nex.png",
    nightmare: "The_Nightmare.png",
    phosanis_nightmare: "Phosani's_Nightmare.png",
    obor: "Obor.png",
    phantom_muspah: "Phantom_Muspah.png",
    sarachnis: "Sarachnis.png",
    scorpia: "Scorpia.png",
    skotizo: "Skotizo.png",
    spindel: "Spindel.png",
    tempoross: "Tempoross.png",
    the_gauntlet: "The_Gauntlet.png",
    the_corrupted_gauntlet: "The_Corrupted_Gauntlet.png",
    the_leviathan: "The_Leviathan.png",
    the_whisperer: "The_Whisperer.png",
    theatre_of_blood: "Theatre_of_Blood.png",
    theatre_of_blood_hard_mode: "Theatre_of_Blood.png",
    thermonuclear_smoke_devil: "Thermonuclear_smoke_devil.png",
    tombs_of_amascut: "Tombs_of_Amascut.png",
    tombs_of_amascut_expert: "Tombs_of_Amascut.png",
    tzkal_zuk: "TzKal-Zuk.png",
    tztok_jad: "TzTok-Jad.png",
    venenatis: "Venenatis.png",
    vetion: "Vet'ion.png",
    vorkath: "Vorkath.png",
    wintertodt: "Wintertodt.png",
    zalcano: "Zalcano.png",
    zulrah: "Zulrah.png",

    // Activities
    league_points: "League_Points_icon.png",
    bounty_hunter_hunter: "Bounty_Hunter_icon.png",
    bounty_hunter_rogue: "Bounty_Hunter_icon.png",
    clue_scrolls_all: "Clue_scroll_(all)_icon.png",
    clue_scrolls_beginner: "Clue_scroll_(beginner)_icon.png",
    clue_scrolls_easy: "Clue_scroll_(easy)_icon.png",
    clue_scrolls_medium: "Clue_scroll_(medium)_icon.png",
    clue_scrolls_hard: "Clue_scroll_(hard)_icon.png",
    clue_scrolls_elite: "Clue_scroll_(elite)_icon.png",
    clue_scrolls_master: "Clue_scroll_(master)_icon.png",
    lms_rank: "Last_Man_Standing_icon.png",
    pvp_arena_rank: "PvP_Arena_icon.png",
    soul_wars_zeal: "Soul_Wars_icon.png",
    rifts_closed: "Guardians_of_the_Rift_icon.png",

    // EHP/EHB (Use general icons)
    ehp: "Stats_icon.png",
    ehb: "Combat_icon.png",
    overall: "Stats_icon.png",
  }

  if (wikiImageMap[metric]) {
    return `https://oldschool.runescape.wiki/images/${wikiImageMap[metric]}`
  }

  // Auto-resolve skills (e.g., woodcutting -> Woodcutting_icon.png)
  if ((SKILLS as readonly string[]).includes(metric)) {
    const capitalized = metric.charAt(0).toUpperCase() + metric.slice(1)
    return `https://oldschool.runescape.wiki/images/${capitalized}_icon.png`
  }

  // Fallback string manipulation
  const pretty = metric
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("_")

  return `https://oldschool.runescape.wiki/images/${pretty}.png`
}

/** User-facing name of the "metric" goal type (skills, bosses, activities). */
export const METRIC_GOAL_LABEL = "XP / Kills"

/** Total XP needed for level 99 in any skill. */
export const LEVEL_99_XP = 13_034_431

export interface MetricTargetPreset {
  label: string
  value: number
}

export interface MetricTargetCopy {
  /** Label of the type select option, e.g. "Skill (XP)". */
  typeOption: string
  /** Label of the select that picks the skill, boss or activity. */
  nameLabel: string
  namePlaceholder: string
  /** Label of the target field: "XP to gain", "Kills" or "Score". */
  targetLabel: string
  targetPlaceholder: string
  /** Unit shown in the "= 500,000 XP" preview. */
  unit: string
  unitSingular: string
  /** Short badge for a metric goal row. */
  badge: string
  helper: string
  presets: readonly MetricTargetPreset[]
}

const SKILL_PRESETS: readonly MetricTargetPreset[] = [
  { label: "100K", value: 100_000 },
  { label: "500K", value: 500_000 },
  { label: "1M", value: 1_000_000 },
  { label: "5M", value: 5_000_000 },
  { label: "Level 99 (13,034,431 XP)", value: LEVEL_99_XP },
]

const BOSS_PRESETS: readonly MetricTargetPreset[] = [5, 10, 25, 50, 100].map(
  (value) => ({ label: String(value), value })
)

const SKILL_COPY: MetricTargetCopy = {
  typeOption: "Skill (XP)",
  nameLabel: "Skill",
  namePlaceholder: "Select a skill",
  targetLabel: "XP to gain",
  targetPlaceholder: "e.g. 500k or 1m",
  unit: "XP",
  unitSingular: "XP",
  badge: "XP",
  helper:
    "Counts XP gained by the team during the event window (via Wise Old Man).",
  presets: SKILL_PRESETS,
}

const BOSS_COPY: MetricTargetCopy = {
  typeOption: "Boss (kills)",
  nameLabel: "Boss",
  namePlaceholder: "Select a boss",
  targetLabel: "Kills",
  targetPlaceholder: "e.g. 25",
  unit: "kills",
  unitSingular: "kill",
  badge: "Kills",
  helper:
    "Counts kills by the team during the event window (via Wise Old Man).",
  presets: BOSS_PRESETS,
}

const ACTIVITY_COPY: MetricTargetCopy = {
  typeOption: "Activity (score)",
  nameLabel: "Activity",
  namePlaceholder: "Select an activity",
  targetLabel: "Score",
  targetPlaceholder: "e.g. 10",
  unit: "",
  unitSingular: "",
  badge: "Activity",
  helper:
    "Counts the score gained by the team during the event window (via Wise Old Man).",
  presets: [],
}

/** Labels, presets and helper text for the target of a metric goal. */
export function getMetricTargetCopy(metricType: string): MetricTargetCopy {
  if (metricType === "boss") return BOSS_COPY
  if (metricType === "activity") return ACTIVITY_COPY
  return SKILL_COPY
}
