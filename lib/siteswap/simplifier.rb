require_relative 'notation'

# Converts a generator beat array into a simplified notation sequence.
#
# Input: [[left_throw, right_throw], ...] as produced by the generator.
#        Each throw is a Siteswap::Notation::Throw responding to :value and :cross.
#
# Output: [SyncBeat | SuppressedSyncBeat | AsyncThrow | EmptySlot, ...] (see Siteswap::Notation)
#
# Rule 1 – Halve: divide every throw value by 2, mark all beats suppressed (!).
#   Halving can flip parity, which must be compensated by toggling x:
#     v mod 4 == 0 → v/2 is even, parity unchanged → keep x as-is
#     v mod 4 == 2 → v/2 is odd,  parity flipped  → toggle x
#
# Rule 2 – Cancel: X!(0,0)! → X (un-suppressed).
#   Consecutive suppressed beats whose second is empty collapse into one normal beat.
#
# Rule 3 – Single-hand suppressed: (N,0)! or (0,N)! → AsyncThrow(N)
# Rule 4 – Single-hand un-suppressed: (N,0) or (0,N) → AsyncThrow(N), EmptySlot
class SiteswapSimplifier
  SyncBeat           = Siteswap::Notation::SyncBeat
  SuppressedSyncBeat = Siteswap::Notation::SuppressedSyncBeat
  AsyncThrow         = Siteswap::Notation::AsyncThrow
  EmptySlot          = Siteswap::Notation::EmptySlot
  HandAnnotation     = Siteswap::Notation::HandAnnotation
  Throw              = Siteswap::Notation::Throw

  def initialize(verbose: false)
    @verbose = verbose
  end

  def simplify(beat_arr, verbose: @verbose)
    log_raw(beat_arr) if verbose
    beats = to_beats(beat_arr)
    beats = halve(beats)
    log("after halve", beats) if verbose
    beats = cancel_pairs(beats)
    log("after cancel_pairs", beats) if verbose
    result = expand(beats)
    log("after expand", result) if verbose
    result
  end

  private

  def log_raw(beat_arr)
    str = beat_arr.map { |l, r| "(#{fmt(l)},#{fmt(r)})" }.join
    $stdout.puts "  [raw]: #{str}"
  end

  def log(label, elements)
    $stdout.puts "  [#{label}]: #{render(elements)}"
  end

  def render(elements)
    elements.map { |el|
      case el
      when SuppressedSyncBeat then "(#{fmt(el.left)},#{fmt(el.right)})!"
      when SyncBeat           then "(#{fmt(el.left)},#{fmt(el.right)})"
      when AsyncThrow         then fmt(el.throw)
      when HandAnnotation     then el.hand == :right ? "R" : "L"
      when EmptySlot          then "0"
      end
    }.join
  end

  def fmt(t)
    s = t.value.to_s(36)
    t.cross ? "#{s}x" : s
  end

  def to_beats(beat_arr)
    beat_arr.map { |l, r| SuppressedSyncBeat.new(left: l, right: r) }
  end

  # Rule 1
  def halve(beats)
    beats.map { |b| SuppressedSyncBeat.new(left: halve_throw(b.left), right: halve_throw(b.right)) }
  end

  def halve_throw(t)
    v     = t.value / 2
    cross = (t.value % 4 == 2) ? !t.cross : t.cross
    Throw.new(value: v, cross: cross)
  end

  # Rule 2
  def cancel_pairs(beats)
    result = []
    i = 0
    while i < beats.size
      b   = beats[i]
      nxt = beats[i + 1]
      if b.is_a?(SuppressedSyncBeat) && nxt&.is_a?(SuppressedSyncBeat) && nxt.empty?
        result << b.cancel
        i += 2
      else
        result << b
        i += 1
      end
    end
    result
  end

  # Rules 3 & 4
  def expand(beats)
    result    = []
    saw_sync  = false
    in_async  = false

    beats.each do |b|
      if b.single_hand?
        if saw_sync && !in_async
          result << HandAnnotation.new(b.left.value.zero? ? :right : :left)
          in_async = true
        end
        result << AsyncThrow.new(throw: b.active_throw)
        result << EmptySlot.new unless b.is_a?(SuppressedSyncBeat)
      else
        saw_sync = true
        in_async = false
        result << b
      end
    end

    result
  end
end
