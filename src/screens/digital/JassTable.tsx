import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Bot,
  ClipboardList,
  HelpCircle,
  History,
  LogOut,
  Shield,
  Trophy,
  UserMinus,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { JassRules } from '../../components/JassRules'
import { PlayingCard } from '../../components/PlayingCard'
import { SUITS as SUIT_ICONS } from '../../components/suits'
import { Button, Card, ConfirmDialog, SectionTitle } from '../../components/ui'
import {
  type Card as JassCard,
  type CardId,
  RANK_NAME,
  SUITS,
  SUIT_LABEL,
  cardId,
  rankLabel,
} from '../../lib/cards'
import {
  COIFFEUR_ROWS,
  JASS_MODES,
  type JassClientGame,
  type JassMode,
  type JassPlayerView,
  type JassSettlement,
  ROUND_POINTS,
  type TrumpfChoice,
  VARIANT_LABEL,
  modeLabel,
  multiplier,
  sortJassHand,
} from '../../lib/jass'
import { PausePicker } from './PausePicker'

/** Plätze rund um den Tisch, von dir aus: rechts spielt nach dir, gegenüber sitzt der Partner. */
const SPOT = ['Du', 'Rechts', 'Partner', 'Links'] as const
/** Im Differenzler spielt jeder für sich — gegenüber ist kein Partner. */
const SPOT_ALONE = ['Du', 'Rechts', 'Gegenüber', 'Links'] as const
/** Wo die Karte eines Platzes im Stich liegt — du unten, gespielt wird nach rechts. */
const TRICK_POS = [
  'bottom-0 left-1/2 -translate-x-1/2',
  'right-0 top-1/2 -translate-y-1/2',
  'top-0 left-1/2 -translate-x-1/2',
  'left-0 top-1/2 -translate-y-1/2',
]

export function ModeIcon({ mode, className = 'w-5 h-5' }: { mode: JassMode; className?: string }) {
  if (mode === 'obenabe') return <ArrowDown className={`${className} text-sky-300`} aria-hidden="true" />
  if (mode === 'undenufe') return <ArrowUp className={`${className} text-violet-300`} aria-hidden="true" />
  const s = SUIT_ICONS[SUITS.indexOf(mode)]
  return <s.Icon className={`${className} ${s.color}`} />
}

/** Ein gezeigter Weis, kurz: Farbe und Folge ("♣ 6–9") — Vier Gleiche heissen, was sie sind. */
function WeisTag({ w }: { w: { label: string; points: number; cards: JassCard[] } }) {
  const first = w.cards[0]
  const last = w.cards[w.cards.length - 1]
  const blatt = w.cards.every((c) => c.suit === first.suit)
  return (
    <Tag tone="brand" title={`${w.label} · ${w.points}${blatt ? ` · ${SUIT_LABEL[first.suit]}` : ''}`}>
      {blatt ? (
        <span className="inline-flex items-center gap-0.5">
          <ModeIcon mode={first.suit} className="w-3 h-3" />
          {rankLabel(first.rank)}–{rankLabel(last.rank)}
        </span>
      ) : (
        w.label
      )}
    </Tag>
  )
}

export function JassTable({
  game,
  onTrumpf,
  onPredict,
  onPlay,
  onNext,
  onLobby,
  onKick,
  onForce,
  onSetPause,
  onLeave,
}: {
  game: JassClientGame
  onTrumpf: (choice: TrumpfChoice) => void
  onPredict: (points: number) => void
  onPlay: (id: CardId) => void
  onNext: () => void
  /** Nach der Partie: zurück in die Lobby. Fehlt am Übungstisch. */
  onLobby?: () => void
  onKick: (playerId: string) => void
  onForce: () => void
  onSetPause: (ms: number) => void
  onLeave: () => void
}) {
  const [manage, setManage] = useState(false)
  const [help, setHelp] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [peek, setPeek] = useState(false)
  const [replace, setReplace] = useState<JassPlayerView | null>(null)

  // Der Blick auf den letzten Stich gilt nur, bis wieder eine Karte fällt.
  useEffect(() => setPeek(false), [game.trick.length, game.tricksPlayed])

  const variant = game.config.variant
  const teams = variant !== 'differenzler'
  const coiffeur = variant === 'coiffeur'
  const myTeam = game.you % 2
  const at = (rel: number) => game.players[(game.you + rel) % 4]
  const you = game.players[game.you]
  const actor = game.players.find((p) => p.id === game.actorId)
  const announcer = game.players[game.announcer]
  const dealer = game.players[game.dealerIndex]
  const done = game.phase === 'settle' || game.phase === 'over'
  const canPlay = game.phase === 'play' && game.yourTurn
  const hand = sortJassHand(game.hand, game.mode)
  const shownTrick = peek && game.lastTrick ? game.lastTrick.cards : game.trick
  const winnerId = peek ? (game.lastTrick?.winner ?? null) : game.trickPending

  return (
    <div className="px-4 pt-4 pb-6 animate-fade-in min-h-screen flex flex-col">
      {/* Stand, Spielart, Knöpfe */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="label-caption">
            {VARIANT_LABEL[variant]} · Runde {game.round}
            {variant === 'schieber' && ` · bis ${game.config.target}`}
            {variant === 'differenzler' && `/${game.config.rounds}`}
            {coiffeur && `/${COIFFEUR_ROWS.length * 2}`}
          </p>
          {teams ? (
            <p className="font-heading text-5xl leading-none tabular mt-0.5">
              <span className="text-brand pot-glow">{game.scores[myTeam]}</span>
              <span className="text-white/25 mx-2">:</span>
              <span className="text-white/60">{game.scores[1 - myTeam]}</span>
            </p>
          ) : (
            <p className="font-heading text-5xl text-brand leading-none tabular pot-glow mt-0.5">
              {game.penalties[game.youId] ?? 0}
            </p>
          )}
          <p className="text-xs text-white/40 mt-1">
            {teams
              ? 'Ihr · Gegner'
              : `Deine Differenz${you?.prediction != null ? ` · Ansage ${you.prediction} · gemacht ${madeSoFar(you)}` : ''}`}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex">
            {coiffeur && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSheet((v) => !v)}
                aria-label="Tafel"
                className={sheet ? 'text-brand' : ''}
              >
                <ClipboardList className="w-5 h-5" />
              </Button>
            )}
            {game.isHost && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setManage((v) => !v)}
                aria-label="Tisch verwalten"
                className={manage ? 'text-brand' : ''}
              >
                <Shield className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setHelp(true)} aria-label="Regeln">
              <HelpCircle className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onLeave} aria-label="Tisch verlassen">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Spielart der Runde */}
      <div className="mt-3 flex items-center gap-2 text-xs text-white/50 min-h-6">
        {game.mode && game.phase !== 'trumpf' ? (
          <>
            <span className="glass rounded-lg px-2 py-1 flex items-center gap-1.5 text-white/85">
              <ModeIcon mode={game.mode} className="w-4 h-4" />
              {variant === 'differenzler' ? `Trumpf ${modeLabel(game.mode)}` : modeLabel(game.mode)}
              {game.multiplier > 1 && <span className="text-brand">×{game.multiplier}</span>}
            </span>
            {teams ? (
              <span className="truncate">
                {announcer?.id === game.youId ? 'deine Ansage' : `Ansage ${announcer?.name}`}
                {game.pushed && ' · geschoben'}
              </span>
            ) : (
              game.trumpCard && (
                // Die aufgedeckte Karte bleibt beim Geber — das wissen alle.
                <span className="truncate">
                  {RANK_NAME[game.trumpCard.rank]} bei{' '}
                  {dealer?.id === game.youId ? 'dir' : dealer?.name}
                </span>
              )
            )}
          </>
        ) : game.phase === 'trumpf' ? (
          <span>
            Vorhand: <span className="text-white/80">{announcer?.name}</span>
            {game.pushed && ' · hat geschoben'}
          </span>
        ) : null}
      </div>

      {/* Mitspieler: links, gegenüber, rechts */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[3, 2, 1].map((rel) => {
          const p = at(rel)
          return p ? (
            <Seat
              key={p.id}
              p={p}
              spot={teams ? SPOT[rel] : SPOT_ALONE[rel]}
              mine={teams && p.team === myTeam}
              active={!done && p.id === game.actorId}
              dealer={p.seat === game.dealerIndex}
              differenzler={!teams}
              roundOver={done}
            />
          ) : null
        })}
      </div>

      {manage && (
        <div className="mt-3 glass rounded-xl p-3 space-y-4">
          <PausePicker value={game.trickPauseMs} onChange={onSetPause} compact />
          {game.players.some((p) => !p.bot && p.id !== game.youId) && (
            <div>
              <SectionTitle>Platz an einen Bot geben</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {game.players
                  .filter((p) => !p.bot && p.id !== game.youId)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setReplace(p)}
                      className="press-scale px-2.5 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-300/85 flex items-center gap-1.5"
                    >
                      <UserMinus className="w-3.5 h-3.5" /> {p.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {sheet && coiffeur && (
        <Card className="mt-3">
          <CoiffeurSheet game={game} />
        </Card>
      )}

      {game.canForce && game.actorId && game.actorId !== game.youId && (
        <div className="mt-3 glass rounded-xl px-3 py-2 flex items-center gap-3 border-amber-400/25">
          <p className="flex-1 text-xs text-amber-200/85 leading-snug">{actor?.name} reagiert nicht.</p>
          <Button size="sm" onClick={onForce}>
            Zug übernehmen
          </Button>
        </div>
      )}

      {game.message && (
        <p className="mt-3 text-xs text-center text-amber-300/80 leading-relaxed">{game.message}</p>
      )}

      {/* Stich in der Mitte, jede Karte vor ihrem Platz */}
      <div
        className={`flex-1 grid place-items-center ${game.phase === 'play' || done ? 'py-4 min-h-[16rem]' : 'py-3'}`}
      >
        {done ? (
          <Results game={game} onNext={onNext} onLobby={onLobby} />
        ) : game.phase !== 'play' ? (
          <p className="text-sm text-white/25 text-center px-4">
            {game.phase === 'predict' ? 'Alle sagen ihre Punkte an …' : 'Trumpf wird bestimmt …'}
          </p>
        ) : (
          <div className="flex flex-col items-center">
            <div className="relative w-[13.5rem] h-[15rem]">
              {shownTrick.map((t, i) => {
                const seat = game.players.findIndex((p) => p.id === t.playerId)
                const wins = winnerId === t.playerId
                return (
                  <div
                    key={cardId(t.card)}
                    className={`absolute ${TRICK_POS[(seat - game.you + 4) % 4]}`}
                    style={{ zIndex: i + 1 }}
                  >
                    <div className={wins ? 'ring-2 ring-brand rounded-xl' : ''}>
                      <PlayingCard card={t.card} size="md" dimmed={peek || (!!game.trickPending && !wins)} />
                    </div>
                  </div>
                )
              })}
              {shownTrick.length === 0 && (
                <p className="absolute inset-0 grid place-items-center text-sm text-white/25">
                  Bereit zum Ausspielen
                </p>
              )}
            </div>
            <div className="h-6 mt-1 text-xs text-center">
              {peek && game.lastTrick ? (
                <span className="text-white/45">
                  Letzter Stich: {game.players.find((p) => p.id === game.lastTrick?.winner)?.name}
                </span>
              ) : game.trickPending ? (
                <span className="text-brand">
                  {game.players.find((p) => p.id === game.trickPending)?.name} sticht
                </span>
              ) : game.lastTrick && game.phase === 'play' ? (
                <button
                  type="button"
                  onClick={() => setPeek(true)}
                  className="press-scale inline-flex items-center gap-1 text-white/35 hover:text-white/70"
                >
                  <History className="w-3.5 h-3.5" /> Letzter Stich
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Deine Weise, solange sie noch nicht entschieden sind */}
      {game.phase === 'play' && game.tricksPlayed === 0 && game.yourWeis.length > 0 && (
        <p className="text-center text-xs text-brand/80 mb-2">
          Du weist {game.yourWeis.map((w) => `${w.label} (${w.points})`).join(' · ')}
        </p>
      )}

      {/* Deine Hand — gefächert, damit neun Karten auch aufs kleinste Handy passen */}
      {!done && (
        <div className="flex justify-center px-1 pb-4 pt-1">
          {hand.map((c, i) => {
            const id = cardId(c)
            const playable = canPlay && game.legal.includes(id)
            return (
              <div key={id} className={i < hand.length - 1 ? 'min-w-0 flex-1 max-w-[4.25rem]' : 'shrink-0'}>
                <PlayingCard
                  card={c}
                  size="md"
                  dimmed={canPlay && !playable}
                  onClick={playable ? () => onPlay(id) : undefined}
                />
              </div>
            )
          })}
        </div>
      )}

      <div className="safe-bottom">
        {game.phase === 'trumpf' &&
          (game.chooser === game.you ? (
            <TrumpfPicker game={game} onTrumpf={onTrumpf} />
          ) : (
            <WaitLine name={actor?.name} what={game.pushed ? 'wählt — es wurde geschoben' : 'sagt an'} />
          ))}

        {game.phase === 'predict' &&
          (game.yourTurn ? (
            <PredictPicker key={game.round} onPredict={onPredict} />
          ) : (
            <WaitLine name={actor?.name} what="sagt seine Punkte an" />
          ))}

        {game.phase === 'play' &&
          (game.yourTurn ? (
            <p className="text-center text-sm text-brand">Du bist am Zug — Karte antippen</p>
          ) : game.trickPending ? (
            <p className="text-center text-sm text-white/25">…</p>
          ) : (
            <WaitLine name={actor?.name} what="spielt" />
          ))}
      </div>

      {replace && (
        <ConfirmDialog
          title="Durch Bot ersetzen?"
          body={
            <>
              <span className="text-white/85">{replace.name}</span> verliert den Platz, ein Bot spielt
              mit seinen Karten weiter. Zurück an den Tisch kommt er nicht mehr.
            </>
          }
          confirmLabel="Ersetzen"
          danger
          onConfirm={() => {
            onKick(replace.id)
            setReplace(null)
          }}
          onCancel={() => setReplace(null)}
        />
      )}

      {help && <JassRules variant={variant} onClose={() => setHelp(false)} />}
    </div>
  )
}

/** Gemachte Punkte im Differenzler — Stöck zählen mit, sobald sie gemeldet sind. */
function madeSoFar(p: JassPlayerView): number {
  return p.points + (p.stoeck ? 20 : 0)
}

function Seat({
  p,
  spot,
  mine,
  active,
  dealer,
  differenzler,
  roundOver,
}: {
  p: JassPlayerView
  spot: string
  mine: boolean
  active: boolean
  dealer: boolean
  differenzler: boolean
  roundOver: boolean
}) {
  return (
    <div className={`glass rounded-xl px-2.5 py-2 min-w-0 ${active ? 'ring-1 ring-brand/60' : ''}`}>
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.connected ? 'bg-emerald-400' : 'bg-red-400/60'}`}
        />
        <span className="text-xs font-medium truncate">{p.name}</span>
        {p.bot && <Bot className="w-3 h-3 text-sky-300/70 shrink-0" aria-label="Bot" />}
      </div>
      <div className="flex items-center gap-1 mt-1 text-[10px] tabular">
        <span className={mine ? 'text-brand/80' : 'text-white/35'}>{spot}</span>
        {dealer && <span className="text-white/25">· Geber</span>}
        <span className="text-white/35 ml-auto">{differenzler ? `${madeSoFar(p)} P` : `${p.tricks} St`}</span>
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5 empty:hidden">
        {differenzler &&
          (p.prediction != null && roundOver ? (
            <Tag tone="sky">Ansage {p.prediction}</Tag>
          ) : p.predicted ? (
            <Tag tone="sky">angesagt</Tag>
          ) : null)}
        {p.weisShown.length > 0
          ? p.weisShown.map((w) => <WeisTag key={w.cards.map(cardId).join()} w={w} />)
          : p.weisCalls.map((pts, i) => (
              <Tag key={`${pts}-${i}`} tone="plain">
                Weis {pts}
              </Tag>
            ))}
        {p.stoeck && <Tag tone="brand">Stöck</Tag>}
      </div>
    </div>
  )
}

function Tag({
  tone,
  title,
  children,
}: {
  tone: 'brand' | 'sky' | 'plain'
  title?: string
  children: React.ReactNode
}) {
  const cls =
    tone === 'brand'
      ? 'bg-brand/15 text-brand'
      : tone === 'sky'
        ? 'bg-sky-400/15 text-sky-300'
        : 'bg-white/8 text-white/55'
  return (
    <span title={title} className={`text-[10px] px-1.5 py-0.5 rounded truncate max-w-full ${cls}`}>
      {children}
    </span>
  )
}

function WaitLine({ name, what }: { name?: string; what: string }) {
  return (
    <p className="text-center text-sm text-white/35">
      <span className="text-white/70">{name}</span> {what} …
    </p>
  )
}

function TrumpfPicker({ game, onTrumpf }: { game: JassClientGame; onTrumpf: (c: TrumpfChoice) => void }) {
  const coiffeur = game.config.variant === 'coiffeur'
  const myTeam = game.you % 2
  return (
    <div>
      <p className="text-center text-xs text-white/50 mb-2">
        {game.pushed ? 'Dein Partner hat geschoben — du wählst.' : 'Du bist Vorhand: ansagen oder schieben.'}
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {JASS_MODES.map((m) => {
          const open = !coiffeur || game.openRows.includes(m)
          const factor = multiplier(game.config, m)
          const written = game.sheet[myTeam][m]
          return (
            <Button
              key={m}
              size="md"
              disabled={!open}
              className="flex flex-col items-center gap-1 py-2.5"
              onClick={() => onTrumpf(m)}
            >
              <ModeIcon mode={m} />
              <span className="text-xs">{modeLabel(m)}</span>
              {coiffeur && !open ? (
                <span className="text-[10px] text-white/40 tabular">{written}</span>
              ) : factor > 1 ? (
                <span className="text-[10px] text-brand/80">×{factor}</span>
              ) : null}
            </Button>
          )
        })}
      </div>
      {!game.pushed && (
        <Button
          variant="primary"
          size="lg"
          className="w-full mt-2 flex items-center justify-center gap-2"
          onClick={() => onTrumpf('schieben')}
        >
          <ArrowLeftRight className="w-4 h-4" /> Schieben
        </Button>
      )}
    </div>
  )
}

function PredictPicker({ onPredict }: { onPredict: (n: number) => void }) {
  // Ein Viertel der Punkte ist der neutrale Anfang — der Rest ist deine Hand.
  const [value, setValue] = useState(40)
  const clamp = (n: number) => Math.max(0, Math.min(ROUND_POINTS, n))
  return (
    <div>
      <p className="text-center text-xs text-white/45">Wie viele Punkte machst du? Die anderen sehen es erst am Schluss.</p>
      <p className="text-center font-heading text-5xl text-brand tabular leading-none mt-2">{value}</p>
      <input
        type="range"
        min={0}
        max={ROUND_POINTS}
        value={value}
        aria-label="Ansage"
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full mt-3 accent-[#e0b23c]"
      />
      <div className="flex gap-1.5 mt-2">
        {[-10, -1, 1, 10].map((d) => (
          <Button key={d} size="md" className="flex-1 tabular" onClick={() => setValue((v) => clamp(v + d))}>
            {d > 0 ? `+${d}` : `−${-d}`}
          </Button>
        ))}
      </div>
      <Button variant="primary" size="lg" className="w-full mt-2" onClick={() => onPredict(value)}>
        {value} Punkte ansagen
      </Button>
    </div>
  )
}

/** Coiffeur-Tafel: jede Spielart einmal pro Team, mal Faktor. */
function CoiffeurSheet({ game }: { game: JassClientGame }) {
  const myTeam = game.you % 2
  const last = game.settlement
  return (
    <div className="text-sm">
      <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-y-1.5 items-center">
        <span className="label-caption">Spielart</span>
        <span className="label-caption text-right">Ihr</span>
        <span className="label-caption text-right">Gegner</span>
        {COIFFEUR_ROWS.map(({ mode, factor }) => {
          const cell = (team: number) => {
            const v = game.sheet[team][mode]
            const fresh = last?.mode === mode && last.credited[team] === v && v !== undefined
            return (
              <span className={`text-right tabular ${v === undefined ? 'text-white/20' : fresh ? 'text-brand' : 'text-white/80'}`}>
                {v ?? '–'}
              </span>
            )
          }
          return (
            <div key={mode} className="contents">
              <span className="flex items-center gap-1.5 text-white/70">
                <ModeIcon mode={mode} className="w-4 h-4" /> {modeLabel(mode)}
                <span className="text-[10px] text-white/35">×{factor}</span>
              </span>
              {cell(myTeam)}
              {cell(1 - myTeam)}
            </div>
          )
        })}
        <span className="text-white/50 pt-1.5 border-t border-white/10">Total</span>
        <span className="text-right tabular font-heading text-xl pt-1.5 border-t border-white/10 text-brand">
          {game.scores[myTeam]}
        </span>
        <span className="text-right tabular font-heading text-xl pt-1.5 border-t border-white/10">
          {game.scores[1 - myTeam]}
        </span>
      </div>
    </div>
  )
}

/** Abrechnung der Runde — oder der Schluss der Partie. */
function Results({
  game,
  onNext,
  onLobby,
}: {
  game: JassClientGame
  onNext: () => void
  onLobby?: () => void
}) {
  const s = game.settlement
  const over = game.phase === 'over'
  const variant = game.config.variant
  const myTeam = game.you % 2
  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.name ?? '?'
  const teamName = (team: number) =>
    game.players
      .filter((p) => p.team === team)
      .map((p) => p.name)
      .join(' & ')
  const announcerTeam = game.players.find((p) => p.id === s?.announcerId)?.team ?? 0

  let title = `Runde ${game.round}`
  if (over && variant === 'differenzler') {
    const best = Math.min(...game.players.map((p) => game.penalties[p.id] ?? 0))
    title = `${game.players
      .filter((p) => (game.penalties[p.id] ?? 0) === best)
      .map((p) => p.name)
      .join(' & ')} gewinnt`
  } else if (over) {
    title = game.winner === null ? 'Unentschieden' : game.winner === myTeam ? 'Ihr gewinnt!' : `${teamName(game.winner)} gewinnen`
  }

  return (
    <Card className="w-full">
      <p className="label-caption mb-1 flex items-center gap-1.5">
        {over && <Trophy className="w-3.5 h-3.5 text-brand" />}
        {over ? 'Schluss' : 'Abgerechnet'}
      </p>
      <p className="font-heading text-3xl tracking-wide leading-none">{title}</p>
      {s && (
        <p className="text-xs text-white/45 mt-2 flex items-center gap-1.5 flex-wrap">
          <ModeIcon mode={s.mode} className="w-3.5 h-3.5" />
          {modeLabel(s.mode)}
          {s.factor > 1 && ` ×${s.factor}`}
          {variant !== 'differenzler' && ` · Ansage ${nameOf(s.announcerId)}${s.pushed ? ' (geschoben)' : ''}`}
          {s.match !== null && ` · Match für ${s.match === myTeam ? 'euch' : 'die Gegner'}`}
          {s.bedankt && ' · bedankt'}
        </p>
      )}

      {s && variant === 'differenzler' && s.diff && (
        <div className="mt-4 grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1.5 text-sm items-center">
          <span className="label-caption">Spieler</span>
          <span className="label-caption text-right">Ansage</span>
          <span className="label-caption text-right">Gemacht</span>
          <span className="label-caption text-right">Diff</span>
          <span className="label-caption text-right">Total</span>
          {[...game.players]
            .sort((a, b) => (game.penalties[a.id] ?? 0) - (game.penalties[b.id] ?? 0))
            .map((p) => {
              const d = s.diff?.[p.id]
              return (
                <div key={p.id} className="contents">
                  <span className={`truncate ${p.id === game.youId ? 'text-brand' : ''}`}>{p.name}</span>
                  <span className="text-right tabular text-white/60">{d?.predicted}</span>
                  <span className="text-right tabular text-white/60">{d?.made}</span>
                  <span className={`text-right tabular ${d?.diff === 0 ? 'text-emerald-400' : 'text-red-300'}`}>
                    {d?.diff}
                  </span>
                  <span className="text-right tabular font-heading text-xl">{game.penalties[p.id] ?? 0}</span>
                </div>
              )
            })}
        </div>
      )}

      {s && variant === 'schieber' && (
        <div className="mt-4 grid grid-cols-[1fr_4.5rem_4.5rem] gap-y-1.5 text-sm items-center">
          <span />
          <span className="label-caption text-right">Ihr</span>
          <span className="label-caption text-right">Gegner</span>
          <Row label="Karten" a={s.cards[myTeam]} b={s.cards[1 - myTeam]} />
          <Row label="Weis" a={s.weis[myTeam]} b={s.weis[1 - myTeam]} />
          <Row label="Stöck" a={s.stoeck[myTeam]} b={s.stoeck[1 - myTeam]} />
          <Row
            label={s.factor > 1 ? `Gutgeschrieben ×${s.factor}` : 'Gutgeschrieben'}
            a={s.credited[myTeam]}
            b={s.credited[1 - myTeam]}
            strong
          />
          <span className="text-white/50 pt-1.5 border-t border-white/10">Stand</span>
          <span className="text-right tabular font-heading text-xl pt-1.5 border-t border-white/10 text-brand">
            {game.scores[myTeam]}
          </span>
          <span className="text-right tabular font-heading text-xl pt-1.5 border-t border-white/10">
            {game.scores[1 - myTeam]}
          </span>
        </div>
      )}

      {s && variant === 'coiffeur' && (
        <div className="mt-4">
          <p className="text-xs text-white/45 mb-3 leading-relaxed">
            {coiffeurLine(s, announcerTeam, announcerTeam === myTeam)}
          </p>
          <CoiffeurSheet game={game} />
        </div>
      )}

      {game.isHost ? (
        <>
          <Button variant="primary" size="lg" className="w-full mt-5" onClick={onNext}>
            {over ? 'Neue Partie' : 'Nächste Runde'}
          </Button>
          {over && onLobby && (
            <Button size="md" className="w-full mt-2" onClick={onLobby}>
              Zurück in die Lobby — Spielart oder Teams ändern
            </Button>
          )}
        </>
      ) : (
        <p className="text-center text-xs text-white/35 mt-5">
          Host startet {over ? 'eine neue Partie' : 'die nächste Runde'} …
        </p>
      )}
    </Card>
  )
}

/** "Ihr tragt 912 ein: (124 Karten + 50 Weis) × 6." */
function coiffeurLine(s: JassSettlement, team: number, ours: boolean): string {
  const parts = [`${s.cards[team]} Karten`]
  if (s.weis[team]) parts.push(`${s.weis[team]} Weis`)
  if (s.stoeck[team]) parts.push(`${s.stoeck[team]} Stöck`)
  return `${ours ? 'Ihr tragt' : 'Die Gegner tragen'} ${s.credited[team]} ein: (${parts.join(' + ')}) × ${s.factor}.`
}

function Row({ label, a, b, strong }: { label: string; a: number; b: number; strong?: boolean }) {
  const cls = strong ? 'text-white/90 font-medium' : 'text-white/60'
  return (
    <>
      <span className={strong ? 'text-white/70' : 'text-white/45'}>{label}</span>
      <span className={`text-right tabular ${cls}`}>{a || '–'}</span>
      <span className={`text-right tabular ${cls}`}>{b || '–'}</span>
    </>
  )
}
