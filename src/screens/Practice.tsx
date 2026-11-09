import { ArrowLeft, GraduationCap, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../components/ui'
import { type Lesson, nextLesson } from '../content/coach'
import { nextFynLesson } from '../content/fynCoach'
import { usePractice } from '../hooks/usePractice'
import { JASS_VARIANTS, type JassVariant, VARIANT_LABEL } from '../lib/jass'
import type { GameKind } from '../lib/protocol'
import { FynTable } from './digital/FynTable'
import { JassTable } from './digital/JassTable'
import { Table } from './digital/Table'

const JASS_BLURB: Record<JassVariant, string> = {
  schieber: 'Zwei gegen zwei bis 1000. Trumpf ansagen oder schieben — Weis, Stöck und Match zählen.',
  differenzler: 'Jeder für sich. Punkte verdeckt ansagen und möglichst genau treffen.',
  coiffeur: 'Zwei gegen zwei. Jede Spielart einmal, mit Faktor ×1 bis ×6.',
}

/**
 * Übungsrunde mit Coach: ein echter Tisch gegen Bots, aber jemand sagt dir,
 * was gerade passiert. Der Coach meldet sich pro Thema einmal — wer alles
 * kennt, spielt einfach weiter.
 *
 * Jedes Spiel hat seinen eigenen Coach; die Lektions-IDs teilen sich nur den
 * Namensraum dieser einen Übung.
 */
export function Practice({ kind = 'chratzen', onExit }: { kind?: GameKind; onExit: () => void }) {
  // Jass hat drei Spiele — gewählt wird, bevor der Tisch steht.
  const [variant, setVariant] = useState<JassVariant | null>(null)
  if (kind === 'jass' && !variant) return <JassPicker onPick={setVariant} onExit={onExit} />
  return <PracticeTable kind={kind} variant={variant ?? undefined} onExit={onExit} />
}

function JassPicker({ onPick, onExit }: { onPick: (v: JassVariant) => void; onExit: () => void }) {
  return (
    <div className="px-5 pt-6 pb-10 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onExit} aria-label="Zurück">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading text-4xl tracking-wide leading-none">JASS ÜBEN</h1>
      </div>
      <p className="text-sm text-white/50 leading-relaxed mb-5">
        Du und drei Bots, ganz ohne Netz. Im Teamspiel sitzt dir ein Bot als Partner gegenüber.
      </p>
      <div className="space-y-3">
        {JASS_VARIANTS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            className="press-scale glass rounded-2xl w-full p-4 text-left"
          >
            <p className="font-heading text-2xl tracking-wide leading-none">{VARIANT_LABEL[v].toUpperCase()}</p>
            <p className="text-xs text-white/45 mt-1.5 leading-snug">{JASS_BLURB[v]}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function PracticeTable({
  kind,
  variant,
  onExit,
}: {
  kind: GameKind
  variant?: JassVariant
  onExit: () => void
}) {
  const p = usePractice('Du', kind, variant)
  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  const [lesson, setLesson] = useState<Lesson<string> | null>(null)
  const [open, setOpen] = useState(true)

  // Erst die offene Lektion wegklicken, dann die nächste — sonst überholen sich
  // die Einwürfe, sobald mehrere Bedingungen gleichzeitig zutreffen.
  useEffect(() => {
    if (!p.game || lesson) return
    // Jass hat (noch) keinen Coach — die Regeln stehen hinter dem Hilfe-Knopf.
    const next =
      p.game.kind === 'fyn'
        ? nextFynLesson(p.game, seen)
        : p.game.kind === 'chratzen'
          ? nextLesson(p.game, seen)
          : null
    if (next) {
      setLesson(next)
      setOpen(true)
    }
  }, [p.game, lesson, seen])

  const dismiss = () => {
    if (!lesson) return
    setSeen((prev) => new Set(prev).add(lesson.id))
    setLesson(null)
  }

  if (!p.game) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-white/40">
        Übungstisch wird aufgebaut …
      </div>
    )
  }

  return (
    <>
      {p.game.kind === 'jass' ? (
        <JassTable
          game={p.game}
          onTrumpf={p.trumpf}
          onPredict={p.bid}
          onPlay={p.play}
          onNext={p.next}
          onKick={p.kick}
          onForce={p.force}
          onSetPause={p.setPause}
          onLeave={onExit}
        />
      ) : p.game.kind === 'fyn' ? (
        <FynTable
          game={p.game}
          onBid={p.bid}
          onPlay={p.play}
          onNext={p.next}
          onKick={p.kick}
          onForce={p.force}
          onSetPause={p.setPause}
          onLeave={onExit}
        />
      ) : (
        <Table
          game={p.game}
          onCall={p.call}
          onExchange={p.exchange}
          onSleeper={p.sleeper}
          onPlay={p.play}
          onBlind={p.blind}
          onNext={p.next}
          onKick={p.kick}
          onForce={p.force}
          onSetPause={p.setPause}
          onSetBalances={p.setBalances}
          onLeave={onExit}
        />
      )}

      {lesson && (
        <div className="fixed top-0 inset-x-0 z-40 max-w-lg mx-auto px-3 safe-top pointer-events-none">
          <div className="pointer-events-auto glass-elevated rounded-2xl mt-2 shadow-xl shadow-black/40">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="press-scale w-full flex items-center gap-2.5 px-4 pt-3 pb-2 text-left"
            >
              <GraduationCap className="w-4 h-4 text-brand shrink-0" />
              <span className="label-caption text-brand/80">Coach</span>
              {!open && (
                <span className="text-sm text-white/70 truncate ml-1">{lesson.title}</span>
              )}
              <X
                className={`w-4 h-4 text-white/30 ml-auto shrink-0 transition-transform ${
                  open ? '' : 'rotate-45'
                }`}
              />
            </button>

            {open && (
              <div className="px-4 pb-4">
                <p className="font-heading text-2xl tracking-wide leading-none">{lesson.title}</p>
                <div className="text-sm text-white/65 leading-relaxed mt-2.5">{lesson.body}</div>
                <div className="flex gap-2 mt-4">
                  <Button variant="primary" size="md" className="flex-1" onClick={dismiss}>
                    {lesson.cta ?? 'Verstanden'}
                  </Button>
                  {lesson.final && (
                    <Button size="md" className="flex-1" onClick={onExit}>
                      Übung beenden
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {p.error && (
        <div className="fixed bottom-6 inset-x-4 max-w-lg mx-auto z-50 animate-fade-in">
          <div className="rounded-xl bg-red-500/15 border border-red-500/30 backdrop-blur px-4 py-3 text-sm text-red-200 text-center">
            {p.error}
          </div>
        </div>
      )}
    </>
  )
}
