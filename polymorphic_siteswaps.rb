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

  def self.generate(period:, left_beats:, right_beats:, number_of_balls:, throws:, allow_crosses: true, debug: false)
    new(
      period: period, left_beats: left_beats, right_beats: right_beats,
      number_of_balls: number_of_balls, throws: throws,
      allow_crosses: allow_crosses, debug: debug
    ).generate
  end

  attr_reader :period, :left_beats, :right_beats, :number_of_balls, :throws,
              :allow_crosses, :debug

  def initialize(period:, left_beats:, right_beats:, number_of_balls:, throws:, allow_crosses: true, debug: false)
    raise ArgumentError, "throw values must be even" if throws.any?(&:odd?)
    raise ArgumentError, "throw values must be ≤ 35 (single base-36 char)" if throws.any? { |v| v > 35 }
    @period          = period
    @left_beats      = left_beats
    @right_beats     = right_beats
    @number_of_balls = number_of_balls
    @throws          = throws
    @allow_crosses   = allow_crosses
    @debug           = debug
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
  # Extended: a cross throw may also target a non-active intermediate beat, placing
  # a hold in the catching hand until its next active slot. Any cross value is
  # valid — small crosses (2x, 4x) are fast zips, like 2x in standard sync. The
  # "functional 2x" scales with each polyrhythm (min_cross_value = 2 *
  # min_beat_spacing): 4x for 3-over-2, 6x for 4-over-3, 8x for 5-over-4.
  # Intermediate crosses below this threshold are fast zips — the catching hand
  # must have no active beats during transit. Crosses at or above are normal
  # speed and skip the transit check.
  def search
    t0       = Time.now
    @results = []
    @seen    = {}
    @nodes   = 0
    slots  = strict_throw_slots
    holes  = init_holes(slots)
    chosen = Array.new(slots.size)
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
        # No transit check or minimum for direct crosses: if it lands on an active
        # slot, it's valid. Small crosses (2x, 4x) are fast zips — the same as in
        # standard sync.
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

    # --- Intermediate cross: land at a non-active beat, hold to next active slot ---
    #
    # For fast zips (v_cross < min_cross_value), the catching hand must have no
    # active beats during transit. Normal-speed crosses skip this check. The sum
    # contribution equals v_cross + v_hold, identical to a direct throw landing
    # at next_active, so the target constraint is preserved.
    if allow_crosses
      lh       = hand ^ 1
      lh_beats = lh == 0 ? left_beats : right_beats

      (0...period).each do |lb|
        next if lh_beats.include?(lb)  # only non-active beats for the catching hand

        diff    = (lb - beat + period) % period
        next if diff.zero?
        v_cross = 2 * diff
        next unless throw_set.include?(v_cross)
        next if v_cross < min_cross_value && catching_hand_busy_during_transit?(beat, lb, lh)

        next_active = next_active_beat(lh, lb)
        next if holes[next_active][lh].zero?

        v_hold = 2 * ((next_active - lb + period) % period)
        next unless throw_set.include?(v_hold)

        new_sum = sum + v_cross + v_hold
        next if new_sum > target
        next if new_sum + remaining * throws.max < target

        holes[next_active][lh] -= 1
        chosen[k] = [v_cross, true, lb, lh, v_hold]
        fill_slot(slots, k + 1, holes, chosen, new_sum)
        holes[next_active][lh] += 1
      end
    end
  end

  def build_beat_arr(slots, chosen)
    beat_arr = Array.new(period) { [Throw.new(0, false), Throw.new(0, false)] }
    slots.each_with_index do |(beat, hand), k|
      entry = chosen[k]
      if entry.size == 5
        # Intermediate cross: cross throw at active beat + hold at intermediate beat
        v_cross, _, lb, lh, v_hold = entry
        beat_arr[beat][hand] = Throw.new(v_cross, true)
        beat_arr[lb][lh]     = Throw.new(v_hold, false)
      else
        v, cross = entry
        beat_arr[beat][hand] = Throw.new(v, cross)
      end
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

  def min_cross_value
    @min_cross_value ||= 2 * [beat_spacing(left_beats), beat_spacing(right_beats)].min
  end

  def beat_spacing(beats)
    period / beats.size
  end

  # --- Cross throw helpers ---

  # Returns the next active beat for +hand+ strictly after +from_beat+,
  # wrapping around the period. +from_beat+ is guaranteed non-active for +hand+.
  def next_active_beat(hand, from_beat)
    beats = hand == 0 ? left_beats : right_beats
    beats.min_by { |b| d = (b - from_beat + period) % period; d.zero? ? period : d }
  end

  # True if the catching hand has any active beat strictly between +throw_beat+
  # and +land_beat+ (exclusive, wrapping around the period).
  def catching_hand_busy_during_transit?(throw_beat, land_beat, catching_hand)
    catching_beats = catching_hand == 0 ? left_beats : right_beats
    land_offset    = (land_beat - throw_beat + period) % period
    land_offset    = period if land_offset.zero?
    catching_beats.any? do |b|
      offset = (b - throw_beat + period) % period
      offset > 0 && offset < land_offset
    end
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
