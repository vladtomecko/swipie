import type { Swipie } from '../core/swipie'

export function SwipieThumb({ swipie, size = 48, decorative }: { swipie: Swipie; size?: number; decorative?: boolean }) {
  return swipie.image ? (
    <img className="thumb" src={swipie.image} alt={decorative ? '' : swipie.name} width={size} height={size} loading="lazy" />
  ) : (
    <span className="thumb thumb--empty" style={{ width: size, height: size }} aria-hidden="true">
      {swipie.name.charAt(0).toUpperCase()}
    </span>
  )
}

export function SwipieMeta({ swipie }: { swipie: Swipie }) {
  const year = swipie.released?.slice(0, 4)
  return (
    <span className="meta">
      {year && <span>{year}</span>}
      {swipie.rating !== undefined && <span title="RAWG rating">★ {swipie.rating.toFixed(1)}</span>}
      {swipie.metacritic !== undefined && <span title="Metacritic">MC {swipie.metacritic}</span>}
    </span>
  )
}

export function SwipieCard({ swipie, badge }: { swipie: Swipie; badge?: string }) {
  return (
    <div className="card">
      {swipie.image ? (
        <img className="card__img" src={swipie.image} alt={swipie.name} draggable={false} />
      ) : (
        <div className="card__img card__img--empty" aria-hidden="true">
          {swipie.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="card__body">
        <strong className="card__name">{swipie.name}</strong>
        <SwipieMeta swipie={swipie} />
        {badge && <span className="badge">{badge}</span>}
      </div>
    </div>
  )
}
