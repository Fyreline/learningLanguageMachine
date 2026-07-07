// New-item introduction card (docs/DESIGN.md §4, "Teach cards"): 38px kana
// with furigana, romaji below, meaning in serif, auto-played audio, one calm
// usage line, mnemonic when the item has one. "Got it" advances; the quiet
// "Skip — I know this" ghost link is the §5.1 fast lane.
import type { Item } from '../../curriculum/types'
import { AudioStage } from './shared'

export function TeachCard({
  item,
  reteach = false,
  skippable,
  onGotIt,
  onSkip,
}: {
  item: Item
  reteach?: boolean
  skippable: boolean
  onGotIt: () => void
  onSkip: () => void
}) {
  return (
    <div className="rounded-lg border border-line bg-paper-mid p-8">
      {reteach && (
        <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft">
          Once more, gently
        </p>
      )}
      <div className="text-center">
        <p lang="ja" className="font-jp text-[38px] leading-[1.4] text-ink">
          {item.furigana ? (
            <ruby>
              {item.jp}
              <rt className="text-[50%] text-ink-soft">{item.furigana}</rt>
            </ruby>
          ) : (
            item.jp
          )}
        </p>
        <p className="mt-1 font-sans text-base italic text-ink-soft">{item.romaji}</p>
        <p className="mt-3 font-serif text-xl text-ink">{item.en}</p>
        {item.literal && <p className="mt-1 text-sm text-ink-soft">{item.literal}</p>}
      </div>

      <div className="mt-6">
        <AudioStage text={item.jp} />
      </div>

      {item.note && <p className="mt-6 text-center text-sm text-ink-soft">{item.note}</p>}
      {item.mnemonic && (
        <p className="mt-2 text-center text-sm text-ink-soft">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em]">Hook </span>
          {item.mnemonic}
        </p>
      )}

      <button
        type="button"
        onClick={onGotIt}
        className="mt-8 w-full rounded-lg bg-clay px-4 py-3 text-sm font-medium text-paper transition hover:bg-clay-deep"
      >
        Got it
      </button>
      {skippable && (
        <p className="mt-3 text-right">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-ink-soft underline decoration-dotted underline-offset-2 transition hover:text-ink"
          >
            Skip — I know this one
          </button>
        </p>
      )}
    </div>
  )
}
