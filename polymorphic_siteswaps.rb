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

  THREE_OVER_TWO_2CYCLE_SPEC = {
    single_cycle_period: 6,
    num_cycles:          2,
    left_beats:          [0, 3, 6, 9],
    right_beats:         [0, 2, 4, 6, 8, 10],
  }.freeze

  FOUR_OVER_THREE_SPEC = {
    period:      12,
    left_beats:  [0, 4, 8],
    right_beats: [0, 3, 6, 9],
  }.freeze

  FIVE_OVER_TWO_SPEC = {
    period:      10,
    left_beats:  [0, 5],
    right_beats: [0, 2, 4, 6, 8],
  }.freeze

  FIVE_OVER_THREE_SPEC = {
    period:      15,
    left_beats:  [0, 5, 10],
    right_beats: [0, 3, 6, 9, 12],
  }.freeze

  FIVE_OVER_FOUR_SPEC = {
    period:      20,
    left_beats:  [0, 5, 10, 15],
    right_beats: [0, 4, 8, 12, 16],
  }.freeze

  def self.three_over_two(number_of_balls:, throws:, debug: false)
    generate(**THREE_OVER_TWO_SPEC, number_of_balls: number_of_balls, throws: throws, debug: debug)
  end

  def self.three_over_two_2cycle(number_of_balls:, throws:, debug: false)
    generate(**THREE_OVER_TWO_2CYCLE_SPEC, number_of_balls: number_of_balls, throws: throws, debug: debug)
  end

  def self.four_over_three(number_of_balls:, throws:, debug: false)
    generate(**FOUR_OVER_THREE_SPEC, number_of_balls: number_of_balls, throws: throws, debug: debug)
  end

  def self.five_over_two(number_of_balls:, throws:, debug: false)
    generate(**FIVE_OVER_TWO_SPEC, number_of_balls: number_of_balls, throws: throws, debug: debug)
  end

  def self.five_over_three(number_of_balls:, throws:, debug: false)
    generate(**FIVE_OVER_THREE_SPEC, number_of_balls: number_of_balls, throws: throws, debug: debug)
  end

  def self.five_over_four(number_of_balls:, throws:, debug: false)
    generate(**FIVE_OVER_FOUR_SPEC, number_of_balls: number_of_balls, throws: throws, debug: debug)
  end

  def self.generate(period: nil, left_beats:, right_beats:, number_of_balls:, throws:, allow_crosses: true, single_cycle_period: nil, num_cycles: nil, debug: false)
    resolved_period = single_cycle_period && num_cycles ? single_cycle_period * num_cycles : period
    raise ArgumentError, "period or (single_cycle_period + num_cycles) required" unless resolved_period
    new(
      period: resolved_period, left_beats: left_beats, right_beats: right_beats,
      number_of_balls: number_of_balls, throws: throws,
      allow_crosses: allow_crosses, single_cycle_period: single_cycle_period,
      num_cycles: num_cycles, debug: debug
    ).generate
  end

  attr_reader :period, :left_beats, :right_beats, :number_of_balls, :throws,
              :allow_crosses, :single_cycle_period, :num_cycles, :debug

  def initialize(period:, left_beats:, right_beats:, number_of_balls:, throws:, allow_crosses: true, single_cycle_period: nil, num_cycles: nil, debug: false)
    raise ArgumentError, "throw values must be even" if throws.any?(&:odd?)
    raise ArgumentError, "throw values must be ≤ 35 (single base-36 char)" if throws.any? { |v| v > 35 }
    @period              = period
    @left_beats          = left_beats
    @right_beats         = right_beats
    @number_of_balls     = number_of_balls
    @throws              = throws
    @allow_crosses       = allow_crosses
    @single_cycle_period = single_cycle_period
    @num_cycles          = num_cycles
    @debug               = debug
  end

  def generate
    categorize(search)
  end

  private

  # --- Categorization ---

  def categorize(patterns)
    crossing       = patterns.select { |b| has_cross?(b) }
    ground, active = partition_by_ground_state(crossing)

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

  def has_cross?(beats)
    beats.any? { |l, r| l.cross || r.cross }
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
  # All crosses must land directly on an active beat of the catching hand.
  # Any cross value is permitted provided it satisfies this constraint — small
  # crosses (e.g. 2x landing directly on an active beat) are allowed, as jugglers
  # can accommodate fast throws with dwell time adjustments.
  def search
    t0       = Time.now
    @results = []
    @seen    = {}
    @nodes   = 0
    slots  = strict_throw_slots
    holes  = init_holes(slots)
    chosen = Array.new(slots.size)

    # For multi-cycle patterns, build a checkpoint at each intermediate cycle
    # boundary (all except the last). At each checkpoint, we verify that at
    # least one throw from the preceding cycles has landed in the remaining
    # cycles — otherwise the pattern resolves early and is not genuinely N-cycle.
    # Keyed by slot index for O(1) lookup in fill_slot.
    @cycle_checkpoints = {}
    if single_cycle_period && num_cycles && num_cycles > 1
      (1...num_cycles).each do |i|
        boundary = single_cycle_period * i
        slot_idx = slots.index { |beat, _| beat >= boundary }
        @cycle_checkpoints[slot_idx] = slots.select { |beat, _| beat >= boundary }
      end
    end

    fill_slot(slots, 0, holes, chosen, 0)
    log_timing(t0, @nodes, @results.size) if debug
    @results
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

  # holes[beat][hand] = 1 for each throw slot; 0 elsewhere.
  def init_holes(slots)
    h = Array.new(period) { [0, 0] }
    slots.each { |beat, hand| h[beat][hand] = 1 }
    h
  end

  def fill_slot(slots, k, holes, chosen, sum)
    @nodes += 1

    # Multi-cycle pruning: at each intermediate cycle boundary, verify that at
    # least one throw from the preceding beats has landed in the remaining beats.
    # If not, the pattern has resolved to ground state early — prune.
    if (remaining = @cycle_checkpoints[k])
      return unless remaining.any? { |b, h| holes[b][h].zero? }
    end

    if k == slots.size
      add_result(build_beat_arr(slots, chosen)) if sum == target
      return
    end

    beat, hand = slots[k]
    remaining  = slots.size - k - 1

    # --- Direct landing at an active slot ---
    #
    # Iterate over throw values rather than landing beats so that values exceeding
    # 2*period are reachable. Two different values may land at the same slot
    # (e.g. v=2 and v=14 in a period-6 pattern both land at beat+1); they are
    # distinct throws — same timing, different height — and both are generated.
    throws.each do |v|
      next if v.zero?
      [false, true].each do |cross|
        next if cross && !allow_crosses
        lh = cross ? hand ^ 1 : hand
        lb = (beat + v / 2) % period
        next if holes[lb][lh].zero?

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

  def target
    @target ||= number_of_balls * period * 2
  end

  def throw_set
    @throw_set ||= throws.to_set
  end

  # --- Pattern operations ---

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
