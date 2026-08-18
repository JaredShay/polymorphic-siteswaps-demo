# Converts a fully-sync polymorphic siteswap string into a compact mixed
# sync/async ("vanilla") form. All generated patterns have even throw values,
# which makes the following simplification valid:
#
# Rule 1 – Halve: divide every throw value by 2 and suppress every beat (!).
#   Equivalent pattern at double tempo.
#
#   A throw crosses iff (value is odd) XOR (marked x).
#   Halving can flip the parity of a value, which must be compensated by toggling x:
#     v mod 4 == 0 → v/2 is even, parity unchanged → keep x as-is
#     v mod 4 == 2 → v/2 is odd,  parity flipped  → toggle x
#   This applies uniformly to every throw, regardless of beat type.
#
# Rule 2 – Cancel: X!(0,0)! → X  (un-suppressed).
#   Two consecutive suppressed beats whose second is empty cancel out; the
#   pair collapses into one normal beat. Applied left-to-right in a single
#   pass (patterns have at most one round of cancellations).
#
# Rule 3 – Single-hand suppressed: (N,0)! or (0,N)! → N
#   A one-hand-only sync beat with ! converts to a single async throw.
#   No trailing 0 because ! already suppresses the implicit empty half-beat.
#
# Rule 4 – Single-hand un-suppressed: (N,0) or (0,N) → N0
#   Same conversion but without !, so the implicit empty half-beat remains
#   and is written explicitly as 0.
class SiteswapSimplifier
  Beat  = Struct.new(:left, :right, :suppressed) do
    def empty?       = left.value.zero? && right.value.zero?
    def single_hand? = left.value.zero? ^ right.value.zero?
    def active_throw = left.value.zero? ? right : left
  end

  Throw = Struct.new(:value, :cross)

  BEAT_RE = /\(([0-9a-z]x?),([0-9a-z]x?)\)(!?)/

  def self.simplify(siteswap_str)
    new(siteswap_str).simplify
  end

  attr_reader :original
  def initialize(siteswap_str)
    @original = siteswap_str
  end

  def simplify
    beats = parse(original)
    beats = halve(beats)
    beats = cancel_pairs(beats)
    result = unparse(beats)
    result
  end

  private

  def parse(str)
    str.scan(BEAT_RE).map do |l, r, bang|
      Beat.new(parse_throw(l), parse_throw(r), bang == '!')
    end
  end

  def parse_throw(s)
    cross = s.end_with?('x')
    value = (cross ? s.chomp('x') : s).to_i(36)
    Throw.new(value, cross)
  end

  # Rule 1: halve all values, suppress all beats.
  # Toggle x whenever v mod 4 == 2, to preserve the physical crossing direction
  # after parity flips.
  def halve(beats)
    beats.map { |b| Beat.new(halve_throw(b.left), halve_throw(b.right), true) }
  end

  def halve_throw(t)
    v    = t.value / 2
    cross = (t.value % 4 == 2) ? !t.cross : t.cross
    Throw.new(v, cross)
  end

  # Rule 2: collapse X!(0,0)! → X (un-suppressed), scanning left-to-right.
  def cancel_pairs(beats)
    result = []
    i = 0
    while i < beats.size
      b   = beats[i]
      nxt = beats[i + 1]
      if b.suppressed && nxt&.suppressed && nxt.empty?
        result << Beat.new(b.left, b.right, false)
        i += 2
      else
        result << b
        i += 1
      end
    end
    result
  end

  # Emit each beat using the appropriate notation form.
  def unparse(beats)
    beats.flat_map do |b|
      if b.single_hand?
        # Rules 3/4
        token = fmt_throw(b.active_throw)
        b.suppressed ? [token] : [token, "0"]
      elsif b.empty?
        # Shouldn't normally survive cancellation, but handle gracefully
        ["(0,0)#{b.suppressed ? '!' : ''}"]
      else
        ["(#{fmt_throw(b.left)},#{fmt_throw(b.right)})#{b.suppressed ? '!' : ''}"]
      end
    end.join
  end

  # After halving, the x flag already encodes the correct physical crossingso x
  # is emitted as-is in all cases.
  def fmt_throw(t)
    s = t.value.to_s(36)
    t.cross ? "#{s}x" : s
  end

  def beats_to_sync_str(beats)
    beats.map { |b| "(#{fmt_throw(b.left)},#{fmt_throw(b.right)})#{b.suppressed ? '!' : ''}" }.join
  end
end
