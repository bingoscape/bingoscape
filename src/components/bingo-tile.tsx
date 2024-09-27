import Image from 'next/image'

interface Tile {
  id: string
  title: string
  headerImage: string | null
  description: string
  weight: number
  index: number
}

interface BingoTileProps {
  tile: Tile
  onClick: (tile: Tile) => void
}

export function BingoTile({ tile, onClick }: BingoTileProps) {
  return (
    <div
      className="relative rounded-lg overflow-hidden cursor-pointer border-2 border-primary transition-transform duration-300 ease-in-out hover:scale-105 aspect-square"
      onClick={() => onClick(tile)}
    >
      {tile.headerImage ? (
        <Image
          src={tile.headerImage}
          alt={tile.title}
          fill
          className="object-contain transition-transform duration-300 ease-in-out hover:scale-110"
        />
      ) : (
        <div className="w-full h-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-lg font-semibold">{tile.title}</span>
        </div>
      )}
    </div>
  )
}
