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

# Serializes halved notation elements into an array of beat token hashes
# for structured UI rendering.
#
# Input: array of SuppressedSyncBeat (i.e. elements from PRESETS[:halved]).
#
# Output: array of hashes, one per beat:
#   { kind: "rest" }
#   { kind: "left",  left:  "5x" }
#   { kind: "right", right: "4"  }
#   { kind: "sync",  left:  "4x", right: "6" }
#
# This lets the site visually distinguish rest beats from active throws,
# and left-hand throws from right-hand throws, without any JS parsing logic.
class SiteswapBeatsFormatter
  SuppressedSyncBeat = Siteswap::Notation::SuppressedSyncBeat

  def format(elements)
    elements.map { |b| classify(b) }
  end

  private

  def classify(b)
    suppressed = b.is_a?(SuppressedSyncBeat)
    if b.empty?
      { kind: "rest", suppressed: suppressed }
    elsif b.left.value.zero?
      { kind: "right", right: fmt(b.right), suppressed: suppressed }
    elsif b.right.value.zero?
      { kind: "left", left: fmt(b.left), suppressed: suppressed }
    else
      { kind: "sync", left: fmt(b.left), right: fmt(b.right), suppressed: suppressed }
    end
  end

  def fmt(t)
    s = t.value <= 35 ? t.value.to_s(36) : "{#{t.value}}"
    t.cross ? "#{s}x" : s
  end
end

# Formats a raw beat array into a hash of named representations,
# each with its own transform pipeline and output formatter.
#
# Presets map a name to a config hash:
#   { transforms: [transform, ...], formatter: <formatter> }
#
# Example:
#   SiteswapMultiFormatter.new(presets: {
#     halved:     { transforms: [HALVE],                    formatter: SiteswapFormatter.new },
#     simplified: { transforms: [HALVE, CANCEL_PAIRS, EXPAND], formatter: SiteswapFormatter.new },
#     beats:      { transforms: [HALVE],                    formatter: SiteswapBeatsFormatter.new },
#   })
#
# Calling format(beat_arr) returns:
#   { halved: "(4x,6)!...", simplified: "(4x,6)R4x550", beats: [{kind: "sync", ...}, ...] }
class SiteswapMultiFormatter
  SuppressedSyncBeat = Siteswap::Notation::SuppressedSyncBeat

  def initialize(presets:)
    @presets = presets
  end

  def format(beat_arr)
    raw = beat_arr.map { |l, r| SuppressedSyncBeat.new(left: l, right: r) }
    @presets.transform_values do |config|
      elements = config[:transforms].reduce(raw) { |els, t| t.call(els) }
      config[:formatter].format(elements)
    end
  end
end
