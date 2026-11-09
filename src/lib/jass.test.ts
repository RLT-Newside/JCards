import { describe, expect, it } from 'vitest'
import { type Card, cardId, freshDeck, parseCard } from './cards'
import { TableHost } from './host'
import {
  HAND_SIZE,
  type JassGame,
  type JassMode,
  type JassVariant,
  ROUND_POINTS,
  applyPrediction,
  backToLobby,
  botJassMove,
  chooseTrumpf,
  compareWeis,
  createJass,
  finishJassTrick,
  findWeis,
  jassActor,
  kickJass,
  legalJass,
  nextJassRound,
  openRows,
  playJassCard,
  points,
  power,
  redactJass,
  rotateTeams,
  setJassConfig,
  startJass,
  trickWinnerJass,
  weisLabel,
} from './jass'
import type { Outgoing } from './protocol'

const cards = (...ids: string[]) => ids.map(parseCard)
const ids = (cs: Card[]) => cs.map(cardId).sort()

/** Kleiner, fester Zufall — damit die Bots in Tests immer gleich rechnen. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function table(variant: JassVariant): JassGame {
  const g = createJass('p0')
  g.players = ['Anna', 'Beat', 'Cara', 'Dani'].map((name, i) => ({
    id: `p${i}`,
    name,
    balance: 0,
    connected: true,
  }))
  g.config.variant = variant
  g.trickPauseMs = 0
  expect(startJass(g)).toBeNull()
  return g
}

/**
 * Feste Verteilung: Anna hat alle Rosen, Dani alle Eichel, Beat und Cara
 * teilen sich Schellen und Schilten ohne Folge und ohne Vier Gleiche.
 */
const DEAL = [
  ['rosen-6', 'rosen-7', 'rosen-8', 'rosen-9', 'rosen-10', 'rosen-11', 'rosen-12', 'rosen-13', 'rosen-14'],
  ['schellen-6', 'schellen-8', 'schellen-10', 'schellen-12', 'schellen-14', 'schilten-7', 'schilten-9', 'schilten-11', 'schilten-13'],
  ['schellen-7', 'schellen-9', 'schellen-11', 'schellen-13', 'schilten-6', 'schilten-8', 'schilten-10', 'schilten-12', 'schilten-14'],
  ['eichel-6', 'eichel-7', 'eichel-8', 'eichel-9', 'eichel-10', 'eichel-11', 'eichel-12', 'eichel-13', 'eichel-14'],
]

function rig(g: JassGame, hands: string[][] = DEAL) {
  g.players.forEach((p, i) => {
    g.hands[p.id] = cards(...hands[i])
  })
}

/** Alle spielen die erste erlaubte Karte, bis die Runde abgerechnet ist. */
function playOut(g: JassGame) {
  for (let i = 0; i < 100 && g.phase === 'play'; i++) {
    if (g.trickPending) {
      finishJassTrick(g)
      continue
    }
    const actor = jassActor(g)
    if (!actor) throw new Error('niemand am Zug')
    const card = legalJass(g.hands[actor.id], g.trick, g.mode as JassMode)[0]
    expect(playJassCard(g, actor.id, cardId(card))).toBeNull()
  }
}

describe('Jass-Karten', () => {
  it('zählt in jeder Spielart 157 Punkte', () => {
    for (const mode of ['rosen', 'obenabe', 'undenufe'] as JassMode[]) {
      const sum = freshDeck().reduce((s, c) => s + points(c, mode), 0)
      expect(sum + 5).toBe(ROUND_POINTS)
    }
    expect(points(parseCard('rosen-11'), 'rosen')).toBe(20)
    expect(points(parseCard('rosen-9'), 'rosen')).toBe(14)
    expect(points(parseCard('eichel-11'), 'rosen')).toBe(2)
    expect(points(parseCard('eichel-8'), 'obenabe')).toBe(8)
    expect(points(parseCard('eichel-6'), 'undenufe')).toBe(11)
    expect(points(parseCard('eichel-14'), 'undenufe')).toBe(0)
  })

  it('kennt Puur und Nell im Trumpf', () => {
    const order = cards('rosen-11', 'rosen-9', 'rosen-14', 'rosen-13', 'rosen-12', 'rosen-10', 'rosen-8', 'rosen-7', 'rosen-6')
    const powers = order.map((c) => power(c, 'rosen'))
    expect([...powers].sort((a, b) => b - a)).toEqual(powers)
    // Jeder Trumpf schlägt jede andere Karte.
    expect(power(parseCard('rosen-6'), 'rosen')).toBeGreaterThan(power(parseCard('eichel-14'), 'rosen'))
  })

  it('bestimmt den Stich je nach Spielart', () => {
    const t = (...c: string[]) => c.map((id, i) => ({ playerId: `p${i}`, card: parseCard(id) }))
    // Farbe: die höchste der angespielten Farbe, fremde Farben zählen nicht.
    expect(trickWinnerJass(t('eichel-10', 'eichel-14', 'schellen-14', 'eichel-6'), 'rosen')).toBe('p1')
    // Der kleinste Trumpf sticht.
    expect(trickWinnerJass(t('eichel-14', 'rosen-6', 'eichel-13', 'eichel-12'), 'rosen')).toBe('p1')
    // Puur vor Nell vor Ass.
    expect(trickWinnerJass(t('rosen-14', 'rosen-9', 'rosen-11', 'rosen-13'), 'rosen')).toBe('p2')
    expect(trickWinnerJass(t('eichel-10', 'eichel-14', 'eichel-6', 'schellen-14'), 'obenabe')).toBe('p1')
    expect(trickWinnerJass(t('eichel-10', 'eichel-14', 'eichel-6', 'schellen-6'), 'undenufe')).toBe('p2')
  })
})

describe('Farbzwang', () => {
  const lead = (...c: string[]) => c.map((id) => ({ card: parseCard(id) }))

  it('Farbe angeben oder trumpfen — sonst nichts', () => {
    const hand = cards('eichel-6', 'eichel-13', 'rosen-7', 'schellen-14')
    expect(ids(legalJass(hand, lead('eichel-10'), 'rosen'))).toEqual(['eichel-13', 'eichel-6', 'rosen-7'])
    // Ohne Trumpf: nur bedienen.
    expect(ids(legalJass(hand, lead('eichel-10'), 'obenabe'))).toEqual(['eichel-13', 'eichel-6'])
    // Wer die Farbe nicht hat, ist frei.
    expect(legalJass(hand, lead('schilten-10'), 'rosen')).toHaveLength(4)
  })

  it('bei Trumpf muss man Trumpf angeben — den blutten Puur aber nicht', () => {
    const hand = cards('rosen-7', 'rosen-12', 'eichel-6')
    expect(ids(legalJass(hand, lead('rosen-10'), 'rosen'))).toEqual(['rosen-12', 'rosen-7'])
    const buur = cards('rosen-11', 'eichel-6', 'schellen-14')
    expect(legalJass(buur, lead('rosen-10'), 'rosen')).toHaveLength(3)
  })

  it('verbietet das Untertrumpfen, ausser man hat nur noch Trümpfe', () => {
    const trick = lead('eichel-10', 'rosen-12')
    const hand = cards('rosen-7', 'rosen-11', 'schellen-14')
    // Eichel nicht da: Schellen oder der höhere Trumpf — der tiefere nicht.
    expect(ids(legalJass(hand, trick, 'rosen'))).toEqual(['rosen-11', 'schellen-14'])
    // Nur Trümpfe: alles erlaubt.
    expect(legalJass(cards('rosen-7', 'rosen-6'), trick, 'rosen')).toHaveLength(2)
    // Mit Eichel: bedienen oder überstechen.
    expect(ids(legalJass(cards('eichel-6', 'rosen-7', 'rosen-14'), trick, 'rosen'))).toEqual([
      'eichel-6',
      'rosen-14',
    ])
  })

  it('lehnt verbotene Karten mit Grund ab', () => {
    const g = table('schieber')
    rig(g)
    chooseTrumpf(g, 'p0', 'schellen')
    expect(playJassCard(g, 'p1', 'schellen-6')).toBe('Du bist nicht am Zug.')
    expect(playJassCard(g, 'p0', 'rosen-6')).toBeNull()
    // Beat hat keine Rosen und sticht mit dem Schellen-Banner.
    expect(playJassCard(g, 'p1', 'schellen-10')).toBeNull()
    // Cara hat noch Schilten — untertrumpfen darf sie nicht.
    expect(playJassCard(g, 'p2', 'schellen-7')).toBe('Untertrumpfen ist verboten.')
    expect(playJassCard(g, 'p2', 'schellen-11')).toBeNull()
    expect(playJassCard(g, 'p3', 'rosen-7')).toBe('Karte nicht auf der Hand.')
  })
})

describe('Weisen', () => {
  it('findet Folgen und Vier Gleiche', () => {
    const w = findWeis(
      cards('eichel-6', 'eichel-7', 'eichel-8', 'eichel-10', 'eichel-11', 'eichel-12', 'eichel-13', 'rosen-11', 'schellen-11', 'schilten-11'),
    )
    expect(w.map((x) => [weisLabel(x), x.points])).toEqual([
      ['Dreiblatt', 20],
      ['Vierblatt', 50],
      ['Vier Under', 200],
    ])
  })

  it('vergleicht Punkte, Länge, Höhe und Trumpf', () => {
    const blatt = (...c: string[]) => findWeis(cards(...c))[0]
    const fuenf = blatt('eichel-6', 'eichel-7', 'eichel-8', 'eichel-9', 'eichel-10')
    const vierAsse = findWeis(cards('eichel-14', 'rosen-14', 'schellen-14', 'schilten-14'))[0]
    // Beide 100 — der Fünfblatt hat mehr Karten.
    expect(compareWeis(fuenf, vierAsse, 'rosen')).toBeGreaterThan(0)
    const hoch = blatt('eichel-12', 'eichel-13', 'eichel-14')
    const tief = blatt('rosen-6', 'rosen-7', 'rosen-8')
    expect(compareWeis(hoch, tief, 'obenabe')).toBeGreaterThan(0)
    expect(compareWeis(hoch, tief, 'undenufe')).toBeLessThan(0)
    // Gleich hoch: Trumpf gewinnt.
    const rosenHoch = blatt('rosen-12', 'rosen-13', 'rosen-14')
    expect(compareWeis(rosenHoch, hoch, 'rosen')).toBeGreaterThan(0)
  })
})

describe('Schieber', () => {
  it('Vorhand schiebt, der Partner wählt, die Vorhand spielt aus', () => {
    const g = table('schieber')
    expect(g.phase).toBe('trumpf')
    expect(g.announcer).toBe(0)
    expect(chooseTrumpf(g, 'p1', 'rosen')).toBe('Du bist nicht am Zug.')
    expect(chooseTrumpf(g, 'p0', 'schieben')).toBeNull()
    expect(jassActor(g)?.id).toBe('p2')
    expect(chooseTrumpf(g, 'p2', 'schieben')).toMatch(/schon/)
    expect(chooseTrumpf(g, 'p2', 'obenabe')).toBeNull()
    expect(g.phase).toBe('play')
    expect(jassActor(g)?.id).toBe('p0')
  })

  it('zählt Match, Weis und Stöck', () => {
    const g = table('schieber')
    rig(g)
    chooseTrumpf(g, 'p0', 'rosen')
    playOut(g)
    expect(g.phase).toBe('settle')
    const s = g.settlement!
    expect(s.match).toBe(0)
    expect(s.cards).toEqual([257, 0])
    // Annas Rosen-Neunblatt schlägt Danis Eichel-Neunblatt: gleich lang, gleich hoch, aber Trumpf.
    expect(s.weis).toEqual([300, 0])
    expect(s.stoeck).toEqual([20, 0])
    expect(g.scores).toEqual([577, 0])
  })

  it('zählt mit Faktor, wenn die Spielarten gewichtet sind', () => {
    const g = table('schieber')
    g.config.weighted = true
    g.config.target = 2500
    rig(g)
    chooseTrumpf(g, 'p0', 'rosen')
    playOut(g)
    expect(g.settlement?.factor).toBe(1)
    const h = table('schieber')
    h.config.weighted = true
    h.config.target = 2500
    rig(h)
    chooseTrumpf(h, 'p0', 'obenabe')
    expect(h.message).toContain('×3')
  })

  it('wer das Ziel zuerst erreicht, bedankt sich — Weis vor Stich', () => {
    const g = table('schieber')
    g.scores = [700, 995]
    rig(g)
    chooseTrumpf(g, 'p0', 'rosen')
    // Erster Stich: Annas Weis kommt vor allen Stichpunkten.
    for (let k = 0; k < 4; k++) {
      const a = jassActor(g)!
      playJassCard(g, a.id, cardId(legalJass(g.hands[a.id], g.trick, 'rosen')[0]))
    }
    expect(g.winner).toBe(0)
    finishJassTrick(g)
    expect(g.phase).toBe('over')
    expect(g.settlement?.bedankt).toBe(true)
    expect(g.scores[0]).toBeGreaterThanOrEqual(1000)
    // Neue Partie am selben Tisch.
    expect(nextJassRound(g, 'p1')).toMatch(/Host/)
    expect(nextJassRound(g, 'p0')).toBeNull()
    expect(g.scores).toEqual([0, 0])
    expect(g.phase).toBe('trumpf')
  })

  it('nach der Partie zurück in die Lobby — Bots bleiben sitzen', () => {
    const g = table('schieber')
    g.players[3].bot = true
    expect(backToLobby(g, 'p0')).toMatch(/vorbei/)
    g.phase = 'over'
    g.scores = [1012, 640]
    expect(backToLobby(g, 'p1')).toMatch(/Host/)
    expect(backToLobby(g, 'p0')).toBeNull()
    expect(g.phase).toBe('lobby')
    expect(g.scores).toEqual([0, 0])
    expect(g.players).toHaveLength(4)
    expect(setJassConfig(g, 'p0', { variant: 'differenzler' })).toBeNull()
    expect(startJass(g)).toBeNull()
    expect(g.phase).toBe('predict')
  })

  it('wechselt nach der Runde Geber und Vorhand', () => {
    const g = table('schieber')
    rig(g)
    chooseTrumpf(g, 'p0', 'rosen')
    playOut(g)
    expect(nextJassRound(g, 'p0')).toBeNull()
    expect(g.round).toBe(2)
    expect(g.announcer).toBe(1)
    expect(Object.values(g.hands).every((h) => h.length === HAND_SIZE)).toBe(true)
  })
})

describe('Coiffeur', () => {
  it('schreibt nur dem ansagenden Team gut, mal Faktor', () => {
    const g = table('coiffeur')
    rig(g)
    expect(chooseTrumpf(g, 'p0', 'rosen')).toBeNull()
    playOut(g)
    // Rosen ist die dritte Zeile: (257 + 300 + 20) × 3.
    expect(g.settlement?.credited).toEqual([1731, 0])
    expect(g.sheet[0].rosen).toBe(1731)
    expect(g.scores).toEqual([1731, 0])
    expect(openRows(g, 0)).not.toContain('rosen')
    expect(openRows(g, 1)).toHaveLength(6)
  })

  it('jede Spielart nur einmal pro Team, nach zwölf Runden ist Schluss', () => {
    const g = table('coiffeur')
    g.sheet[0] = { rosen: 100 }
    expect(chooseTrumpf(g, 'p0', 'rosen')).toMatch(/schon gespielt/)
    // Alles bis auf je eine Zeile eingetragen — die letzte Runde entscheidet.
    g.sheet = [
      { schellen: 1, schilten: 1, rosen: 1, eichel: 1, obenabe: 1 },
      { schellen: 1, schilten: 1, rosen: 1, eichel: 1, obenabe: 1, undenufe: 1 },
    ]
    rig(g)
    expect(chooseTrumpf(g, 'p0', 'undenufe')).toBeNull()
    playOut(g)
    expect(g.phase).toBe('over')
    expect(g.winner).toBe(0)
  })
})

describe('Differenzler', () => {
  it('Trumpf ist die letzte Karte des Gebers, Ansagen bleiben verdeckt', () => {
    const g = table('differenzler')
    expect(g.phase).toBe('predict')
    const dealer = g.hands[g.players[g.dealerIndex].id]
    expect(g.trumpCard).toEqual(dealer[dealer.length - 1])
    expect(g.mode).toBe(g.trumpCard?.suit)

    expect(applyPrediction(g, 'p1', 50)).toBe('Du bist nicht am Zug.')
    expect(applyPrediction(g, 'p0', 200)).toMatch(/zwischen/)
    expect(applyPrediction(g, 'p0', 60)).toBeNull()
    const forBeat = redactJass(g, 'p1')
    expect(forBeat.players[0].predicted).toBe(true)
    expect(forBeat.players[0].prediction).toBeNull()
    expect(redactJass(g, 'p0').players[0].prediction).toBe(60)
  })

  it('zählt die Differenz — Stöck gehören dazu, Weise nicht', () => {
    const g = table('differenzler')
    rig(g)
    g.mode = 'rosen'
    g.trumpCard = parseCard('rosen-6')
    for (const [id, v] of [['p0', 157], ['p1', 0], ['p2', 10], ['p3', 0]] as const) {
      expect(applyPrediction(g, id, v)).toBeNull()
    }
    expect(g.phase).toBe('play')
    playOut(g)
    const d = g.settlement!.diff!
    expect(d.p0).toEqual({ predicted: 157, made: 177, diff: 20 })
    expect(d.p2.diff).toBe(10)
    expect(g.settlement?.weis).toEqual([0, 0])
    expect(g.penalties).toEqual({ p0: 20, p1: 0, p2: 10, p3: 0 })
  })

  it('endet nach der eingestellten Rundenzahl', () => {
    const g = table('differenzler')
    g.config.rounds = 4
    g.round = 4
    for (let i = 0; i < 4; i++) applyPrediction(g, g.players[g.turn].id, 40)
    playOut(g)
    expect(g.phase).toBe('over')
  })
})

describe('Sicht und Lobby', () => {
  it('zeigt nur die eigene Hand und erlaubte Karten nur am Zug', () => {
    const g = table('schieber')
    chooseTrumpf(g, 'p0', 'obenabe')
    const anna = redactJass(g, 'p0')
    const beat = redactJass(g, 'p1')
    expect(anna.hand).toHaveLength(9)
    expect(anna.legal).toHaveLength(9)
    expect(beat.legal).toEqual([])
    expect(JSON.stringify(beat)).not.toContain('"hands"')
    expect(beat.players.every((p) => p.cards === 9)).toBe(true)
  })

  it('weist mit der ersten Karte und zeigt danach die Weise des Gewinners', () => {
    const g = table('schieber')
    rig(g)
    chooseTrumpf(g, 'p0', 'rosen')
    expect(redactJass(g, 'p1').players[3].weisCalls).toEqual([])
    expect(redactJass(g, 'p3').players[3].weisCalls).toEqual([300])
    for (let k = 0; k < 4; k++) {
      const a = jassActor(g)!
      playJassCard(g, a.id, cardId(legalJass(g.hands[a.id], g.trick, 'rosen')[0]))
    }
    const view = redactJass(g, 'p1')
    expect(view.weisTeam).toBe(0)
    expect(view.players[0].weisShown[0]?.label).toBe('Neunblatt')
    expect(view.players[3].weisShown).toEqual([])
  })

  it('Host stellt ein, ändert Teams und ersetzt Spieler durch Bots', () => {
    const g = createJass('p0')
    g.players = ['A', 'B', 'C', 'D'].map((name, i) => ({ id: `p${i}`, name, balance: 0, connected: true }))
    expect(setJassConfig(g, 'p1', { variant: 'coiffeur' })).toMatch(/Host/)
    expect(setJassConfig(g, 'p0', { variant: 'coiffeur', target: 7 } as never)).toBeNull()
    expect(g.config.variant).toBe('coiffeur')
    expect(g.config.target).toBe(1000)
    expect(rotateTeams(g, 'p0')).toBeNull()
    expect(g.players.map((p) => p.name)).toEqual(['A', 'C', 'D', 'B'])

    startJass(g)
    expect(setJassConfig(g, 'p0', { variant: 'schieber' })).toMatch(/Lobby/)
    expect(kickJass(g, 'p0', 'p1')).toBeNull()
    const seat = g.players.find((p) => p.id === 'p1')
    expect(seat?.bot).toBe(true)
    expect(seat?.name).not.toBe('B')
    expect(g.players).toHaveLength(4)
  })
})

describe('Bots', () => {
  it('spielen in jeder Variante nur erlaubte Züge', () => {
    const rnd = seeded(7)
    for (const variant of ['schieber', 'differenzler', 'coiffeur'] as JassVariant[]) {
      const g = table(variant)
      for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 200 && !['settle', 'over'].includes(g.phase); i++) {
          if (g.trickPending) {
            finishJassTrick(g)
            continue
          }
          const actor = jassActor(g)!
          expect(botJassMove(g, actor.id, rnd)).toBeNull()
        }
        expect(['settle', 'over']).toContain(g.phase)
        if (g.phase === 'over') break
        nextJassRound(g, 'p0')
      }
    }
  })

  it('sagen eine starke Hand selbst an und kein Unsinn im Differenzler', () => {
    const rnd = seeded(3)
    const g = table('schieber')
    rig(g)
    // Neun Rosen sind ein Match — mit Rosen-Trumpf, Obenabe oder Undenufe. Geschoben wird nicht.
    expect(botJassMove(g, 'p0', rnd)).toBeNull()
    expect(g.pushed).toBe(false)
    expect(['rosen', 'obenabe', 'undenufe']).toContain(g.mode)

    const d = table('differenzler')
    rig(d)
    d.mode = 'rosen'
    d.trumpCard = parseCard('rosen-6')
    botJassMove(d, 'p0', rnd)
    // Alle Trümpfe und Stöck: so gut wie alles.
    expect(d.predictions.p0).toBeGreaterThan(140)
  })
})

describe('Jass am Tischwirt', () => {
  function runGame(variant: JassVariant) {
    let n = 0
    let now = 0
    const host = new TableHost({ randomId: () => `id${n++}`, now: () => now })
    host.receive('c', { t: 'create', name: 'Anna', ante: 0, game: 'jass' })
    host.receive('c', { t: 'jassConfig', config: { variant, rounds: 4 } })
    host.receive('c', { t: 'setPause', ms: 0 })
    let out: Outgoing[] = host.receive('c', { t: 'start' })
    const state = () => {
      const s = [...out].reverse().find((o) => o.to === 'c' && o.msg.t === 'state')?.msg
      return s?.t === 'state' && s.game.kind === 'jass' ? s.game : null
    }
    let last = state()
    expect(last?.players.filter((p) => p.bot)).toHaveLength(3)
    for (let i = 0; i < 20000 && last?.phase !== 'over'; i++) {
      const g = last
      now += 100
      if (g?.yourTurn && g.phase === 'play') out = host.receive('c', { t: 'play', card: g.legal[0] })
      else if (g?.yourTurn && g.phase === 'predict') out = host.receive('c', { t: 'bid', bid: 50 })
      else if (g?.phase === 'trumpf' && g.chooser === g.you) {
        out = host.receive('c', { t: 'trumpf', mode: variant === 'coiffeur' ? g.openRows[0] : 'obenabe' })
      } else if (g?.phase === 'settle') out = host.receive('c', { t: 'next' })
      else out = host.tick()
      last = state() ?? last
    }
    return last
  }

  it('Schieber, Differenzler und Coiffeur laufen mit drei Bots bis zum Schluss', () => {
    const schieber = runGame('schieber')
    expect(schieber?.phase).toBe('over')
    expect(Math.max(...(schieber?.scores ?? [0]))).toBeGreaterThanOrEqual(1000)

    const diff = runGame('differenzler')
    expect(diff?.phase).toBe('over')
    expect(diff?.round).toBe(4)

    const coiffeur = runGame('coiffeur')
    expect(coiffeur?.phase).toBe('over')
    expect(coiffeur?.sheet.every((s) => Object.keys(s).length === 6)).toBe(true)
  })

  it('ersetzt einen rausgeworfenen Spieler in der Partie durch einen Bot', () => {
    let n = 0
    const host = new TableHost({ randomId: () => `id${n++}`, now: () => 0 })
    const created = host.receive('c-anna', { t: 'create', name: 'Anna', ante: 0, game: 'jass' })
    const code = created.find((o) => o.msg.t === 'joined')?.msg
    if (code?.t !== 'joined') throw new Error('kein Tisch')
    const beat = host.receive('c-beat', { t: 'join', code: code.code, name: 'Beat' })
    const seat = beat.find((o) => o.to === 'c-beat' && o.msg.t === 'joined')?.msg
    if (seat?.t !== 'joined') throw new Error('kein Platz')
    host.receive('c-anna', { t: 'start' })
    const beatId = (host.room(code.code) as JassGame).players[1].id
    const out = host.receive('c-anna', { t: 'kick', playerId: beatId })
    expect(out.some((o) => o.to === 'c-beat' && o.msg.t === 'kicked')).toBe(true)
    const g = host.room(code.code) as JassGame
    expect(g.players).toHaveLength(4)
    expect(g.players[1].bot).toBe(true)
    // Sein Token gilt nicht mehr — zurück an den Platz geht nicht.
    const back = host.receive('c-beat2', { t: 'rejoin', code: code.code, token: seat.token })
    expect(back.some((o) => o.to === 'c-beat2' && o.msg.t === 'kicked')).toBe(true)
  })

  it('lässt keinen Fünften an den Tisch', () => {
    let n = 0
    const host = new TableHost({ randomId: () => `id${n++}`, now: () => 0 })
    const created = host.receive('a', { t: 'create', name: 'A', ante: 0, game: 'jass' })
    const joined = created.find((o) => o.msg.t === 'joined')?.msg
    if (joined?.t !== 'joined') throw new Error('kein Tisch')
    for (const c of ['b', 'c', 'd']) host.receive(c, { t: 'join', code: joined.code, name: c })
    const full = host.receive('e', { t: 'join', code: joined.code, name: 'E' })
    expect(full.find((o) => o.to === 'e')?.msg).toEqual({ t: 'error', message: 'Tisch ist voll.' })
    expect(host.receive('a', { t: 'addBot' }).some((o) => o.msg.t === 'error')).toBe(true)
  })
})
