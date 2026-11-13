/**
 * Jass zu viert mit 36 Jasskarten — Schieber, Differenzler und Coiffeur.
 *
 * Gleiche Rolle wie `game.ts` und `fyn.ts`: mutiert den Zustand, Aktionen
 * geben bei Regelverstoss einen Fehlertext zurück (sonst null). Die Bots
 * wohnen mit hier, weil sie genau dieselben Regeln brauchen.
 */
import { botName } from './bot'
import {
  type Card,
  type CardId,
  type Rank,
  SUITS,
  SUIT_LABEL,
  type Suit,
  cardId,
  freshDeck,
  shuffle,
} from './cards'
import type { GPlayer } from './game'

export const JASS_PLAYERS = 4
export const HAND_SIZE = 9
export const LAST_TRICK_BONUS = 5
export const MATCH_BONUS = 100
export const STOECK_POINTS = 20
/** 152 Kartenpunkte und 5 für den letzten Stich. */
export const ROUND_POINTS = 157

export type JassVariant = 'schieber' | 'differenzler' | 'coiffeur'
export const JASS_VARIANTS: JassVariant[] = ['schieber', 'differenzler', 'coiffeur']
export const VARIANT_LABEL: Record<JassVariant, string> = {
  schieber: 'Schieber',
  differenzler: 'Differenzler',
  coiffeur: 'Coiffeur',
}

/** Spielart einer Runde: eine Trumpffarbe, Obenabe oder Undenufe. */
export type JassMode = Suit | 'obenabe' | 'undenufe'
export const JASS_MODES: JassMode[] = [...SUITS, 'obenabe', 'undenufe']
/** Ansagen in der Trumpfrunde: eine Spielart wählen oder zum Partner schieben. */
export type TrumpfChoice = JassMode | 'schieben'

export const isSuitMode = (m: JassMode | null): m is Suit =>
  m != null && m !== 'obenabe' && m !== 'undenufe'

export function modeLabel(m: JassMode): string {
  return m === 'obenabe' ? 'Obenabe' : m === 'undenufe' ? 'Undenufe' : SUIT_LABEL[m]
}

export type JassPhase = 'lobby' | 'trumpf' | 'predict' | 'play' | 'settle' | 'over'

export type JassConfig = {
  variant: JassVariant
  /** Schieber: so viele Punkte braucht ein Team. */
  target: number
  /** Schieber: Eichel/Rosen ×1, Schellen/Schilten ×2, Obenabe/Undenufe ×3. */
  weighted: boolean
  /** Differenzler: Runden pro Partie. */
  rounds: number
}

export const TARGET_OPTIONS = [1000, 1500, 2500]
export const ROUND_OPTIONS = [4, 8, 12]
export const DEFAULT_JASS_CONFIG: JassConfig = {
  variant: 'schieber',
  target: 1000,
  weighted: false,
  rounds: 8,
}

/** Coiffeur: jedes Team spielt jede Spielart genau einmal, mit steigendem Faktor. */
export const COIFFEUR_ROWS: { mode: JassMode; factor: number }[] = JASS_MODES.map((mode, i) => ({
  mode,
  factor: i + 1,
}))

/** Faktor der Spielart in dieser Partie. */
export function multiplier(cfg: JassConfig, mode: JassMode): number {
  if (cfg.variant === 'coiffeur') return COIFFEUR_ROWS.find((r) => r.mode === mode)?.factor ?? 1
  if (cfg.variant !== 'schieber' || !cfg.weighted) return 1
  if (mode === 'obenabe' || mode === 'undenufe') return 3
  return mode === 'schellen' || mode === 'schilten' ? 2 : 1
}

// ---------------------------------------------------------------------------
// Karten: Stärke, Zählwert, Stich, Farbzwang.

/** Rang im Trumpf: Under (Puur) vor Neuner (Nell) vor Ass, König, Ober, Banner, 8, 7, 6. */
const TRUMP_ORDER: Record<Rank, number> = { 6: 1, 7: 2, 8: 3, 10: 4, 12: 5, 13: 6, 14: 7, 9: 8, 11: 9 }

/** Stärke einer Karte in der Spielart. Trümpfe liegen über allem anderen. */
export function power(c: Card, mode: JassMode): number {
  if (mode === 'undenufe') return 15 - c.rank // 6 → 9 … Ass → 1
  if (c.suit === mode) return 20 + TRUMP_ORDER[c.rank]
  return c.rank - 5 // 6 → 1 … Ass → 9
}

/**
 * Zählwert. Trumpf: Puur 20, Nell 14, Ass 11, Banner 10, König 4, Ober 3.
 * Sonst Ass 11, Banner 10, König 4, Ober 3, Under 2 — ohne Trumpf zählt der
 * Achter 8, und Undenufe tauscht Ass und Sechser.
 */
export function points(c: Card, mode: JassMode): number {
  if (c.suit === mode && c.rank === 11) return 20
  if (c.suit === mode && c.rank === 9) return 14
  switch (c.rank) {
    case 14:
      return mode === 'undenufe' ? 0 : 11
    case 6:
      return mode === 'undenufe' ? 11 : 0
    case 10:
      return 10
    case 13:
      return 4
    case 12:
      return 3
    case 11:
      return 2
    case 8:
      return isSuitMode(mode) ? 0 : 8
    default:
      return 0
  }
}

export type Played = { playerId: string; card: Card }

/** Höchster Trumpf, sonst die stärkste Karte der angespielten Farbe. */
export function trickWinnerJass(trick: Played[], mode: JassMode): string {
  const lead = trick[0].card.suit
  return trick
    .filter((t) => t.card.suit === lead || t.card.suit === mode)
    .reduce((best, t) => (power(t.card, mode) > power(best.card, mode) ? t : best)).playerId
}

/**
 * Farbe angeben — oder trumpfen. Trumpf darf man immer, auch wer die Farbe
 * hätte (Schweizer Regel, anders als etwa beim Skat), aber nie untertrumpfen,
 * ausser man hat nur noch Trümpfe. Ist Trumpf angespielt, muss man ihn
 * angeben — den Puur aber nicht hergeben, wenn er der einzige Trumpf ist.
 * Stichzwang gibt es keinen: weder überstechen noch trumpfen muss man.
 */
export function legalJass(hand: Card[], trick: { card: Card }[], mode: JassMode): Card[] {
  if (trick.length === 0) return hand
  const lead = trick[0].card.suit
  const follow = hand.filter((c) => c.suit === lead)
  if (!isSuitMode(mode)) return follow.length > 0 ? follow : hand

  const isTrump = (c: Card) => c.suit === mode
  if (lead === mode) return follow.some((c) => c.rank !== 11) ? follow : hand
  if (hand.every(isTrump)) return hand

  const top = Math.max(0, ...trick.filter((t) => isTrump(t.card)).map((t) => power(t.card, mode)))
  const pool = follow.length > 0 ? [...follow, ...hand.filter(isTrump)] : hand
  return pool.filter((c) => !isTrump(c) || power(c, mode) > top)
}

function illegalReason(trick: Played[], mode: JassMode, card: Card): string {
  const lead = trick[0].card.suit
  if (!isSuitMode(mode)) return 'Farbe angeben.'
  if (lead === mode) return 'Trumpf angeben.'
  if (card.suit === mode) return 'Untertrumpfen ist verboten.'
  return 'Farbe angeben — oder trumpfen.'
}

/** Für die Handanzeige: Trumpf zuerst, dann nach Farbe, innerhalb nach Stärke. */
export function sortJassHand(hand: Card[], mode: JassMode | null): Card[] {
  const order = (s: Suit) => (s === mode ? -1 : SUITS.indexOf(s))
  return [...hand].sort(
    (a, b) => order(a.suit) - order(b.suit) || (mode ? power(b, mode) - power(a, mode) : b.rank - a.rank),
  )
}

// ---------------------------------------------------------------------------
// Weisen und Stöck.

export type Weis = { kind: 'blatt' | 'vier'; points: number; cards: Card[] }

const BLATT_POINTS = [0, 0, 0, 20, 50, 100, 150, 200, 250, 300]
const BLATT_NAME = ['', '', '', 'Dreiblatt', 'Vierblatt', 'Fünfblatt', 'Sechsblatt', 'Siebenblatt', 'Achtblatt', 'Neunblatt']
/** Vier Gleiche: nur Under, Neuner und die Bilder samt Banner zählen. */
const VIER: [Rank, number, string][] = [
  [11, 200, 'Vier Under'],
  [9, 150, 'Vier Neuner'],
  [14, 100, 'Vier Asse'],
  [13, 100, 'Vier Könige'],
  [12, 100, 'Vier Ober'],
  [10, 100, 'Vier Banner'],
]

/** Alle Weise einer Hand: Folgen ab drei Karten einer Farbe und Vier Gleiche. */
export function findWeis(hand: Card[]): Weis[] {
  const out: Weis[] = []
  for (const suit of SUITS) {
    const ranks = hand
      .filter((c) => c.suit === suit)
      .map((c) => c.rank)
      .sort((a, b) => a - b)
    let run: Rank[] = []
    const flush = () => {
      if (run.length >= 3) {
        out.push({ kind: 'blatt', points: BLATT_POINTS[run.length], cards: run.map((rank) => ({ suit, rank })) })
      }
      run = []
    }
    for (const r of ranks) {
      if (run.length > 0 && r !== run[run.length - 1] + 1) flush()
      run.push(r)
    }
    flush()
  }
  for (const [rank, pts] of VIER) {
    if (SUITS.every((suit) => hand.some((c) => c.suit === suit && c.rank === rank))) {
      out.push({ kind: 'vier', points: pts, cards: SUITS.map((suit) => ({ suit, rank })) })
    }
  }
  return out
}

export function weisLabel(w: Weis): string {
  if (w.kind === 'blatt') return BLATT_NAME[w.cards.length]
  return VIER.find(([rank]) => rank === w.cards[0].rank)?.[2] ?? 'Vier Gleiche'
}

/**
 * > 0, wenn `a` der höhere Weis ist: mehr Punkte, dann mehr Karten, dann die
 * höhere Folge (bei Undenufe die tiefere), dann Trumpf vor Farbe.
 */
export function compareWeis(a: Weis, b: Weis, mode: JassMode): number {
  if (a.points !== b.points) return a.points - b.points
  if (a.cards.length !== b.cards.length) return a.cards.length - b.cards.length
  const height = (w: Weis) => {
    const ranks = w.cards.map((c) => c.rank)
    return w.kind === 'blatt' && mode === 'undenufe' ? -Math.min(...ranks) : Math.max(...ranks)
  }
  if (height(a) !== height(b)) return height(a) - height(b)
  const inTrump = (w: Weis) => (w.kind === 'blatt' && w.cards[0].suit === mode ? 1 : 0)
  return inTrump(a) - inTrump(b)
}

function bestWeis(list: Weis[], mode: JassMode): Weis | null {
  return list.reduce<Weis | null>((best, w) => (!best || compareWeis(w, best, mode) > 0 ? w : best), null)
}

const isStoeckCard = (c: Card, mode: JassMode) => c.suit === mode && (c.rank === 13 || c.rank === 12)
/** König und Ober im Trumpf in einer Hand. */
const hasStoeck = (hand: Card[], mode: JassMode) =>
  isSuitMode(mode) && hand.filter((c) => isStoeckCard(c, mode)).length === 2

// ---------------------------------------------------------------------------
// Zustand.

export type JassSettlement = {
  mode: JassMode
  factor: number
  announcerId: string
  pushed: boolean
  /** Kartenpunkte inkl. letzter Stich, pro Spieler. */
  points: Record<string, number>
  /** Pro Team, noch ohne Faktor: Karten (inkl. Match), Weis, Stöck. */
  cards: [number, number]
  weis: [number, number]
  stoeck: [number, number]
  /** Team mit allen neun Stichen. */
  match: number | null
  /** Was gutgeschrieben wurde, mit Faktor. Coiffeur: nur das ansagende Team. */
  credited: [number, number]
  /** Schieber: ein Team hat sich mitten in der Runde bedankt. */
  bedankt: boolean
  /** Differenzler pro Spieler. */
  diff: Record<string, { predicted: number; made: number; diff: number }> | null
}

/** Coiffeur-Tafel eines Teams: Spielart → eingetragene Punkte (mit Faktor). */
export type JassSheet = Partial<Record<JassMode, number>>

export type JassGame = {
  kind: 'jass'
  config: JassConfig
  players: GPlayer[]
  hostId: string
  phase: JassPhase
  /** Runde der laufenden Partie, ab 1. */
  round: number
  dealerIndex: number
  /** Vorhand, der Spieler nach dem Geber: sagt an und spielt den ersten Stich aus. */
  announcer: number
  /** Die Vorhand hat geschoben — jetzt wählt ihr Partner. */
  pushed: boolean
  mode: JassMode | null
  /** Differenzler: die letzte Karte des Gebers, aufgedeckt — ihre Farbe ist Trumpf. */
  trumpCard: Card | null
  hands: Record<string, Card[]>
  /** Differenzler: verdeckte Ansagen. */
  predictions: Record<string, number>
  turn: number
  leader: number
  trick: Played[]
  /** Der Stich ist entschieden, liegt aber noch auf dem Tisch. */
  trickPending: string | null
  trickPauseMs: number
  /** Fertige Stiche dieser Runde. */
  tricks: { winner: string; cards: Played[] }[]
  /** Kartenpunkte dieser Runde pro Spieler, inkl. letzter Stich. */
  points: Record<string, number>
  /** Weise pro Spieler — automatisch erkannt, gewiesen im ersten Stich. */
  weis: Record<string, Weis[]>
  /** Team mit dem höchsten Weis; steht nach dem ersten Stich fest. */
  weisTeam: number | null
  /** Wer König und Ober im Trumpf hält. */
  stoeckHolder: string | null
  /** In diesem Stich (ab 0) lag die zweite Stöck-Karte — dann zählen sie. */
  stoeckTrick: number | null
  /** Schieber: Punkte pro Team. Coiffeur: Summe der Tafel. */
  scores: [number, number]
  /** Schieber: in dieser Runde schon gutgeschrieben. */
  roundCredit: [number, number]
  /** Coiffeur: eingetragene Spielarten pro Team. */
  sheet: [JassSheet, JassSheet]
  /** Differenzler: Summe der Differenzen pro Spieler. */
  penalties: Record<string, number>
  /** Siegerteam (Schieber, Coiffeur). Bei Gleichstand bleibt es leer. */
  winner: number | null
  settlement: JassSettlement | null
  message: string | null
  forceAllowed: boolean
}

export function createJass(hostId: string): JassGame {
  return {
    kind: 'jass',
    config: { ...DEFAULT_JASS_CONFIG },
    players: [],
    hostId,
    phase: 'lobby',
    round: 1,
    // So ist in der ersten Runde Vorhand, wer den Tisch eröffnet hat.
    dealerIndex: JASS_PLAYERS - 1,
    announcer: 0,
    pushed: false,
    mode: null,
    trumpCard: null,
    hands: {},
    predictions: {},
    turn: 0,
    leader: 0,
    trick: [],
    trickPending: null,
    trickPauseMs: 1000,
    tricks: [],
    points: {},
    weis: {},
    weisTeam: null,
    stoeckHolder: null,
    stoeckTrick: null,
    scores: [0, 0],
    roundCredit: [0, 0],
    sheet: [{}, {}],
    penalties: {},
    winner: null,
    settlement: null,
    message: null,
    forceAllowed: false,
  }
}

const indexOf = (g: JassGame, id: string) => g.players.findIndex((p) => p.id === id)
const nameOf = (g: JassGame, id: string) => g.players.find((p) => p.id === id)?.name ?? '?'
const next = (seat: number) => (seat + 1) % JASS_PLAYERS
/** Partner sitzen sich gegenüber: Plätze 0 und 2 gegen 1 und 3. */
export const teamOf = (seat: number) => seat % 2
export const partnerOf = (seat: number) => (seat + 2) % JASS_PLAYERS
const teamGame = (g: JassGame) => g.config.variant !== 'differenzler'
/** Wer in der Trumpfrunde wählt: die Vorhand — oder nach dem Schieben ihr Partner. */
export const chooserSeat = (g: JassGame) => (g.pushed ? partnerOf(g.announcer) : g.announcer)
const teamNames = (g: JassGame, team: number) =>
  g.players
    .filter((_, seat) => teamOf(seat) === team)
    .map((p) => p.name)
    .join(' & ')

/** Coiffeur: Spielarten, die das Team noch nicht gespielt hat. */
export function openRows(g: JassGame, team: number): JassMode[] {
  return COIFFEUR_ROWS.map((r) => r.mode).filter((m) => g.sheet[team][m] === undefined)
}

const sheetTotal = (s: JassSheet) => Object.values(s).reduce((a, b) => a + (b ?? 0), 0)

export function jassActor(g: JassGame): GPlayer | null {
  if (g.trickPending) return null
  if (g.phase === 'trumpf') return g.players[chooserSeat(g)] ?? null
  if (g.phase === 'predict' || g.phase === 'play') return g.players[g.turn] ?? null
  return null
}

// ---------------------------------------------------------------------------
// Lobby: Spielart, Einstellungen, Teams.

export function setJassConfig(g: JassGame, hostId: string, patch: Partial<JassConfig>): string | null {
  if (g.hostId !== hostId) return 'Nur der Host stellt das Spiel ein.'
  if (g.phase !== 'lobby') return 'Nur in der Lobby.'
  const p = (patch ?? {}) as Partial<Record<keyof JassConfig, unknown>>
  const c = { ...g.config }
  if (JASS_VARIANTS.includes(p.variant as JassVariant)) c.variant = p.variant as JassVariant
  if (TARGET_OPTIONS.includes(Number(p.target))) c.target = Number(p.target)
  if (ROUND_OPTIONS.includes(Number(p.rounds))) c.rounds = Number(p.rounds)
  if (typeof p.weighted === 'boolean') c.weighted = p.weighted
  g.config = c
  return null
}

/**
 * Anderer Partner für den ersten Platz: die Plätze dahinter rücken eins weiter.
 * Dreimal getippt, und es sitzen wieder alle wie vorher.
 */
export function rotateTeams(g: JassGame, hostId: string): string | null {
  if (g.hostId !== hostId) return 'Nur der Host stellt die Teams.'
  if (g.phase !== 'lobby') return 'Nur in der Lobby.'
  if (g.players.length < 3) return 'Erst ab drei Spielern.'
  const [first, ...rest] = g.players
  g.players = [first, ...rest.slice(1), rest[0]]
  return null
}

/** In der Lobby sofort raus; in laufender Partie übernimmt ein Bot den Platz. */
export function kickJass(g: JassGame, hostId: string, targetId: string): string | null {
  if (g.hostId !== hostId) return 'Nur der Host kann jemanden entfernen.'
  if (targetId === hostId) return 'Du kannst dich nicht selbst entfernen.'
  const i = indexOf(g, targetId)
  if (i < 0) return 'Spieler nicht am Tisch.'
  if (g.phase === 'lobby') {
    g.players.splice(i, 1)
    return null
  }
  const gone = g.players[i]
  if (gone.bot) return 'Ein Bot bleibt sitzen — sonst fehlt ein Platz.'
  const name = botName(g.players.map((p) => p.name))
  g.players[i] = { ...gone, name, bot: true, connected: true }
  g.message = `${gone.name} ist raus — ${name} übernimmt den Platz.`
  return null
}

// ---------------------------------------------------------------------------
// Ablauf.

/** Neue Partie: Stand auf null, dann die erste Runde. Braucht genau vier Spieler. */
export function startJass(g: JassGame): string | null {
  if (g.players.length !== JASS_PLAYERS) return `Jass braucht genau ${JASS_PLAYERS} Spieler.`
  g.round = 1
  g.scores = [0, 0]
  g.sheet = [{}, {}]
  g.penalties = Object.fromEntries(g.players.map((p) => [p.id, 0]))
  g.winner = null
  dealRound(g)
  return null
}

function dealRound(g: JassGame) {
  const deck = shuffle(freshDeck())
  g.hands = Object.fromEntries(
    g.players.map((p, seat) => [p.id, deck.slice(seat * HAND_SIZE, (seat + 1) * HAND_SIZE)]),
  )
  g.announcer = next(g.dealerIndex)
  g.turn = g.announcer
  g.leader = g.announcer
  g.pushed = false
  g.mode = null
  g.trumpCard = null
  g.predictions = {}
  g.trick = []
  g.trickPending = null
  g.tricks = []
  g.points = Object.fromEntries(g.players.map((p) => [p.id, 0]))
  g.weis = {}
  g.weisTeam = null
  g.stoeckHolder = null
  g.stoeckTrick = null
  g.roundCredit = [0, 0]
  g.settlement = null
  g.message = null

  if (g.config.variant === 'differenzler') {
    // Die letzte Karte des Gebers wird allen gezeigt — ihre Farbe ist Trumpf.
    const dealer = g.hands[g.players[g.dealerIndex].id]
    g.trumpCard = dealer[dealer.length - 1]
    g.mode = g.trumpCard.suit
    g.phase = 'predict'
  } else {
    g.phase = 'trumpf'
  }
}

/** Trumpf ansagen oder schieben. Ausspielen wird immer die Vorhand. */
export function chooseTrumpf(g: JassGame, playerId: string, choice: TrumpfChoice): string | null {
  if (g.phase !== 'trumpf') return 'Gerade wird kein Trumpf bestimmt.'
  if (indexOf(g, playerId) !== chooserSeat(g)) return 'Du bist nicht am Zug.'
  if (choice === 'schieben') {
    if (g.pushed) return 'Geschoben ist schon — jetzt musst du wählen.'
    g.pushed = true
    // Ohne Verb — am Übungstisch heisst der Mensch "Du".
    g.message = `${nameOf(g, playerId)}: geschoben.`
    return null
  }
  if (!JASS_MODES.includes(choice)) return 'Unbekannte Spielart.'
  if (g.config.variant === 'coiffeur' && !openRows(g, teamOf(g.announcer)).includes(choice)) {
    return `${modeLabel(choice)} hat dein Team schon gespielt.`
  }
  g.mode = choice
  const factor = multiplier(g.config, choice)
  g.message = `${nameOf(g, playerId)}: ${modeLabel(choice)}${factor > 1 ? ` ×${factor}` : ''}.`
  beginPlay(g)
  return null
}

/** Differenzler: verdeckt ansagen, wie viele Punkte man macht. */
export function applyPrediction(g: JassGame, playerId: string, value: number): string | null {
  if (g.phase !== 'predict') return 'Gerade keine Ansagen.'
  if (indexOf(g, playerId) !== g.turn) return 'Du bist nicht am Zug.'
  const v = Math.round(Number(value))
  if (!Number.isFinite(v) || v < 0 || v > ROUND_POINTS) return `Ansage zwischen 0 und ${ROUND_POINTS}.`
  g.predictions[playerId] = v
  g.turn = next(g.turn)
  if (g.players.some((p) => g.predictions[p.id] === undefined)) return null
  beginPlay(g)
  return null
}

function beginPlay(g: JassGame) {
  const mode = g.mode as JassMode
  g.phase = 'play'
  g.turn = g.announcer
  g.leader = g.announcer
  g.trick = []
  // Weise gibt es nur im Teamspiel; der Differenzler zählt nur Stöck.
  g.weis = teamGame(g) ? Object.fromEntries(g.players.map((p) => [p.id, findWeis(g.hands[p.id])])) : {}
  g.stoeckHolder = g.players.find((p) => hasStoeck(g.hands[p.id], mode))?.id ?? null
  g.stoeckTrick = null
}

export function playJassCard(g: JassGame, playerId: string, card: CardId): string | null {
  if (g.phase !== 'play') return 'Gerade kein Ausspielen.'
  if (g.trickPending) return 'Der Stich wird noch gezeigt.'
  if (indexOf(g, playerId) !== g.turn) return 'Du bist nicht am Zug.'
  const hand = g.hands[playerId] ?? []
  const chosen = hand.find((c) => cardId(c) === card)
  if (!chosen) return 'Karte nicht auf der Hand.'
  const mode = g.mode as JassMode
  if (!legalJass(hand, g.trick, mode).includes(chosen)) return illegalReason(g.trick, mode, chosen)

  g.hands[playerId] = hand.filter((c) => c !== chosen)
  g.trick.push({ playerId, card: chosen })

  // Stöck meldet man mit der zweiten der beiden Karten.
  if (
    playerId === g.stoeckHolder &&
    g.stoeckTrick === null &&
    isStoeckCard(chosen, mode) &&
    !g.hands[playerId].some((c) => isStoeckCard(c, mode))
  ) {
    g.stoeckTrick = g.tricks.length
    g.message = `${nameOf(g, playerId)}: Stöck!`
  }

  if (g.trick.length < JASS_PLAYERS) {
    g.turn = next(g.turn)
    return null
  }
  completeTrick(g)
  return null
}

function weisPoints(g: JassGame, team: number): number {
  return g.players
    .filter((_, seat) => teamOf(seat) === team)
    .reduce((s, p) => s + (g.weis[p.id] ?? []).reduce((a, w) => a + w.points, 0), 0)
}

/** Nach dem ersten Stich: das Team mit dem höchsten Weis zählt alle seine Weise. */
function resolveWeis(g: JassGame) {
  const mode = g.mode as JassMode
  let best: { seat: number; weis: Weis } | null = null
  // Gleich hohe Weise: es gilt, wer im ersten Stich früher dran war.
  for (let k = 0; k < JASS_PLAYERS; k++) {
    const seat = (g.announcer + k) % JASS_PLAYERS
    const top = bestWeis(g.weis[g.players[seat].id] ?? [], mode)
    if (top && (!best || compareWeis(top, best.weis, mode) > 0)) best = { seat, weis: top }
  }
  g.weisTeam = best ? teamOf(best.seat) : null
  if (g.weisTeam !== null) {
    g.message = `Weis: ${teamNames(g, g.weisTeam)} zählen ${weisPoints(g, g.weisTeam)}.`
  }
}

function matchTeam(g: JassGame): number | null {
  if (g.tricks.length < HAND_SIZE) return null
  const teams = new Set(g.tricks.map((t) => teamOf(indexOf(g, t.winner))))
  return teams.size === 1 ? [...teams][0] : null
}

function completeTrick(g: JassGame) {
  const mode = g.mode as JassMode
  const winner = trickWinnerJass(g.trick, mode)
  const index = g.tricks.length
  const last = index === HAND_SIZE - 1
  const pts = g.trick.reduce((s, t) => s + points(t.card, mode), 0) + (last ? LAST_TRICK_BONUS : 0)
  g.points[winner] = (g.points[winner] ?? 0) + pts
  g.tricks.push({ winner, cards: g.trick })
  g.trickPending = winner
  if (index === 0 && teamGame(g)) resolveWeis(g)
  if (g.config.variant === 'schieber') creditSchieber(g, index, winner, pts)
}

/**
 * Schieber: gutschreiben, wie am Tisch gezählt wird — Weis vor Stöck vor
 * Stich. Wer zuerst das Ziel erreicht, bedankt sich; dann ist sofort Schluss,
 * auch wenn das andere Team mit dem Stich auch drüber wäre.
 */
function creditSchieber(g: JassGame, index: number, winner: string, pts: number) {
  if (g.winner !== null) return
  const factor = multiplier(g.config, g.mode as JassMode)
  const events: [number, number][] = []
  if (index === 0 && g.weisTeam !== null) events.push([g.weisTeam, weisPoints(g, g.weisTeam)])
  if (g.stoeckTrick === index && g.stoeckHolder) {
    events.push([teamOf(indexOf(g, g.stoeckHolder)), STOECK_POINTS])
  }
  events.push([teamOf(indexOf(g, winner)), pts])
  const match = matchTeam(g)
  if (match !== null) events.push([match, MATCH_BONUS])

  for (const [team, raw] of events) {
    g.scores[team] += raw * factor
    g.roundCredit[team] += raw * factor
    if (g.scores[team] >= g.config.target) {
      g.winner = team
      g.message = `${teamNames(g, team)} bedanken sich — ${g.scores[team]} Punkte.`
      return
    }
  }
}

/** Stich abräumen: der Gewinner spielt aus; nach dem neunten wird abgerechnet. */
export function finishJassTrick(g: JassGame): void {
  const winner = g.trickPending
  if (!winner) return
  g.trickPending = null
  g.trick = []
  g.leader = indexOf(g, winner)
  g.turn = g.leader
  if (g.config.variant === 'schieber' && g.winner !== null) return endRound(g, true)
  if (g.tricks.length >= HAND_SIZE) endRound(g, false)
}

function endRound(g: JassGame, bedankt: boolean) {
  const mode = g.mode as JassMode
  const factor = multiplier(g.config, mode)
  const variant = g.config.variant

  const cards: [number, number] = [0, 0]
  g.players.forEach((p, seat) => {
    cards[teamOf(seat)] += g.points[p.id] ?? 0
  })
  const match = teamGame(g) ? matchTeam(g) : null
  if (match !== null) cards[match] += MATCH_BONUS
  const weis: [number, number] = [0, 0]
  if (g.weisTeam !== null) weis[g.weisTeam] = weisPoints(g, g.weisTeam)
  const stoeck: [number, number] = [0, 0]
  if (g.stoeckHolder && g.stoeckTrick !== null) stoeck[teamOf(indexOf(g, g.stoeckHolder))] = STOECK_POINTS

  let credited: [number, number] = [0, 0]
  let diff: JassSettlement['diff'] = null
  if (variant === 'schieber') {
    credited = [...g.roundCredit]
  } else if (variant === 'coiffeur') {
    // Gezählt werden nur die Punkte des Teams, das angesagt hat.
    const team = teamOf(g.announcer)
    credited[team] = (cards[team] + weis[team] + stoeck[team]) * factor
    g.sheet[team] = { ...g.sheet[team], [mode]: credited[team] }
    g.scores = [sheetTotal(g.sheet[0]), sheetTotal(g.sheet[1])]
  } else {
    diff = {}
    for (const p of g.players) {
      const made = (g.points[p.id] ?? 0) + (p.id === g.stoeckHolder && g.stoeckTrick !== null ? STOECK_POINTS : 0)
      const predicted = g.predictions[p.id] ?? 0
      diff[p.id] = { predicted, made, diff: Math.abs(made - predicted) }
      g.penalties[p.id] = (g.penalties[p.id] ?? 0) + diff[p.id].diff
    }
  }

  g.settlement = {
    mode,
    factor,
    announcerId: g.players[g.announcer]?.id ?? '',
    pushed: g.pushed,
    points: { ...g.points },
    cards,
    weis,
    stoeck,
    match,
    credited,
    bedankt,
    diff,
  }

  const over =
    variant === 'schieber'
      ? g.winner !== null
      : variant === 'coiffeur'
        ? openRows(g, 0).length === 0 && openRows(g, 1).length === 0
        : g.round >= g.config.rounds
  if (over && variant === 'coiffeur') {
    g.winner = g.scores[0] === g.scores[1] ? null : g.scores[0] > g.scores[1] ? 0 : 1
  }
  // Die Abrechnung sagt jetzt alles — Weis- und Stöck-Meldungen sind von gestern.
  if (!bedankt) g.message = null
  g.phase = over ? 'over' : 'settle'
}

/** Nächste Runde — oder nach dem Schluss eine neue Partie am selben Tisch. */
export function nextJassRound(g: JassGame, hostId: string): string | null {
  if (g.hostId !== hostId) return 'Nur der Host startet die nächste Runde.'
  if (g.phase === 'settle') {
    g.round += 1
    g.dealerIndex = next(g.dealerIndex)
    dealRound(g)
    return null
  }
  if (g.phase === 'over') {
    g.dealerIndex = next(g.dealerIndex)
    return startJass(g)
  }
  return 'Runde läuft noch.'
}

/**
 * Nach der Partie zurück in die Lobby: Spielart und Teams neu wählen, einen Bot
 * gegen jemanden tauschen, der erst jetzt dazukommt. Bots bleiben sitzen.
 */
export function backToLobby(g: JassGame, hostId: string): string | null {
  if (g.hostId !== hostId) return 'Nur der Host kann das.'
  if (g.phase !== 'over') return 'Erst wenn die Partie vorbei ist.'
  g.phase = 'lobby'
  g.round = 1
  g.hands = {}
  g.mode = null
  g.trumpCard = null
  g.predictions = {}
  g.trick = []
  g.tricks = []
  g.points = {}
  g.weis = {}
  g.weisTeam = null
  g.stoeckHolder = null
  g.stoeckTrick = null
  g.scores = [0, 0]
  g.sheet = [{}, {}]
  g.penalties = {}
  g.winner = null
  g.settlement = null
  g.message = null
  return null
}

/** Host spielt für jemanden, der nicht reagiert — so, wie es ein Bot täte. */
export function forceJass(g: JassGame, hostId: string): string | null {
  if (g.hostId !== hostId) return 'Nur der Host kann einen Zug erzwingen.'
  if (!g.forceAllowed) return 'Noch zu früh — der Spieler ist dran.'
  const actor = jassActor(g)
  if (!actor) return 'Gerade ist niemand am Zug.'
  if (botJassMove(g, actor.id)) fallbackJassMove(g, actor.id)
  return null
}

// ---------------------------------------------------------------------------
// Bot. Ausspielen nach Faustregeln; für Trumpfwahl und Ansage spielt er die
// Runde ein paar Dutzend Mal mit zufällig verteilten fremden Karten durch.

type Rnd = () => number

const DECK = freshDeck()
/** Durchläufe pro Spielart bei der Trumpfwahl bzw. für die Differenzler-Ansage. */
const SIMS_TRUMPF = 12
const SIMS_PREDICT = 24
/**
 * Darunter schiebt die Vorhand (erwartete Teampunkte in der besten Spielart).
 * Durchgespielt bringt Schieben ab etwa hier am meisten: der Partner wählt dann
 * im Schnitt besser — rund jede zweite Hand wird geschoben.
 */
const PUSH_BELOW = 104
/**
 * Coiffeur: so viel bringt eine Zeile, die man später irgendwann füllen muss.
 * Wer darüber liegt, nimmt den hohen Faktor; wer darunter liegt, opfert einen tiefen.
 */
const COIFFEUR_PAR = 85

function minBy<T>(xs: T[], f: (x: T) => number): T {
  return xs.reduce((a, b) => (f(b) < f(a) ? b : a))
}
function maxBy<T>(xs: T[], f: (x: T) => number): T {
  return xs.reduce((a, b) => (f(b) > f(a) ? b : a))
}

/** Was ein Spieler am Tisch weiss — eigene Hand, gespielte Karten, Spielart. */
type Seen = {
  hand: Card[]
  trick: Played[]
  mode: JassMode
  seatOf: (id: string) => number
  /** Schon gespielt: frühere Stiche und der laufende. */
  gone: Set<CardId>
  /** Teamspiel: Platz des Partners. Differenzler: niemand. */
  partner: number | null
  /** Das eigene Team hat angesagt — dann wird Trumpf gezogen. */
  ownTrump: boolean
  /** Differenzler: so viele Punkte fehlen noch zur Ansage. null = so viele wie möglich. */
  want: number | null
  tricksLeft: number
}

function choosePlay(v: Seen): Card {
  const legal = legalJass(v.hand, v.trick, v.mode)
  if (legal.length === 1) return legal[0]

  const own = new Set(v.hand.map(cardId))
  const unseen = DECK.filter((c) => !own.has(cardId(c)) && !v.gone.has(cardId(c)))
  const pw = (c: Card) => power(c, v.mode)
  const pt = (c: Card) => points(c, v.mode)
  const isTrump = (c: Card) => c.suit === v.mode
  /** Keine ungesehene Karte derselben Farbe ist stärker. */
  const isTop = (c: Card) => !unseen.some((u) => u.suit === c.suit && pw(u) > pw(c))
  const unseenTrumps = unseen.filter(isTrump).length
  // Im Differenzler mit genug Punkten wird nur noch abgegeben.
  const greedy = v.want === null || v.want > 3
  /** Abwerfen: wenig Punkte, schwach — Trümpfe und sichere Stiche behalten. */
  const cheapest = (cs: Card[]) =>
    minBy(cs, (c) => (isTrump(c) ? 60 : 0) + (isTop(c) ? 30 : 0) + pt(c) * 2 + pw(c))

  if (v.trick.length === 0) {
    if (!greedy) return minBy(legal, (c) => pw(c) + (isTrump(c) ? 40 : 0))
    const trumps = legal.filter(isTrump)
    if (v.ownTrump && unseenTrumps > 0 && trumps.length > 0) {
      const top = maxBy(trumps, pw)
      if (isTop(top)) return top
    }
    const tops = legal.filter((c) => !isTrump(c) && isTop(c))
    if (tops.length > 0) return maxBy(tops, (c) => pt(c) * 10 + pw(c))
    return minBy(legal, (c) => (isTrump(c) ? 100 : 0) + pt(c) * 2 + pw(c))
  }

  const winnerId = trickWinnerJass(v.trick, v.mode)
  const best = (v.trick.find((t) => t.playerId === winnerId) as Played).card
  const last = v.trick.length === JASS_PLAYERS - 1
  const onTable =
    v.trick.reduce((s, t) => s + pt(t.card), 0) + (v.tricksLeft === 1 ? LAST_TRICK_BONUS : 0)
  const ME = '\u0000'
  const wins = (c: Card) => trickWinnerJass([...v.trick, { playerId: ME, card: c }], v.mode) === ME
  const winners = legal.filter(wins)
  const losers = legal.filter((c) => !wins(c))

  if (!greedy) {
    if (losers.length > 0) return maxBy(losers, pw)
    return minBy(winners, (c) => pt(c) * 10 + pw(c))
  }

  if (v.partner !== null && v.seatOf(winnerId) === v.partner) {
    const safe = last || (isTop(best) && (isTrump(best) || unseenTrumps === 0))
    if (safe) {
      // Schmieren: Punkte zum Partner — ohne Trumpf und ohne eigene sichere Stiche.
      const plain = legal.filter((c) => !isTrump(c))
      const keep = plain.filter((c) => !(isTop(c) && c.suit !== v.trick[0].card.suit))
      const pool = keep.length > 0 ? keep : plain
      if (pool.length > 0) return maxBy(pool, (c) => pt(c) * 10 - pw(c))
      return cheapest(legal)
    }
    const sure = winners.filter((c) => !isTrump(c) && isTop(c))
    if (sure.length > 0 && onTable >= 10) return maxBy(sure, pt)
    return cheapest(losers.length > 0 ? losers : legal)
  }

  // Gegner liegt vorne.
  const plain = winners.filter((c) => !isTrump(c))
  if (plain.length > 0) {
    if (last) return minBy(plain, pw)
    const sure = plain.filter(isTop)
    if (sure.length > 0) return minBy(sure, pw)
    if (onTable >= 10) return maxBy(plain, pw)
  }
  const trumps = winners.filter(isTrump)
  if (trumps.length > 0) {
    const t = minBy(trumps, pw)
    const precious = t.rank === 11 || t.rank === 9
    if (onTable >= (precious ? 15 : 8) || (last && onTable > 0) || v.tricksLeft <= 2) return t
  }
  return cheapest(losers.length > 0 ? losers : legal)
}

/** Fremde Karten zufällig verteilen; `fixed` liegt sicher bei jemandem (Differenzler-Trumpf). */
function sampleHands(own: Card[], seat: number, rnd: Rnd, fixed?: { seat: number; card: Card }): Card[][] {
  const known = new Set(own.map(cardId))
  if (fixed) known.add(cardId(fixed.card))
  const rest = shuffle(
    DECK.filter((c) => !known.has(cardId(c))),
    rnd,
  )
  const hands: Card[][] = [[], [], [], []]
  hands[seat] = own
  if (fixed && fixed.seat !== seat) hands[fixed.seat].push(fixed.card)
  for (let s = 0; s < JASS_PLAYERS; s++) {
    if (s !== seat) hands[s].push(...rest.splice(0, HAND_SIZE - hands[s].length))
  }
  return hands
}

/** Eine Runde komplett durchspielen — alle vier nach denselben Faustregeln. */
function simulate(hands: Card[][], mode: JassMode, leader: number, team: boolean) {
  const h = hands.map((x) => [...x])
  const pts = [0, 0, 0, 0]
  const won = [0, 0, 0, 0]
  const gone = new Set<CardId>()
  let lead = leader
  for (let t = 0; t < HAND_SIZE; t++) {
    const trick: Played[] = []
    for (let k = 0; k < JASS_PLAYERS; k++) {
      const seat = (lead + k) % JASS_PLAYERS
      const card = choosePlay({
        hand: h[seat],
        trick,
        mode,
        seatOf: Number,
        gone,
        partner: team ? partnerOf(seat) : null,
        ownTrump: team && teamOf(seat) === teamOf(leader),
        want: null,
        tricksLeft: HAND_SIZE - t,
      })
      h[seat] = h[seat].filter((c) => c !== card)
      trick.push({ playerId: String(seat), card })
      gone.add(cardId(card))
    }
    const w = Number(trickWinnerJass(trick, mode))
    pts[w] += trick.reduce((s, x) => s + points(x.card, mode), 0) + (t === HAND_SIZE - 1 ? LAST_TRICK_BONUS : 0)
    won[w] += 1
    lead = w
  }
  return { pts, won }
}

/** Erwartete Teampunkte (inkl. Match), wenn mit dieser Hand `mode` gespielt wird. */
function expectTeam(hand: Card[], seat: number, mode: JassMode, leader: number, rnd: Rnd): number {
  let sum = 0
  for (let i = 0; i < SIMS_TRUMPF; i++) {
    const { pts, won } = simulate(sampleHands(hand, seat, rnd), mode, leader, true)
    const p = partnerOf(seat)
    sum += pts[seat] + pts[p] + (won[seat] + won[p] === HAND_SIZE ? MATCH_BONUS : 0)
  }
  return sum / SIMS_TRUMPF
}

/**
 * Trumpf wählen. Schieber: der Vorsprung aufs andere Team zählt, mal Faktor.
 * Coiffeur: gute Hände in hohe Faktoren, schlechte in tiefe. Ist die Hand in
 * keiner Spielart stark, wird geschoben.
 */
export function botTrumpf(g: JassGame, id: string, rnd: Rnd = Math.random): TrumpfChoice {
  const seat = indexOf(g, id)
  const hand = g.hands[id] ?? []
  const coiffeur = g.config.variant === 'coiffeur'
  const modes = coiffeur ? openRows(g, teamOf(g.announcer)) : JASS_MODES
  if (modes.length <= 1) return modes[0] ?? 'obenabe'
  const scored = modes.map((mode) => {
    const e = expectTeam(hand, seat, mode, g.announcer, rnd)
    const f = multiplier(g.config, mode)
    return { mode, e, value: coiffeur ? (e - COIFFEUR_PAR) * f : (2 * e - ROUND_POINTS) * f }
  })
  if (!g.pushed && Math.max(...scored.map((s) => s.e)) < PUSH_BELOW) return 'schieben'
  return maxBy(scored, (s) => s.value).mode
}

/** Differenzler: der Median der durchgespielten Runden — die Differenz zählt ja betragsmässig. */
export function botPredict(g: JassGame, id: string, rnd: Rnd = Math.random): number {
  const seat = indexOf(g, id)
  const hand = g.hands[id] ?? []
  const mode = g.mode as JassMode
  const fixed = g.trumpCard && g.dealerIndex !== seat ? { seat: g.dealerIndex, card: g.trumpCard } : undefined
  const runs: number[] = []
  for (let i = 0; i < SIMS_PREDICT; i++) {
    runs.push(simulate(sampleHands(hand, seat, rnd, fixed), mode, g.announcer, false).pts[seat])
  }
  runs.sort((a, b) => a - b)
  const median = runs[Math.floor(runs.length / 2)]
  return Math.min(ROUND_POINTS, Math.round(median + (hasStoeck(hand, mode) ? STOECK_POINTS : 0)))
}

export function botJassCard(g: JassGame, id: string): CardId {
  const seat = indexOf(g, id)
  const team = teamGame(g)
  const gone = new Set([...g.tricks.flatMap((t) => t.cards), ...g.trick].map((t) => cardId(t.card)))
  // Stöck kommen sicher noch dazu — sobald beide Karten gespielt sind.
  const made = (g.points[id] ?? 0) + (id === g.stoeckHolder ? STOECK_POINTS : 0)
  return cardId(
    choosePlay({
      hand: g.hands[id] ?? [],
      trick: g.trick,
      mode: g.mode as JassMode,
      seatOf: (pid) => indexOf(g, pid),
      gone,
      partner: team ? partnerOf(seat) : null,
      ownTrump: team && teamOf(seat) === teamOf(g.announcer),
      want: team ? null : (g.predictions[id] ?? 0) - made,
      tricksLeft: HAND_SIZE - g.tricks.length,
    }),
  )
}

/** Ein Zug für einen Bot — oder den Host, der für jemanden einspringt. */
export function botJassMove(g: JassGame, id: string, rnd: Rnd = Math.random): string | null {
  switch (g.phase) {
    case 'trumpf':
      return chooseTrumpf(g, id, botTrumpf(g, id, rnd))
    case 'predict':
      return applyPrediction(g, id, botPredict(g, id, rnd))
    case 'play':
      return playJassCard(g, id, botJassCard(g, id))
    default:
      return 'Hier gibt es nichts zu tun.'
  }
}

/** Garantiert legal — falls die Engine einen Bot-Zug einmal ablehnt. */
export function fallbackJassMove(g: JassGame, id: string): void {
  if (g.phase === 'trumpf') {
    const mode = g.config.variant === 'coiffeur' ? openRows(g, teamOf(g.announcer))[0] : 'obenabe'
    if (mode) chooseTrumpf(g, id, mode)
  } else if (g.phase === 'predict') {
    applyPrediction(g, id, 40)
  } else if (g.phase === 'play') {
    const card = legalJass(g.hands[id] ?? [], g.trick, g.mode as JassMode)[0]
    if (card) playJassCard(g, id, cardId(card))
  }
}

// ---------------------------------------------------------------------------
// Sicht für einen einzelnen Spieler — fremde Hände und Ansagen bleiben geheim.

export type JassPlayerView = GPlayer & {
  seat: number
  team: number
  cards: number
  tricks: number
  /** Kartenpunkte dieser Runde. */
  points: number
  /** Differenzler: hat schon angesagt. */
  predicted: boolean
  /** Die eigene Ansage immer, fremde erst nach der Runde. */
  prediction: number | null
  /** Gewiesen im ersten Stich — nur die Punkte, z. B. [50, 20]. */
  weisCalls: number[]
  /** Nach dem ersten Stich: die Weise des Teams, das sie zählt — offen gezeigt. */
  weisShown: { label: string; points: number; cards: Card[] }[]
  /** Hat Stöck gemeldet. */
  stoeck: boolean
}

export type JassClientGame = {
  kind: 'jass'
  config: JassConfig
  players: JassPlayerView[]
  hostId: string
  youId: string
  /** Dein Platz. */
  you: number
  phase: JassPhase
  round: number
  dealerIndex: number
  announcer: number
  /** Platz, der gerade den Trumpf wählt. */
  chooser: number | null
  pushed: boolean
  mode: JassMode | null
  multiplier: number
  trumpCard: Card | null
  hand: Card[]
  /** Deine Weise dieser Runde — die siehst du, bevor du weist. */
  yourWeis: { label: string; points: number; cards: Card[] }[]
  legal: CardId[]
  yourTurn: boolean
  turn: number
  trick: Played[]
  trickPending: string | null
  trickPauseMs: number
  lastTrick: { winner: string; cards: Played[] } | null
  tricksPlayed: number
  scores: [number, number]
  sheet: [JassSheet, JassSheet]
  /** Coiffeur: was dein Team noch spielen muss. */
  openRows: JassMode[]
  penalties: Record<string, number>
  weisTeam: number | null
  settlement: JassSettlement | null
  winner: number | null
  message: string | null
  actorId: string | null
  canForce: boolean
  isHost: boolean
}

export function redactJass(g: JassGame, youId: string): JassClientGame {
  const you = indexOf(g, youId)
  const hand = g.hands[youId] ?? []
  const yourTurn =
    !g.trickPending && g.turn === you && (g.phase === 'predict' || g.phase === 'play')
  const roundOver = g.phase === 'settle' || g.phase === 'over'
  const weisOpen = g.tricks.length > 0
  // Gewiesen wird mit der ersten Karte — vorher kennt man nur den eigenen Weis.
  const hasCalled = (id: string) => id === youId || weisOpen || g.trick.some((t) => t.playerId === id)

  return {
    kind: 'jass',
    config: g.config,
    players: g.players.map((p, seat) => {
      const weis = g.weis[p.id] ?? []
      return {
        ...p,
        seat,
        team: teamOf(seat),
        cards: (g.hands[p.id] ?? []).length,
        tricks: g.tricks.filter((t) => t.winner === p.id).length,
        points: g.points[p.id] ?? 0,
        predicted: g.predictions[p.id] !== undefined,
        prediction: p.id === youId || roundOver ? (g.predictions[p.id] ?? null) : null,
        weisCalls: hasCalled(p.id) ? weis.map((w) => w.points) : [],
        weisShown:
          weisOpen && g.weisTeam === teamOf(seat)
            ? weis.map((w) => ({ label: weisLabel(w), points: w.points, cards: w.cards }))
            : [],
        stoeck: g.stoeckHolder === p.id && g.stoeckTrick !== null,
      }
    }),
    hostId: g.hostId,
    youId,
    you,
    phase: g.phase,
    round: g.round,
    dealerIndex: g.dealerIndex,
    announcer: g.announcer,
    chooser: g.phase === 'trumpf' ? chooserSeat(g) : null,
    pushed: g.pushed,
    mode: g.mode,
    multiplier: g.mode ? multiplier(g.config, g.mode) : 1,
    trumpCard: g.trumpCard,
    hand,
    yourWeis: (g.weis[youId] ?? []).map((w) => ({ label: weisLabel(w), points: w.points, cards: w.cards })),
    legal:
      g.phase === 'play' && yourTurn && g.mode ? legalJass(hand, g.trick, g.mode).map(cardId) : [],
    yourTurn,
    turn: g.turn,
    trick: g.trick,
    trickPending: g.trickPending,
    trickPauseMs: g.trickPauseMs,
    lastTrick: g.tricks[g.tricks.length - 1] ?? null,
    tricksPlayed: g.tricks.length,
    scores: g.scores,
    sheet: g.sheet,
    openRows: g.config.variant === 'coiffeur' && you >= 0 ? openRows(g, teamOf(you)) : [],
    penalties: g.penalties,
    weisTeam: weisOpen ? g.weisTeam : null,
    settlement: g.settlement,
    winner: g.winner,
    message: g.message,
    actorId: jassActor(g)?.id ?? null,
    canForce: g.forceAllowed && g.hostId === youId,
    isHost: g.hostId === youId,
  }
}
