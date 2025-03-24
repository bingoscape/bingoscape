// OSRS Code Phrase Generator
// Generates random phrases in the format "adjective-noun-creature"

// Lists of OSRS-themed words
const adjectives = [
  // Combat-related
  "mighty", "fierce", "savage", "brutal", "deadly", "raging", "blessed", "cursed",
  "vicious", "relentless", "merciless", "powerful", "dominant", "crushing", "lethal", "menacing",
  // Skill-related
  "crafty", "nimble", "swift", "sturdy", "wise", "magical", "burned", "frozen",
  "agile", "precise", "skilled", "dexterous", "clever", "masterful", "sharp", "talented",
  // Status-related
  "tired", "hungry", "poisoned", "wounded", "sleepy", "rich", "poor", "lucky",
  "thirsty", "starving", "famished", "injured", "exhausted", "wealthy", "broke", "fortunate",
  // Emotions
  "angry", "happy", "sad", "excited", "nervous", "calm", "dizzy", "sore",
  "joyful", "melancholy", "anxious", "terrified", "peaceful", "confused", "irritated", "amused",
  // OSRS-specific
  "ironclad", "runite", "gilded", "ancient", "divine", "infernal", "pure", "noted",
  "enchanted", "imbued", "charged", "trimmed", "barrows", "dragonfire", "venomous", "spectral",
  "dharok", "verac", "torag", "guthan", "karil", "ahrim", "void", "graceful",
  "prospector", "lumberjack", "angler", "rogue", "spiritual", "unsired", "abyssal", "draconic"
];

const nouns = [
  // Items
  "dragon", "bronze", "iron", "steel", "mithril", "adamant", "rune", "gold",
  "bone", "log", "fish", "ore", "herb", "gem", "potion", "staff",
  "scimitar", "whip", "dagger", "shield", "platebody", "amulet", "ring", "clue",
  "spade", "hatchet", "pickaxe", "arrow", "bolt", "robe", "feather", "seed",
  // Foods
  "cake", "bread", "lobster", "shark", "stew", "wine", "beer", "karambwan",
  "chocolate", "sweetcorn", "cabbage", "potato", "tuna", "monkfish", "curry", "pie",
  "kebab", "anchovy", "sardine", "herring", "trout", "salmon", "swordfish", "bass",
  "mackerel", "shrimp", "manta", "turtle", "drumstick", "apple", "banana", "orange",
  // Locations
  "wilderness", "falador", "varrock", "lumbridge", "draynor", "edgeville", "karamja", "ardougne",
  "catherby", "canifis", "seers", "yanille", "rellekka", "kourend", "entrana", "morytania",
  "alkharid", "taverley", "burthorpe", "sophanem", "pollnivneach", "prifddinas", "hosidius", "shayzien",
  // OSRS concepts
  "prayer", "magic", "strength", "agility", "fletching", "slayer", "farming", "combat",
  "mining", "smithing", "fishing", "cooking", "firemaking", "woodcutting", "runecraft", "construction",
  "herblore", "hunter", "thieving", "crafting", "hitpoints", "defence", "ranging", "quest"
];

const creatures = [
  // Standard monsters
  "goblin", "imp", "rat", "spider", "wolf", "bear", "zombie", "skeleton",
  "cow", "chicken", "unicorn", "scorpion", "bat", "mosquito", "snake", "banshee",
  "monkey", "scorpia", "rabbit", "frog", "dog", "cat", "tortoise", "crab",
  "duck", "penguin", "sheep", "goat", "kalphite", "lizard", "crawling-hand", "cockatrice",
  // Higher level monsters
  "dragon", "demon", "giant", "troll", "ogre", "ghost", "werewolf", "vampire",
  "revenant", "hellhound", "gargoyle", "nechryael", "abyssal", "kurask", "turoth", "basilisk",
  "wyvern", "pyrefiend", "bloodveld", "aberrant", "dagannoth", "spiritual", "wyrm", "drake",
  "elf", "dwarf", "aviansie", "shade", "infernal", "superior", "elemental", "fiend",
  // Boss monsters
  "jad", "zulrah", "vorkath", "hydra", "kraken", "cerberus", "thermonuclear", "graardor",
  "zilyana", "kreearra", "kril", "kalphite-queen", "corporeal", "scorpia", "callisto", "venenatis",
  "chaos-fanatic", "crazy-archaeologist", "deranged-archaeologist", "mole", "sarachnis", "bryophyta", "hespori", "obor",
  "mimic", "skotizo", "grotesque", "alchemical", "nightmare", "gauntlet", "hunllef", "zalcano",
  // Skilling creatures
  "chinchompa", "beaver", "heron", "squirrel", "raccoon", "golem", "phoenix", "quokka",
  "tangleroot", "rocky", "giant-squirrel", "rift-guardian", "herbiboar", "baby-chinchompa", "chompy", "kebbits",
  "impling", "kyatt", "salamander", "magpie", "eclectic", "essence", "nature", "spirit",
  // NPCs
  "guard", "farmer", "wizard", "druid", "knight", "thief", "banker", "shopkeeper",
  "zamorak-monk", "wise-old-man", "hans", "zookeeper", "makeover-mage", "bartender", "cook", "king",
  "duke", "prince", "princess", "gnome", "barbarian", "pirate", "fremennik", "adventurer",
  "nurse", "doctor", "student", "teacher", "musician", "angler", "member", "ironman"
];

/**
 * Generates a random OSRS-themed code phrase
 * @returns {string} A phrase in the format "adjective-noun-creature"
 */
function generateOSRSCodePhrase(): string {
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomCreature = creatures[Math.floor(Math.random() * creatures.length)];

  return `${randomAdjective}-${randomNoun}-${randomCreature}`;
}

/**
 * Generates multiple OSRS-themed code phrases
 * @param {number} count - The number of phrases to generate
 * @returns {string[]} An array of generated phrases
 */
function generateMultiplePhrases(count: number = 5): string[] {
  const phrases = [];
  for (let i = 0; i < count; i++) {
    phrases.push(generateOSRSCodePhrase());
  }
  return phrases;
}
