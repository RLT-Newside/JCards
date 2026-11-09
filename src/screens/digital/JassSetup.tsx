import { ArrowLeftRight, Bot, UserMinus } from 'lucide-react'
import { Button, SectionTitle, Segmented } from '../../components/ui'
import {
  COIFFEUR_ROWS,
  JASS_PLAYERS,
  JASS_VARIANTS,
  type JassClientGame,
  type JassConfig,
  ROUND_OPTIONS,
  TARGET_OPTIONS,
  VARIANT_LABEL,
  modeLabel,
} from '../../lib/jass'

/** Kurzbeschrieb für die Lobby — auch für Gäste, die nichts einstellen dürfen. */
export function jassSummary(cfg: JassConfig): string {
  switch (cfg.variant) {
    case 'schieber':
      return `Schieber bis ${cfg.target}${cfg.weighted ? ' · Schellen/Schilten ×2, Obenabe/Undenufe ×3' : ''}`
    case 'differenzler':
      return `Differenzler · ${cfg.rounds} Runden · jeder für sich`
    case 'coiffeur':
      return `Coiffeur · ${COIFFEUR_ROWS.length} Spielarten pro Team, ×1 bis ×${COIFFEUR_ROWS.length}`
  }
}

/** Die vier Plätze. Im Teamspiel sitzen sich die Partner gegenüber: 1 und 3 gegen 2 und 4. */
export function JassSeats({
  game,
  onKick,
  onTeams,
}: {
  game: JassClientGame
  onKick: (playerId: string) => void
  onTeams: () => void
}) {
  const teams = game.config.variant !== 'differenzler'
  const seats = Array.from({ length: JASS_PLAYERS }, (_, i) => game.players[i] ?? null)

  const row = (i: number) => {
    const p = seats[i]
    return (
      <div key={i} className="glass rounded-2xl p-3 flex items-center gap-3 min-h-12">
        {p ? (
          <>
            <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-emerald-400' : 'bg-white/20'}`} />
            <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
            {p.bot && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/15 text-sky-300 flex items-center gap-1">
                <Bot className="w-3 h-3" /> Bot
              </span>
            )}
            {p.id === game.hostId && <span className="label-caption">Host</span>}
            {p.id === game.youId && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand">Du</span>
            )}
            {game.isHost && p.id !== game.youId && (
              <button
                type="button"
                aria-label={`${p.name} entfernen`}
                onClick={() => onKick(p.id)}
                className="press-scale w-8 h-8 rounded-lg grid place-items-center text-white/30 hover:text-red-300 hover:bg-red-500/10"
              >
                <UserMinus className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <span className="flex-1 text-sm text-white/25 flex items-center gap-2">
            <Bot className="w-4 h-4" /> frei — beim Start setzt sich ein Bot hin
          </span>
        )}
      </div>
    )
  }

  if (!teams) return <div className="space-y-2">{seats.map((_, i) => row(i))}</div>

  return (
    <div className="space-y-3">
      {[0, 1].map((team) => (
        <div key={team}>
          <p className="label-caption mb-1.5">Team {team + 1}</p>
          <div className="space-y-2">{[team, team + 2].map(row)}</div>
        </div>
      ))}
      {game.isHost && game.players.length >= 3 && (
        <Button size="md" className="w-full flex items-center justify-center gap-2" onClick={onTeams}>
          <ArrowLeftRight className="w-4 h-4" /> Partner wechseln
        </Button>
      )}
    </div>
  )
}

/** Spielart und ihre Einstellungen — nur der Host stellt um. */
export function JassSettings({
  config,
  onChange,
}: {
  config: JassConfig
  onChange: (patch: Partial<JassConfig>) => void
}) {
  return (
    <div className="mt-6 space-y-4">
      <div>
        <SectionTitle>Spielart</SectionTitle>
        <Segmented
          value={config.variant}
          options={JASS_VARIANTS.map((v) => ({ value: v, label: VARIANT_LABEL[v] }))}
          onChange={(variant) => onChange({ variant })}
        />
      </div>

      {config.variant === 'schieber' && (
        <>
          <div>
            <SectionTitle>Ziel</SectionTitle>
            <Segmented
              value={config.target}
              options={TARGET_OPTIONS.map((t) => ({ value: t, label: String(t) }))}
              onChange={(target) => onChange({ target })}
            />
          </div>
          <div>
            <SectionTitle>Zählweise</SectionTitle>
            <Segmented
              value={config.weighted ? 'gewichtet' : 'einfach'}
              options={[
                { value: 'einfach', label: 'Alles einfach' },
                { value: 'gewichtet', label: '×1 · ×2 · ×3' },
              ]}
              onChange={(v) => onChange({ weighted: v === 'gewichtet' })}
            />
            <p className="text-xs text-white/35 mt-2 leading-relaxed">
              {config.weighted
                ? 'Eichel und Rosen zählen einfach, Schellen und Schilten doppelt, Obenabe und Undenufe dreifach — dann eher auf 2500.'
                : 'Jede Spielart zählt gleich viel.'}
            </p>
          </div>
        </>
      )}

      {config.variant === 'differenzler' && (
        <div>
          <SectionTitle>Runden</SectionTitle>
          <Segmented
            value={config.rounds}
            options={ROUND_OPTIONS.map((r) => ({ value: r, label: String(r) }))}
            onChange={(rounds) => onChange({ rounds })}
          />
          <p className="text-xs text-white/35 mt-2 leading-relaxed">
            Jeder sagt verdeckt an, wie viele Punkte er macht. Die Abweichung zählt als
            Strafpunkte — wenig ist gut.
          </p>
        </div>
      )}

      {config.variant === 'coiffeur' && (
        <p className="text-xs text-white/35 leading-relaxed">
          Jedes Team spielt jede Spielart einmal:{' '}
          {COIFFEUR_ROWS.map((r) => `${modeLabel(r.mode)} ×${r.factor}`).join(' · ')}. Eingetragen
          werden nur die Punkte des Teams, das angesagt hat.
        </p>
      )}
    </div>
  )
}
