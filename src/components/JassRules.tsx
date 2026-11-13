import { X } from 'lucide-react'
import { useEffect } from 'react'
import { COIFFEUR_ROWS, type JassVariant, modeLabel } from '../lib/jass'

/** Jass-Regeln als Bottom-Sheet — die gewählte Variante steht zuoberst. */
export function JassRules({ variant, onClose }: { variant?: JassVariant; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const variants: Record<JassVariant, React.ReactNode> = {
    schieber: (
      <Section key="schieber" title="Schieber">
        Zwei gegen zwei, die Partner sitzen sich gegenüber. Die Vorhand — der Spieler
        nach dem Geber — sagt Trumpf, Obenabe oder Undenufe an oder schiebt: dann wählt
        ihr Partner. Ausspielen tut immer die Vorhand. Gespielt wird auf ein Ziel; wer es
        zuerst erreicht, bedankt sich, auch mitten in der Runde. Gezählt wird Weis vor
        Stöck vor Stich. Auf Wunsch zählen Schellen und Schilten doppelt, Obenabe und
        Undenufe dreifach.
      </Section>
    ),
    differenzler: (
      <Section key="differenzler" title="Differenzler">
        Jeder spielt für sich. Die letzte Karte des Gebers wird aufgedeckt, ihre Farbe ist
        Trumpf. Vor dem Ausspielen sagt jeder verdeckt an, wie viele Punkte er macht. Die
        Abweichung zählt als Strafpunkte, nach der letzten Runde gewinnt die kleinste
        Summe. Geweist wird nicht, Stöck zählen aber zu den eigenen Punkten.
      </Section>
    ),
    coiffeur: (
      <Section key="coiffeur" title="Coiffeur">
        Zwei gegen zwei wie beim Schieber, schieben inklusive. Jedes Team muss jede
        Spielart genau einmal spielen:{' '}
        {COIFFEUR_ROWS.map((r) => `${modeLabel(r.mode)} ×${r.factor}`).join(', ')}.
        Eingetragen werden nur die Punkte des Teams, das angesagt hat — mit Weis und Stöck,
        mal Faktor. Sind alle Zeilen voll, gewinnt die grössere Summe.
      </Section>
    ),
  }
  const order: JassVariant[] = variant
    ? [variant, ...(['schieber', 'differenzler', 'coiffeur'] as JassVariant[]).filter((v) => v !== variant)]
    : ['schieber', 'differenzler', 'coiffeur']

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 animate-fade-in">
      <button
        type="button"
        aria-label="Regeln schliessen"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div className="relative glass-elevated rounded-t-3xl max-w-lg w-full mx-auto max-h-[85vh] overflow-y-auto p-5 safe-bottom">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-3xl tracking-wide leading-none">REGELN</h2>
            <p className="label-caption mt-1">Jass · zu viert · 36 Karten</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            className="press-scale w-9 h-9 rounded-xl grid place-items-center text-white/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-white/70 leading-relaxed">
          {order.map((v) => variants[v])}
          <Section title="Kartenwerte">
            Trumpf: Under (Puur) 20, Neuner (Nell) 14, Ass 11, Banner 10, König 4, Ober 3.
            Sonst: Ass 11, Banner 10, König 4, Ober 3, Under 2. Obenabe und Undenufe ohne
            Trumpf: der Achter zählt 8, bei Undenufe ist der Sechser die höchste Karte und
            zählt 11, das Ass nichts. Der letzte Stich bringt 5 — zusammen immer 157. Wer
            alle neun Stiche holt, macht Match: 100 dazu.
          </Section>
          <Section title="Bedienen">
            Die angespielte Farbe angeben — oder trumpfen, das geht immer. Untertrumpfen
            ist verboten, ausser man hat nur noch Trümpfe. Wird Trumpf angespielt, muss man
            Trumpf geben; den Puur aber nicht, wenn er der einzige ist. Rangfolge im Trumpf:
            Puur, Nell, Ass, König, Ober, Banner, 8, 7, 6.
          </Section>
          <Section title="Weisen und Stöck">
            Die App weist automatisch mit der ersten Karte. Folgen in einer Farbe:
            Dreiblatt 20, Vierblatt 50, Fünfblatt 100, jede weitere Karte 50 mehr. Vier
            Gleiche: Under 200, Neuner 150, Asse, Könige, Ober, Banner je 100. Nur das Team
            mit dem höchsten Weis zählt — dann aber alle seine Weise, und die werden nach
            dem ersten Stich gezeigt. Stöck (König und Ober im Trumpf) zählen 20, sobald die
            zweite Karte liegt.
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-caption mb-1">{title}</p>
      <p>{children}</p>
    </div>
  )
}
