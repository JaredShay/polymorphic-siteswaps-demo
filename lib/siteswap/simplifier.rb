require_relative 'notation'

# Converts a generator beat array into a simplified notation sequence.
#
# Input: [[left_throw, right_throw], ...] as produced by the generator.
#        Each throw responds to :value and :cross.
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
  Throw              = Siteswap::Notation::Throw

  def simplify(beat_arr)
    beats = to_beats(beat_arr)
    beats = halve(beats)
    beats = cancel_pairs(beats)
    expand(beats)
  end

  private

  def to_beats(beat_arr)
    beat_arr.map do |l, r|
      SuppressedSyncBeat.new(Throw.new(l.value, l.cross), Throw.new(r.value, r.cross))
    end
  end

  # Rule 1
  def halve(beats)
    beats.map { |b| SuppressedSyncBeat.new(halve_throw(b.left), halve_throw(b.right)) }
  end

  def halve_throw(t)
    v     = t.value / 2
    cross = (t.value % 4 == 2) ? !t.cross : t.cross
    Throw.new(v, cross)
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
    beats.flat_map do |b|
      next [b] unless b.single_hand?
      b.is_a?(SuppressedSyncBeat) ? [AsyncThrow.new(b.active_throw)] : [AsyncThrow.new(b.active_throw), EmptySlot.new]
    end
  end
end
