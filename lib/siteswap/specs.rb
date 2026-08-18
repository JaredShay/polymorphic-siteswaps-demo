require 'dry-struct'
require_relative 'types'

module Siteswap
  module Specs
    # Base for specs with hand-crafted beat arrays (non-standard layouts).
    class PatternSpec < Dry::Struct
      alias to_hash to_h
    end

    class SingleCycleSpec < PatternSpec
      attribute :period,      Types::Strict::Integer.constrained(gt: 0)
      attribute :left_beats,  Types::BeatList
      attribute :right_beats, Types::BeatList
    end

    class MultiCycleSpec < PatternSpec
      attribute :single_cycle_period, Types::Strict::Integer.constrained(gt: 0)
      attribute :num_cycles,          Types::Strict::Integer.constrained(gteq: 2)
      attribute :left_beats,          Types::BeatList
      attribute :right_beats,         Types::BeatList
    end

    # Derives a standard N-over-M polyrhythm spec from the ratio alone.
    #
    # period      = LCM(right, left)
    # right_beats = evenly spaced at period/right intervals
    # left_beats  = evenly spaced at period/left  intervals
    #
    # For multi-cycle patterns, pass cycles: N; the period and beat arrays are
    # expanded across all cycles automatically.
    class PolyrhythmSpec < Dry::Struct
      attribute :right,  Types::Strict::Integer.constrained(gt: 0)
      attribute :left,   Types::Strict::Integer.constrained(gt: 0)
      attribute :cycles, Types::Strict::Integer.constrained(gteq: 1).default(1)

      def period      = right.lcm(left)
      def right_beats = (0...period).step(period / right).to_a
      def left_beats  = (0...period).step(period / left).to_a

      def to_hash
        if cycles == 1
          { period: period, left_beats: left_beats, right_beats: right_beats }
        else
          {
            single_cycle_period: period,
            num_cycles:          cycles,
            left_beats:          (0...cycles).flat_map { |c| left_beats.map  { |b| b + c * period } },
            right_beats:         (0...cycles).flat_map { |c| right_beats.map { |b| b + c * period } },
          }
        end
      end
    end

    # "3 3 2" right hand, "4 4" left hand — both sum to period 8.
    # right_beats: 0, 3, 6  (gaps of 3, 3, 2)
    # left_beats:  0, 4     (gaps of 4, 4)
    THREE_THREE_TWO_OVER_FOUR_FOUR = SingleCycleSpec.new(
      period:      8,
      left_beats:  [0, 4],
      right_beats: [0, 3, 6]
    ).freeze

    THREE_OVER_TWO        = PolyrhythmSpec.new(right: 3, left: 2).freeze
    THREE_OVER_TWO_2CYCLE = PolyrhythmSpec.new(right: 3, left: 2, cycles: 2).freeze
    FOUR_OVER_THREE       = PolyrhythmSpec.new(right: 4, left: 3).freeze
    FIVE_OVER_TWO         = PolyrhythmSpec.new(right: 5, left: 2).freeze
    FIVE_OVER_THREE       = PolyrhythmSpec.new(right: 5, left: 3).freeze
    FIVE_OVER_FOUR        = PolyrhythmSpec.new(right: 5, left: 4).freeze
  end
end
