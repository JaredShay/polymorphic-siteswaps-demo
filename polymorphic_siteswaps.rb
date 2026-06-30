require 'set'

class PolymorphicSiteswaps
  Throw = Struct.new(:value, :cross) do
    def empty? = value.zero?
  end

  THREE_OVER_TWO_SPEC = {
    period:      6,
    left_beats:  [0, 3],
    right_beats: [0, 2, 4],
  }.freeze

  FOUR_OVER_THREE_SPEC = {
    period:      12,
    left_beats:  [0, 4, 8],
    right_beats: [0, 3, 6, 9],
  }.freeze

  def self.three_over_two(number_of_balls:, throws:, **opts)
    generate(**THREE_OVER_TWO_SPEC, number_of_balls: number_of_balls, throws: throws, **opts)
  end

  def self.four_over_three(number_of_balls:, throws:, **opts)
    generate(**FOUR_OVER_THREE_SPEC, number_of_balls: number_of_balls, throws: throws, **opts)
  end

  def self.generate(period:, left_beats:, right_beats:, number_of_balls:, throws:, allow_crosses: true, strict_rhythm: true, min_throw_beats: 3, max_gap: 3, debug: false)
    new(
      period: period, left_beats: left_beats, right_beats: right_beats,
      number_of_balls: number_of_balls, throws: throws,
      allow_crosses: allow_crosses, strict_rhythm: strict_rhythm,
      min_throw_beats: min_throw_beats, max_gap: max_gap, debug: debug
    ).generate
  end

  attr_reader :period, :left_beats, :right_beats, :number_of_balls, :throws,
              :allow_crosses, :strict_rhythm, :min_throw_beats, :max_gap, :debug

  def initialize(period:, left_beats:, right_beats:, number_of_balls:, throws:, allow_crosses: true, strict_rhythm: true, min_throw_beats: 3, max_gap: 3, debug: false)
    raise ArgumentError, "throw values must be even" if throws.any?(&:odd?)
    @period          = period
    @left_beats      = left_beats
    @right_beats     = right_beats
    @number_of_balls = number_of_balls
    @throws          = throws
    @allow_crosses   = allow_crosses
    @strict_rhythm   = strict_rhythm
    @min_throw_beats = min_throw_beats
    @max_gap         = max_gap
    @debug           = debug
  end

  def generate
    categorize(search)
  end

  private

  # --- Categorization ---

  def categorize(patterns)
    with_feel      = patterns.select { |b| polyrhythm_feel?(b) }
    crossing       = with_feel.select { |b| has_cross?(b) }
    with_rest      = crossing.select { |b| has_rest_beat?(b) }
    ground, active = partition_by_ground_state(with_rest)

    {
      ground: to_strings(ground),
      active: to_strings(active),
    }
  end

  def partition_by_ground_state(patterns)
    return [[], []] if patterns.empty?
    by_state     = patterns.group_by { |b| beat_state(b) }
    ground_state = by_state.keys.min_by { |s| s.sum { |rel, _| rel } }
    patterns.partition { |b| beat_state(b) == ground_state }
  end

  def to_strings(patterns)
    patterns.map { |b| unparse(b) }
  end

  def polyrhythm_feel?(beats)
    both_hands_throw?(beats) && throw_feel?(active_throw_beats(beats))
  end

  def throw_feel?(throw_beats)
    throw_beats.size >= min_throw_beats && max_circular_gap(throw_beats) <= max_gap
  end

  def both_hands_throw?(beats)
    beats.any? { |l, _| !l.empty? } && beats.any? { |_, r| !r.empty? }
  end

  def active_throw_beats(beats)
    beats.each_index.select { |i| !beats[i][0].empty? || !beats[i][1].empty? }
  end

  def max_circular_gap(throw_beats)
    gaps = throw_beats.each_cons(2).map { |a, b| b - a }
    gaps << (period - throw_beats.last + throw_beats.first)
    gaps.max
  end

  def has_cross?(beats)
    beats.any? { |l, r| l.cross || r.cross }
  end

  # At least one active beat must have a hand that is effectively "resting" —
  # either empty (0) or throwing the hold sentinel value straight (non-crossing).
  # Without this filter, patterns where both hands are actively throwing on every
  # beat collapse into fancy sync rather than feeling like a polyrhythm.
  def has_rest_beat?(beats)
    active_beats.any? do |i|
      l, r = beats[i]
      rest_throw?(l) || rest_throw?(r)
    end
  end

  def rest_throw?(t)
    t.empty? || (t.value == hold_value && !t.cross)
  end

  # The natural carry value of the faster sub-rhythm: 2 × the beat spacing of
  # whichever hand throws more often. At juggling tempo this throw lands exactly
  # at the next beat for that sub-rhythm, making it feel like a hold rather than
  # an active throw. A crossed version (hold_value + x) is explicitly excluded —
  # crossing to the other hand requires a deliberate action and is never passive.
  #
  # This is a practical tempo concern, not a mathematical one: the same value is
  # logically a valid throw, but physically it blurs into a carry at speed. The
  # caller controls which values appear via the throws array; this sentinel just
  # tells the filter which of those values to treat as "not really throwing."
  def hold_value
    @hold_value ||= [period / left_beats.size, period / right_beats.size].min * 2
  end

  # --- Search ---
  #
  # JugglingLab-style holes-based DFS.
  #
  # holes[beat][hand] = 1 for each designated throw slot (left hand at left_beats,
  # right hand at right_beats). Each throw fills one landing slot by decrementing it.
  # The throw value is determined by the beat distance: v = 2 * ((lb - beat + P) % P).
  # A pattern is valid when all holes reach 0 and the sum equals target.
  #
  # Branching factor per slot = number of unfilled holes (≤ N_slots), not throws².
  # For 4-over-3 with 7 slots: at most 7! = 5040 paths vs the prior 25⁶ = 244M.
  def search
    t0       = Time.now
    @results = []
    @seen    = {}
    @nodes   = 0
    slot_configs.each do |slots|
      holes  = init_holes(slots)
      chosen = Array.new(slots.size)
      fill_slot(slots, 0, holes, chosen, 0)
    end
    log_timing(t0, @nodes, @results.size) if debug
    @results
  end

  # In strict_rhythm mode: one fixed config where each hand throws only at its
  # designated beats. In free mode: all valid subsets of active (beat, hand) pairs
  # whose size K satisfies the sum constraint — same holes DFS, more configs.
  def slot_configs
    strict_rhythm ? [strict_throw_slots] : free_throw_slot_configs
  end

  # Left hand at left_beats, right hand at right_beats.
  def strict_throw_slots
    slots = []
    (0...period).each do |b|
      slots << [b, 0] if left_beats.include?(b)
      slots << [b, 1] if right_beats.include?(b)
    end
    slots
  end

  # All subsets of (beat, hand) pairs from the combined active beats where the
  # subset size K can possibly satisfy the sum constraint with available throw values.
  def free_throw_slot_configs
    all_slots   = active_beats.flat_map { |b| [[b, 0], [b, 1]] }
    pos_throws  = throws.select { |v| v > 0 }
    min_k       = (target.to_f / pos_throws.max).ceil
    max_k       = [all_slots.size, target / pos_throws.min].min
    (min_k..max_k).flat_map { |k| all_slots.combination(k).to_a }
  end

  # holes[beat][hand] = 1 for each throw slot; 0 elsewhere.
  def init_holes(slots)
    h = Array.new(period) { [0, 0] }
    slots.each { |beat, hand| h[beat][hand] = 1 }
    h
  end

  def fill_slot(slots, k, holes, chosen, sum)
    @nodes += 1
    if k == slots.size
      add_result(build_beat_arr(slots, chosen)) if sum == target
      return
    end

    beat, hand = slots[k]
    remaining  = slots.size - k - 1

    (0...period).each do |lb|
      (0..1).each do |lh|
        next if holes[lb][lh].zero?
        diff = (lb - beat + period) % period
        v    = diff.zero? ? 2 * period : 2 * diff
        next unless throw_set.include?(v)
        cross   = lh != hand
        next if cross && !allow_crosses
        new_sum = sum + v
        next if new_sum > target
        next if new_sum + remaining * throws.max < target

        holes[lb][lh] -= 1
        chosen[k] = [v, cross]
        fill_slot(slots, k + 1, holes, chosen, new_sum)
        holes[lb][lh] += 1
      end
    end
  end

  def build_beat_arr(slots, chosen)
    beat_arr = Array.new(period) { [Throw.new(0, false), Throw.new(0, false)] }
    slots.each_with_index do |(beat, hand), k|
      v, cross = chosen[k]
      beat_arr[beat][hand] = Throw.new(v, cross)
    end
    beat_arr
  end

  def add_result(beat_arr)
    key = unparse(canonical_rotation(beat_arr))
    return if @seen[key]
    @seen[key] = true
    mirror_key = unparse(canonical_rotation(mirror(beat_arr)))
    @seen[mirror_key] = true unless mirror_key == key
    @results << beat_arr
  end

  # --- Derived spec values ---

  def active_beats
    @active_beats ||= (left_beats + right_beats).uniq.sort
  end

  def target
    @target ||= number_of_balls * period * 2
  end

  def throw_set
    @throw_set ||= throws.to_set
  end

  # --- Pattern operations (shared) ---

  def beat_state(beats)
    state = []
    beats.each_with_index do |(l, r), i|
      [[0, l], [1, r]].each do |throw_hand, t|
        next if t.empty?
        land_hand = throw_hand ^ (t.cross ? 1 : 0)
        rel       = i + t.value / 2 - period
        state << [rel, land_hand] if rel >= 0
      end
    end
    state.sort
  end

  def canonical_rotation(beats)
    starts = rotation_start_candidates(beats)
    starts.map { |r| beats.rotate(r) }.min_by { |rot| unparse(rot) }
  end

  def rotation_start_candidates(beats)
    both = (0...period).select { |r| !beats[r][0].empty? && !beats[r][1].empty? }
    both.any? ? both : (0...period).select { |r| !beats[r][0].empty? || !beats[r][1].empty? }
  end

  def mirror(beats)
    beats.map { |l, r| [r, l] }
  end

  def unparse(beats)
    beats.map { |l, r| "(#{fmt_throw(l)},#{fmt_throw(r)})" }.join
  end

  def fmt_throw(t)
    s = t.value.to_s(36)
    t.cross ? "#{s}x" : s
  end

  # --- Timing ---

  def log_timing(t0, nodes, raw_count)
    elapsed = Time.now - t0
    $stderr.puts "generate: #{"%.3f" % elapsed}s | nodes: #{nodes} | raw: #{raw_count}"
  end
end
