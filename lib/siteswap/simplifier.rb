require_relative 'notation'
require_relative 'transforms'
require_relative 'formatter'

# Converts a generator beat array into a simplified notation sequence.
#
# Input: [[left_throw, right_throw], ...] as produced by the generator.
#        Each throw is a Siteswap::Notation::Throw responding to :value and :cross.
#
# Output: [SyncBeat | SuppressedSyncBeat | AsyncThrow | EmptySlot, ...] (see Siteswap::Notation)
#
# The pipeline is composable — pass any combination of transforms via the :transforms keyword.
# Use the preset constants for common configurations:
#
#   SiteswapSimplifier::PRESETS[:raw]     – no transforms (doubled sync, suppressed)
#   SiteswapSimplifier::PRESETS[:halved]  – divide by 2 only
#   SiteswapSimplifier::PRESETS[:compact] – halve + cancel empty pairs
#   SiteswapSimplifier::PRESETS[:full]    – halve + cancel + expand to mixed notation (default)
class SiteswapSimplifier
  SuppressedSyncBeat = Siteswap::Notation::SuppressedSyncBeat

  # Result of simplify — notation elements paired with the cumulative dilation
  # factor applied to throw values. Callers that map patterns to a BPM should
  # multiply their source BPM by this factor (e.g. 0.5 when Halve is applied).
  SimplifiedPattern = Struct.new(:elements, :dilation_factor, keyword_init: true)

  HALVE        = Siteswap::Transforms::Halve.new.freeze
  CANCEL_PAIRS = Siteswap::Transforms::CancelPairs.new.freeze
  EXPAND       = Siteswap::Transforms::Expand.new.freeze

  PRESETS = {
    raw:     [].freeze,
    halved:  [HALVE].freeze,
    compact: [HALVE, CANCEL_PAIRS].freeze,
    full:    [HALVE, CANCEL_PAIRS, EXPAND].freeze
  }.freeze

  def initialize(transforms: PRESETS[:full], formatter: SiteswapFormatter.new, verbose: false)
    @transforms = transforms
    @formatter  = formatter
    @verbose    = verbose
  end

  def simplify(beat_arr, verbose: @verbose)
    log_raw(beat_arr) if verbose
    elements = @transforms.reduce(to_beats(beat_arr)) do |els, transform|
      result = transform.call(els)
      log(transform.label, result) if verbose
      result
    end
    dilation_factor = @transforms.map(&:dilation_factor).reduce(1.0, :*)
    SimplifiedPattern.new(elements: elements, dilation_factor: dilation_factor)
  end

  private

  def to_beats(beat_arr)
    beat_arr.map { |l, r| SuppressedSyncBeat.new(left: l, right: r) }
  end

  def log_raw(beat_arr)
    str = beat_arr.map { |l, r| "(#{fmt_throw(l)},#{fmt_throw(r)})" }.join
    $stdout.puts "  [raw]: #{str}"
  end

  def log(label, elements)
    $stdout.puts "  [after #{label}]: #{@formatter.format(elements)}"
  end

  # Only used for log_raw — renders raw Throw objects before they enter the pipeline.
  def fmt_throw(t)
    s = t.value <= 35 ? t.value.to_s(36) : "{#{t.value}}"
    t.cross ? "#{s}x" : s
  end
end
