require 'set'
require_relative 'notation'
require_relative 'simplifier'
require_relative 'formatter'

class PolymorphicSiteswaps
  Throw          = Siteswap::Notation::Throw
  MultiplexThrow = Siteswap::Notation::MultiplexThrow

  DEFAULT_FORMATTER = Siteswap::Formatters::Multi.new(
    presets: {
      halved:     { transforms: SiteswapSimplifier::PRESETS[:halved], formatter: Siteswap::Formatters::Pattern.new },
      simplified: { transforms: SiteswapSimplifier::PRESETS[:full],   formatter: Siteswap::Formatters::Pattern.new },
      beats:      { transforms: SiteswapSimplifier::PRESETS[:halved], formatter: Siteswap::Formatters::Beats.new },
    }
  ).freeze

  def self.generate(
    period: nil,
    left_beats:,
    right_beats:,
    number_of_balls:,
    throws:,
    multiplex_throws: nil,
    allow_squeeze_catches: false,
    single_cycle_period: nil,
    num_cycles: nil,
    ground_limit: nil,
    active_limit: nil,
    debug: false,
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
      multiplex_throws: multiplex_throws,
      allow_squeeze_catches: allow_squeeze_catches,
      single_cycle_period: single_cycle_period,
      num_cycles: num_cycles,
      ground_limit: ground_limit,
      active_limit: active_limit,
      debug: debug,
      formatter: formatter
    ).generate
  end

  attr_reader :period,
    :left_beats,
    :right_beats,
    :number_of_balls,
    :throws,
    :multiplex_throws,
    :allow_squeeze_catches,
    :single_cycle_period,
    :num_cycles,
    :ground_limit,
    :active_limit,
    :debug,
    :formatter

  def initialize(
    period:,
    left_beats:,
    right_beats:,
    number_of_balls:,
    throws:,
    multiplex_throws: nil,
    allow_squeeze_catches: false,
    single_cycle_period: nil,
    num_cycles: nil,
    ground_limit: nil,
    active_limit: nil,
    debug: false,
    formatter: DEFAULT_FORMATTER
  )
    raise ArgumentError, "throw values must be even" unless Siteswap::Types::ThrowList.valid?(throws)

    @period                = period
    @left_beats            = left_beats
    @right_beats           = right_beats
    @number_of_balls       = number_of_balls
    @throws                = throws
    @multiplex_throws      = multiplex_throws
    @allow_squeeze_catches = allow_squeeze_catches
    @single_cycle_period   = single_cycle_period
    @num_cycles            = num_cycles
    @ground_limit          = ground_limit
    @active_limit          = active_limit
    @debug                 = debug
    @formatter             = formatter
  end

  def generate
    ground, active = search
    {
      ground: format_patterns(ground),
      active: format_patterns(active),
    }
  end

  private

  def format_patterns(patterns)
    patterns.map { |beat_arr| formatter.format(beat_arr) }
  end

  # Compute the theoretical ground state analytically: the N lowest-rel valid
  # state slots given the beat structure. State slots correspond to (beat, hand)
  # pairs from the throw schedule; the ground state fills them from the bottom up.
  #
  # This is O(number_of_balls) and runs once before the DFS.
  def compute_ground_state
    slots = (left_beats.map { |b| [b, 0] } + right_beats.map { |b| [b, 1] }).sort_by { |b, h| [b, h] }

    result = []
    cycle  = 0
    while result.size < number_of_balls
      slots.each do |b, h|
        result << [b + cycle * period, h]
        break if result.size == number_of_balls
      end
      cycle += 1
    end
    result
  end

  def has_cross?(beats)
    beats.any? do |l, r|
      throw_has_cross?(l) || throw_has_cross?(r)
    end
  end

  def throw_has_cross?(t)
    case t
    when MultiplexThrow then t.throws.any?(&:cross)
    when Throw          then t.cross
    end
  end

  # --- Search ---
  #
  # Outer loop enumerates occupancy configurations (all-1 baseline, then subsets
  # of slots treated as multiplex with occupancy=2). For each configuration, runs
  # the JugglingLab-style holes-based DFS.
  #
  # holes[beat][hand] = occupancy for each throw slot; 0 elsewhere.
  # Each throw fills one landing slot by decrementing its hole count.
  # A pattern is valid when all holes reach 0 and the sum equals target.
  def search
    t0              = Time.now
    @ground_results = []
    @active_results = []
    @seen           = {}
    @nodes          = 0
    @ground_state   = compute_ground_state
    @slots          = strict_throw_slots

    @cycle_checkpoints = {}
    if single_cycle_period && num_cycles && num_cycles > 1
      (1...num_cycles).each do |i|
        boundary = single_cycle_period * i
        slot_idx = @slots.index { |beat, _| beat >= boundary }
        @cycle_checkpoints[slot_idx] = @slots.select { |beat, _| beat >= boundary }
      end
    end

    run_with_occupancy(Array.new(@slots.size, 1))

    unless multiplex_throws.nil? || multiplex_throws.empty?
      (1..@slots.size).each do |k|
        @slots.each_index.to_a.combination(k).each do |multiplex_indices|
          occupancy = Array.new(@slots.size, 1)
          multiplex_indices.each { |i| occupancy[i] = 2 }
          next unless feasible_sum?(occupancy)
          run_with_occupancy(occupancy)
        end
      end
    end

    log_timing(t0, @nodes, @ground_results.size + @active_results.size) if debug
    [@ground_results, @active_results]
  end

  def run_with_occupancy(occupancy)
    holes          = init_holes(@slots, occupancy)
    @initial_holes = holes.map(&:dup)
    chosen         = Array.new(@slots.size)
    prov           = init_provenance
    fill_slot(@slots, 0, holes, chosen, 0, occupancy, prov)
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

  def init_holes(slots, occupancy)
    h = Array.new(period) { [0, 0] }
    slots.each_with_index do |(beat, hand), k|
      h[beat][hand] = occupancy[k]
    end
    h
  end

  # Quick feasibility check: can we reach the target sum given the occupancy
  # configuration? Computes min/max achievable sums across all slots.
  def feasible_sum?(occupancy)
    min_sum = 0
    max_sum = 0
    @slots.each_index do |k|
      if occupancy[k] == 1
        non_zero = throws.reject(&:zero?)
        return false if non_zero.empty?
        min_sum += non_zero.min
        max_sum += throws.max
      else
        valid_combos = parsed_multiplex_throws.select { |c| c.size == occupancy[k] }
        return false if valid_combos.empty?
        combo_sums   = valid_combos.map { |c| c.sum(&:first) }
        min_sum += combo_sums.min
        max_sum += combo_sums.max
      end
    end
    min_sum <= target && max_sum >= target
  end

  def fill_slot(slots, k, holes, chosen, sum, occupancy, provenance)
    return if limited? && limits_satisfied?

    @nodes += 1

    # Multi-cycle pruning: at each intermediate cycle boundary, verify that at
    # least one throw from the preceding beats has landed in the remaining beats.
    # If not, the pattern has resolved to ground state early — prune.
    if (remaining_slots = @cycle_checkpoints[k])
      return unless remaining_slots.any? { |b, h| holes[b][h] < @initial_holes[b][h] }
    end

    if k == slots.size
      add_result(build_beat_arr(slots, chosen, occupancy)) if sum == target
      return
    end

    beat, hand   = slots[k]
    remaining_ct = slots.size - k - 1

    if occupancy[k] == 1
      fill_single(slots, k, holes, chosen, sum, occupancy, provenance, beat, hand, remaining_ct)
    else
      fill_multiplex(slots, k, holes, chosen, sum, occupancy, provenance, beat, hand, remaining_ct)
    end
  end

  def fill_single(slots, k, holes, chosen, sum, occupancy, provenance, beat, hand, remaining_ct)
    throw_order = limited? ? throws.shuffle : throws
    throw_order.each do |v|
      next if v.zero?
      (limited? ? [false, true].shuffle : [false, true]).each do |cross|
        lh = cross ? hand ^ 1 : hand
        lb = (beat + v / 2) % period
        next if holes[lb][lh].zero?

        new_sum = sum + v
        next if new_sum > target
        next if new_sum + remaining_ct * max_possible_throw < target

        next if !allow_squeeze_catches && squeeze_from_external?(provenance, lb, lh)

        holes[lb][lh] -= 1
        record_provenance(provenance, lb, lh, beat, hand)
        chosen[k] = Throw.new(value: v, cross: cross)
        fill_slot(slots, k + 1, holes, chosen, new_sum, occupancy, provenance)
        unrecord_provenance(provenance, lb, lh)
        holes[lb][lh] += 1
      end
    end
  end

  def fill_multiplex(slots, k, holes, chosen, sum, occupancy, provenance, beat, hand, remaining_ct)
    valid_combos = parsed_multiplex_throws.select { |c| c.size == occupancy[k] }

    valid_combos.each do |combo|
      values  = combo.map(&:first)
      new_sum = sum + values.sum
      next if new_sum > target
      next if new_sum + remaining_ct * max_possible_throw < target

      cross_options    = Array.new(combo.size) { [false, true] }
      cross_combos     = cross_options.first.product(*cross_options[1..])

      cross_combos.each do |crosses|
        throws_spec = combo.zip(crosses).map do |(v, _), cross|
          lh = cross ? hand ^ 1 : hand
          lb = (beat + v / 2) % period
          { v: v, cross: cross, lb: lb, lh: lh }
        end

        landing_slots = throws_spec.map { |t| [t[:lb], t[:lh]] }

        # Within-combo squeeze: two components landing at same (beat, hand)
        next if !allow_squeeze_catches && landing_slots.size != landing_slots.uniq.size

        capacity = Hash.new(0)
        throws_spec.each { |t| capacity[[t[:lb], t[:lh]]] += 1 }

        valid = capacity.all? do |(lb, lh), count|
          holes[lb][lh] >= count &&
            (allow_squeeze_catches || !squeeze_from_external?(provenance, lb, lh))
        end
        next unless valid

        throws_spec.each        { |t| holes[t[:lb]][t[:lh]] -= 1 }
        throws_spec.each        { |t| record_provenance(provenance, t[:lb], t[:lh], beat, hand) }
        chosen[k] = throws_spec.map { |t| Throw.new(value: t[:v], cross: t[:cross]) }

        fill_slot(slots, k + 1, holes, chosen, new_sum, occupancy, provenance)

        throws_spec.reverse_each { |t| unrecord_provenance(provenance, t[:lb], t[:lh]) }
        throws_spec.each         { |t| holes[t[:lb]][t[:lh]] += 1 }
      end
    end
  end

  def build_beat_arr(slots, chosen, occupancy)
    beat_arr = Array.new(period) { [Throw.new(value: 0, cross: false), Throw.new(value: 0, cross: false)] }
    slots.each_with_index do |(beat, hand), k|
      if occupancy[k] > 1
        beat_arr[beat][hand] = MultiplexThrow.new(throws: chosen[k].sort_by(&:value))
      else
        beat_arr[beat][hand] = chosen[k]
      end
    end
    beat_arr
  end

  def add_result(beat_arr)
    return unless has_cross?(beat_arr)

    key = sync_unparse(canonical_rotation(beat_arr))
    return if @seen[key]
    @seen[key] = true
    mirror_key = sync_unparse(canonical_rotation(mirror(beat_arr)))
    @seen[mirror_key] = true unless mirror_key == key

    if beat_state(beat_arr) == @ground_state
      @ground_results << beat_arr unless @ground_limit && @ground_results.size >= @ground_limit
    else
      @active_results << beat_arr unless @active_limit && @active_results.size >= @active_limit
    end
  end

  def limited?
    @ground_limit || @active_limit
  end

  def limits_satisfied?
    (@ground_limit.nil? || @ground_results.size >= @ground_limit) &&
    (@active_limit.nil? || @active_results.size >= @active_limit)
  end

  # --- Derived spec values ---

  def target
    @target ||= number_of_balls * period * 2
  end

  def max_possible_throw
    @max_possible_throw ||= begin
      single_max    = throws.max
      multiplex_max = parsed_multiplex_throws.map { |c| c.sum(&:first) }.max
      [single_max, multiplex_max || 0].max
    end
  end

  def parsed_multiplex_throws
    @parsed_multiplex_throws ||= (multiplex_throws || []).map { |s| parse_multiplex_string(s) }
  end

  # Converts a multiplex string like "4x6" into [[4, true], [6, false]].
  # Values are read as base-36 digits; 'x' suffix marks a crossing component.
  def parse_multiplex_string(s)
    components = []
    i = 0
    while i < s.length
      value = s[i].to_i(36)
      i += 1
      cross = s[i] == 'x'
      i += 1 if cross
      components << [value, cross]
    end
    components
  end

  # --- Pattern operations ---

  def beat_state(beats)
    state = []
    beats.each_with_index do |(l, r), i|
      [[0, l], [1, r]].each do |throw_hand, t|
        next if t.respond_to?(:empty?) && t.empty?
        component_throws = t.is_a?(MultiplexThrow) ? t.throws : [t]
        component_throws.each do |single|
          land_hand = throw_hand ^ (single.cross ? 1 : 0)
          rel       = i + single.value / 2 - period
          state << [rel, land_hand] if rel >= 0
        end
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
    case t
    when MultiplexThrow
      inner = t.throws.sort_by(&:value)
                      .map { |th| "#{th.value.to_s(36)}#{th.cross ? 'x' : ''}" }
                      .join
      "[#{inner}]"
    when Throw
      s = t.value.to_s(36)
      t.cross ? "#{s}x" : s
    end
  end

  # --- Provenance tracking for squeeze detection ---
  #
  # Records which source slots have already assigned a ball to each landing
  # (beat, hand). Used to detect cross-slot squeeze catches during DFS.

  def init_provenance
    Array.new(period) { [[], []] }
  end

  def squeeze_from_external?(provenance, lb, lh)
    provenance[lb][lh].any?
  end

  def record_provenance(prov, lb, lh, src_beat, src_hand)
    prov[lb][lh] << { source_beat: src_beat, source_hand: src_hand }
  end

  def unrecord_provenance(prov, lb, lh)
    prov[lb][lh].pop
  end

  # --- Timing ---

  def log_timing(t0, nodes, raw_count)
    elapsed = Time.now - t0
    $stderr.puts "generate: #{"%.3f" % elapsed}s | nodes: #{nodes} | raw: #{raw_count}"
  end
end
