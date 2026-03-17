export default function getRandomFrog(
  gameType: "osrs" | "rs3" = "osrs"
): string {
  if (gameType === "rs3") {
    // RS3 themed default images - dragons, iconic creatures, and bosses
    const rs3Images = [
      "https://runescape.wiki/images/thumb/Black_dragon.png/800px-Black_dragon.png",
      "https://runescape.wiki/images/thumb/TzTok-Jad.png/800px-TzTok-Jad.png",
      "https://runescape.wiki/images/thumb/Corporeal_Beast.png/800px-Corporeal_Beast.png",
      "https://runescape.wiki/images/thumb/Nex.png/800px-Nex.png",
      "https://runescape.wiki/images/thumb/Queen_Black_Dragon.png/800px-Queen_Black_Dragon.png",
      "https://runescape.wiki/images/thumb/Kalphite_King.png/800px-Kalphite_King.png",
      "https://runescape.wiki/images/thumb/Vorago.png/800px-Vorago.png",
      "https://runescape.wiki/images/thumb/Araxxor.png/800px-Araxxor.png",
      "https://runescape.wiki/images/thumb/Telos%2C_the_Warden.png/800px-Telos%2C_the_Warden.png",
    ]
    return rs3Images[Math.floor(Math.random() * rs3Images.length)]!
  }

  // OSRS default images - frogs
  const osrsImages = [
    "https://oldschool.runescape.wiki/images/thumb/Giant_frog.png/800px-Giant_frog.png?a8fe4",
    "https://oldschool.runescape.wiki/images/thumb/Frog_%28Zanaris%29.png/640px-Frog_%28Zanaris%29.png?dd7fd",
    "https://oldschool.runescape.wiki/images/thumb/Swamp_frog.png/800px-Swamp_frog.png?696de",
    "https://oldschool.runescape.wiki/images/thumb/Gary.png/1200px-Gary.png?8ced3",
    "https://oldschool.runescape.wiki/images/thumb/Sue.png/290px-Sue.png?290bd",
    "https://oldschool.runescape.wiki/images/thumb/Plague_frog.png/800px-Plague_frog.png?c1e76",
    "https://oldschool.runescape.wiki/images/thumb/Cuthbert.png/1200px-Cuthbert.png?ab9b5",
    "https://oldschool.runescape.wiki/images/thumb/Dave.png/290px-Dave.png?d30e8",
    "https://oldschool.runescape.wiki/images/thumb/Frog_%28Ruins_of_Camdozaal%29.png/200px-Frog_%28Ruins_of_Camdozaal%29.png?6ae5e",
  ]

  return osrsImages[Math.floor(Math.random() * osrsImages.length)]!
}
