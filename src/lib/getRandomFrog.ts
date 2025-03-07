export default function getRandomFrog(): string {
  const images = [
    'https://oldschool.runescape.wiki/images/thumb/Giant_frog.png/800px-Giant_frog.png?a8fe4',
    'https://oldschool.runescape.wiki/images/thumb/Frog_%28Zanaris%29.png/640px-Frog_%28Zanaris%29.png?dd7fd',
    'https://oldschool.runescape.wiki/images/thumb/Swamp_frog.png/800px-Swamp_frog.png?696de',
    'https://oldschool.runescape.wiki/images/thumb/Gary.png/1200px-Gary.png?8ced3',
    'https://oldschool.runescape.wiki/images/thumb/Sue.png/290px-Sue.png?290bd',
    'https://oldschool.runescape.wiki/images/thumb/Plague_frog.png/800px-Plague_frog.png?c1e76',
    'https://oldschool.runescape.wiki/images/thumb/Cuthbert.png/1200px-Cuthbert.png?ab9b5',
    'https://oldschool.runescape.wiki/images/thumb/Dave.png/290px-Dave.png?d30e8',
  ]

  return images[Math.floor(Math.random() * images.length)]!;
}
