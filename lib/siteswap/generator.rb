require 'set'
require_relative 'notation'
require_relative 'simplifier'
require_relative 'formatter'

class PolymorphicSiteswaps
  Throw = Siteswap::Notation::Throw

  DEFAULT_SIMPLIFIER = SiteswapSimplifier.new.freeze
  DEFAULT_FORMATTER  = SiteswapFormatter.new.freeze

  def self.generate(
    period: nil,
    left_beats:,
    right_beats:,
    number_of_balls:,
    throws:,
    single_cycle_period: nil,
    num_cycles: nil,
    debug: false,
    simplifier: DEFAULT_SIMPLIFIER,
    formatter: DEFAULT_FORMATTER
  )
    resolved_period = single_cycle_period && num_cycles ? single_cycle_period * num_cycles : period
    raise ArgumentError, "period or (single_cycle_period + num_cycles) required" unless resolved_period

    new(
      period: resolved_period,
      left_beats: left_beats,
      right_beats: right_beats,
      number_of_balls: number_of_balls,
      throws: throws,
      single_cycle_period: single_cycle_period,
      num_cycles: num_cycles,
      debug: debug,
      simplifier: simplifier,
      formatter: formatter
    ).generate
  end

  attr_reader :period,
    :left_beats,
    :right_beats,
    :number_of_balls,
    :throws,
    :single_cycle_period,
    :num_cycles,
    :debug,
    :simplifier,
    :formatter

  def initialize(
    period:,
    left_beats:,
    right_beats:,
    number_of_balls:,
    throws:,
    single_cycle_period: nil,
    num_cycles: nil,
    debug: false,
    simplifier: DEFAULT_SIMPLIFIER,
    formatter: DEFAULT_FORMATTER
  )
    raise ArgumentError, "throw values must be even" unless Siteswap::Types::ThrowList.valid?(throws)

    @period              = period
    @left_beats          = left_beats
    @right_beats         = right_beats
    @number_of_balls     = number_of_balls
    @throws              = throws
    @single_cycle_period = single_cycle_period
    @num_cycles          = num_cycles
    @debug               = debug
    @simplifier          = simplifier
    @formatter           = formatter
  end

  def generate
    categorize(search)
  end

  private

  def categorize(patterns)
    crossing       = patterns.select { |b| has_cross?(b) }
    ground, active = partition_by_ground_state(crossing)

    {
      ground: format_patterns(ground),
      active: format_patterns(active),
    }
  end

  def format_patterns(patterns)
    patterns.map { |beat_arr| formatter.format(simplifier.simplify(beat_arr).elements) }
  end

  def partition_by_ground_state(patterns)
    return [[], []] if patterns.empty?

    by_state     = patterns.group_by { |b| beat_state(b) }
    ground_state = by_state.keys.min_by { |s| s.sum { |rel, _| rel } }
    patterns.partition { |b| beat_state(b) == ground_state }
  end

  # The patterns generated here are not interesting if they don't have crossing
  # throws
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
        lh = cross ? hand ^ 1 : hand
        lb = (beat + v / 2) % period
        next if holes[lb][lh].zero?

        new_sum = sum + v
        next if new_sum > target
        next if new_sum + remaining * throws.max < target

        holes[lb][lh] -= 1
        chosen[k] = Throw.new(value: v, cross: cross)
        fill_slot(slots, k + 1, holes, chosen, new_sum)
        holes[lb][lh] += 1
      end
    end
  end

  def build_beat_arr(slots, chosen)
    beat_arr = Array.new(period) { [Throw.new(value: 0, cross: false), Throw.new(value: 0, cross: false)] }
    slots.each_with_index do |(beat, hand), k|
      beat_arr[beat][hand] = chosen[k]
    end
    beat_arr
  end

  def add_result(beat_arr)
    key = sync_unparse(canonical_rotation(beat_arr))
    return if @seen[key]
    @seen[key] = true
    mirror_key = sync_unparse(canonical_rotation(mirror(beat_arr)))
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
    starts.map { |r| beats.rotate(r) }.min_by { |rot| sync_unparse(rot) }
  end

  def rotation_start_candidates(beats)
    both = (0...period).select { |r| !beats[r][0].empty? && !beats[r][1].empty? }
    both.any? ? both : (0...period).select { |r| !beats[r][0].empty? || !beats[r][1].empty? }
  end

  def mirror(beats)
    beats.map { |l, r| [r, l] }
  end

  # Internal sync formatter used for deduplication keys only.
  def sync_unparse(beats)
    beats.map { |l, r| "(#{sync_fmt(l)},#{sync_fmt(r)})" }.join
  end

  def sync_fmt(t)
    s = t.value.to_s(36)
    t.cross ? "#{s}x" : s
  end

  # --- Timing ---

  def log_timing(t0, nodes, raw_count)
    elapsed = Time.now - t0
    $stderr.puts "generate: #{"%.3f" % elapsed}s | nodes: #{nodes} | raw: #{raw_count}"
  end
end
