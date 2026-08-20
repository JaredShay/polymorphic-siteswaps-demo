require_relative 'notation'

# Serializes a notation sequence into a siteswap string.
class SiteswapFormatter
  SyncBeat           = Siteswap::Notation::SyncBeat
  SuppressedSyncBeat = Siteswap::Notation::SuppressedSyncBeat
  AsyncThrow         = Siteswap::Notation::AsyncThrow
  EmptySlot          = Siteswap::Notation::EmptySlot
  HandAnnotation     = Siteswap::Notation::HandAnnotation

  def format(elements)
    elements.map { |el| render(el) }.join
  end

  private

  def render(el)
    case el
    when SuppressedSyncBeat then "(#{fmt_throw(el.left)},#{fmt_throw(el.right)})!"
    when SyncBeat           then "(#{fmt_throw(el.left)},#{fmt_throw(el.right)})"
    when AsyncThrow         then fmt_throw(el.throw)
    when HandAnnotation     then el.hand == :right ? "R" : "L"
    when EmptySlot          then "0"
    else raise TypeError, "unexpected notation element: #{el.class}"
    end
  end

  def fmt_throw(t)
    s = t.value <= 35 ? t.value.to_s(36) : "{#{t.value}}"
    t.cross ? "#{s}x" : s
  end
end

# Formats a raw beat array into a hash of named string representations,
# applying a separate transform pipeline per preset.
#
# Each preset entry maps a name to an array of transforms (e.g. from
# SiteswapSimplifier::PRESETS). The result is a plain Hash keyed by those names.
#
#   formatter = SiteswapMultiFormatter.new(
#     presets: { halved: [HALVE], simplified: [HALVE, CANCEL_PAIRS, EXPAND] }
#   )
#   formatter.format(beat_arr)
#   # => { halved: "(4x,6)!...", simplified: "(4x,6)R4x550" }
class SiteswapMultiFormatter
  SuppressedSyncBeat = Siteswap::Notation::SuppressedSyncBeat

  def initialize(presets:, formatter: SiteswapFormatter.new)
    @presets   = presets
    @formatter = formatter
  end

  def format(beat_arr)
    raw = beat_arr.map { |l, r| SuppressedSyncBeat.new(left: l, right: r) }
    @presets.transform_values do |transforms|
      elements = transforms.reduce(raw) { |els, t| t.call(els) }
      @formatter.format(elements)
    end
  end
end
