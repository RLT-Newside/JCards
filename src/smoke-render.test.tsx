import { renderToString } from 'react-dom/server'
import { expect, test } from 'vitest'
import { FynRules } from './components/FynRules'
import { HelpSheet } from './components/HelpSheet'
import { JassRules } from './components/JassRules'
import { RULE_SECTIONS } from './content/rules'
import { createFyn, redactFyn, startFynRound } from './lib/fyn'
import {
  botJassCard,
  chooseTrumpf,
  createJass,
  finishJassTrick,
  jassActor,
  playJassCard,
  redactJass,
  startJass,
} from './lib/jass'
import { FynPad } from './screens/FynPad'
import { MainMenu } from './screens/MainMenu'
import { Practice } from './screens/Practice'
import { Tutorial } from './screens/Tutorial'
import { FynTable } from './screens/digital/FynTable'
import { JassTable } from './screens/digital/JassTable'
import { Lobby } from './screens/digital/Lobby'

test('alle Regelabschnitte rendern', () => {
  for (const s of RULE_SECTIONS) expect(renderToString(<s.Body />).length).toBeGreaterThan(50)
})

test('Hilfe, Tutorial und Übungsrunde rendern', () => {
  expect(renderToString(<HelpSheet onClose={() => {}} initial="stechen" hint="x" />)).toContain('SPIELHILFE')
  expect(renderToString(<Tutorial onExit={() => {}} onPlay={() => {}} />)).toContain('CHRATZEN LERNEN')
  expect(renderToString(<Practice onExit={() => {}} />)).toContain('Übungstisch')
})

test('Menü und FYN-Tisch rendern in jeder Phase', () => {
  const g = createFyn('p0')
  g.players = ['Anna', 'Beat', 'Cara'].map((name, i) => ({ id: `p${i}`, name, balance: 0, connected: true }))
  const noop = () => {}
  const table = () =>
    renderToString(
      <FynTable
        game={redactFyn(g, 'p0')}
        onBid={noop}
        onPlay={noop}
        onNext={noop}
        onKick={noop}
        onForce={noop}
        onSetPause={noop}
        onLeave={noop}
      />,
    )
  expect(renderToString(<MainMenu onSelect={noop} />)).toContain('Block für echte Karten')
  expect(renderToString(<FynPad onExit={noop} />)).toContain('FYN BLOCK')
  expect(renderToString(<FynRules onClose={noop} />)).toContain('Stirnrunde')

  startFynRound(g)
  g.turn = 0
  expect(table()).toContain('Wie viele Stiche')

  g.round = 6
  startFynRound(g)
  expect(table()).toContain('an deiner Stirn')

  g.phase = 'over'
  g.settlement = { p0: 10, p1: -10, p2: 0 }
  expect(table()).toContain('Endstand')
})

test('Jass: Regeln, Übungswahl, Lobby und Tisch rendern in jeder Phase', () => {
  const noop = () => {}
  expect(renderToString(<JassRules variant="coiffeur" onClose={noop} />)).toContain('Undenufe ×6')
  expect(renderToString(<Practice kind="jass" onExit={noop} />)).toContain('DIFFERENZLER')

  const g = createJass('p0')
  g.players = ['Anna', 'Beat'].map((name, i) => ({ id: `p${i}`, name, balance: 0, connected: true }))
  const lobby = () =>
    renderToString(
      <Lobby
        game={redactJass(g, 'p0')}
        code="ABCD"
        hostInfo={null}
        bluetooth={null}
        onOpenBluetooth={noop}
        onStart={noop}
        onKick={noop}
        onAddBot={noop}
        onSetPause={noop}
        onSetBalances={noop}
        onJassConfig={noop}
        onTeams={noop}
        onLeave={noop}
      />,
    )
  expect(lobby()).toContain('Mit 2 Bots starten')
  expect(lobby()).toContain('beim Start setzt sich ein Bot hin')

  g.players.push(...['Cara', 'Dani'].map((name, i) => ({ id: `p${i + 2}`, name, balance: 0, connected: true })))
  const table = (id = 'p0') =>
    renderToString(
      <JassTable
        game={redactJass(g, id)}
        onTrumpf={noop}
        onPredict={noop}
        onPlay={noop}
        onNext={noop}
        onKick={noop}
        onForce={noop}
        onSetPause={noop}
        onLeave={noop}
      />,
    )

  for (const variant of ['schieber', 'coiffeur'] as const) {
    g.config.variant = variant
    startJass(g)
    expect(table()).toContain('Schieben')
    expect(table('p1')).toContain('sagt an')
    chooseTrumpf(g, 'p0', 'obenabe')
    expect(table()).toContain('Karte antippen')
    // Eine Runde zu Ende spielen: Abrechnung.
    while (g.phase === 'play') {
      if (g.trickPending) finishJassTrick(g)
      else {
        const a = jassActor(g)
        if (!a) break
        playJassCard(g, a.id, botJassCard(g, a.id))
      }
    }
    expect(table()).toContain(variant === 'coiffeur' ? 'Obenabe' : 'Gutgeschrieben')
  }

  g.config.variant = 'differenzler'
  startJass(g)
  expect(table()).toContain('Punkte ansagen')
  g.phase = 'over'
  g.settlement = null
  expect(table()).toContain('gewinnt')
})
