require 'dry-struct'
require_relative 'types'

module Siteswap
  module Specs
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

    THREE_OVER_TWO = SingleCycleSpec.new(
      period:      6,
      left_beats:  [0, 3],
      right_beats: [0, 2, 4],
    ).freeze

    THREE_OVER_TWO_2CYCLE = MultiCycleSpec.new(
      single_cycle_period: 6,
      num_cycles:          2,
      left_beats:          [0, 3, 6, 9],
      right_beats:         [0, 2, 4, 6, 8, 10],
    ).freeze

    FOUR_OVER_THREE = SingleCycleSpec.new(
      period:      12,
      left_beats:  [0, 4, 8],
      right_beats: [0, 3, 6, 9],
    ).freeze

    FIVE_OVER_TWO = SingleCycleSpec.new(
      period:      10,
      left_beats:  [0, 5],
      right_beats: [0, 2, 4, 6, 8],
    ).freeze

    FIVE_OVER_THREE = SingleCycleSpec.new(
      period:      15,
      left_beats:  [0, 5, 10],
      right_beats: [0, 3, 6, 9, 12],
    ).freeze

    FIVE_OVER_FOUR = SingleCycleSpec.new(
      period:      20,
      left_beats:  [0, 5, 10, 15],
      right_beats: [0, 4, 8, 12, 16],
    ).freeze
  end
end
