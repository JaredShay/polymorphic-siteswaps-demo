require_relative 'notation'
require_relative 'transforms'
require_relative 'formatter'

# Converts a generator beat array into a notation sequence using a configurable
# pipeline of transforms.
#
# Input: [[left_throw, right_throw], ...] as produced by the generator.
#        Each throw is a Siteswap::Notation::Throw responding to :value and :cross.
#
# Output: SimplifiedPattern — a Dry::Struct carrying the resulting elements array.
#
# The pipeline is composable — pass any combination of transforms via :transforms.
# Use the preset constants for common configurations:
#
#   SiteswapSimplifier::PRESETS[:raw]     – no transforms (doubled sync, suppressed)
#   SiteswapSimplifier::PRESETS[:halved]  – divide by 2 only
#   SiteswapSimplifier::PRESETS[:compact] – halve + cancel empty pairs
#   SiteswapSimplifier::PRESETS[:full]    – halve + cancel + expand to mixed notation (default)
class SiteswapSimplifier
  SuppressedSyncBeat = Siteswap::Notation::SuppressedSyncBeat

  class SimplifiedPattern < Dry::Struct
    attribute :elements, Siteswap::Types::Strict::Array
  end

  HALVE        = Siteswap::Transforms::Halve.new.freeze
  CANCEL_PAIRS = Siteswap::Transforms::CancelPairs.new.freeze
  EXPAND       = Siteswap::Transforms::Expand.new.freeze

  PRESETS = {
    raw:     [].freeze,
    halved:  [HALVE].freeze,
    compact: [HALVE, CANCEL_PAIRS].freeze,
    full:    [HALVE, CANCEL_PAIRS, EXPAND].freeze
  }.freeze

  def initialize(transforms: PRESETS[:full], verbose: false)
    @transforms = transforms
    @verbose    = verbose
  end

  def simplify(beat_arr, verbose: @verbose)
    formatter = Siteswap::Formatters::Pattern.new
    log_raw(beat_arr, formatter) if verbose
    elements = @transforms.reduce(to_beats(beat_arr)) do |els, transform|
      result = transform.call(els)
      log(transform.label, result, formatter) if verbose
      result
    end
    SimplifiedPattern.new(elements: elements)
  end

  private

  def to_beats(beat_arr)
    beat_arr.map { |l, r| SuppressedSyncBeat.new(left: l, right: r) }
  end

  def log_raw(beat_arr, formatter)
    str = beat_arr.map { |l, r| "(#{fmt_throw(l)},#{fmt_throw(r)})" }.join
    $stdout.puts "  [raw]: #{str}"
  end

  def log(label, elements, formatter)
    $stdout.puts "  [after #{label}]: #{formatter.format(elements)}"
  end

  def fmt_throw(t)
    s = t.value <= 35 ? t.value.to_s(36) : "{#{t.value}}"
    t.cross ? "#{s}x" : s
  end
end
