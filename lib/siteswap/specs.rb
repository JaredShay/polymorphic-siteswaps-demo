module Siteswap
  module Specs
    THREE_OVER_TWO = {
      period:      6,
      left_beats:  [0, 3],
      right_beats: [0, 2, 4],
    }.freeze

    THREE_OVER_TWO_2CYCLE = {
      single_cycle_period: 6,
      num_cycles:          2,
      left_beats:          [0, 3, 6, 9],
      right_beats:         [0, 2, 4, 6, 8, 10],
    }.freeze

    FOUR_OVER_THREE = {
      period:      12,
      left_beats:  [0, 4, 8],
      right_beats: [0, 3, 6, 9],
    }.freeze

    FIVE_OVER_TWO = {
      period:      10,
      left_beats:  [0, 5],
      right_beats: [0, 2, 4, 6, 8],
    }.freeze

    FIVE_OVER_THREE = {
      period:      15,
      left_beats:  [0, 5, 10],
      right_beats: [0, 3, 6, 9, 12],
    }.freeze

    FIVE_OVER_FOUR = {
      period:      20,
      left_beats:  [0, 5, 10, 15],
      right_beats: [0, 4, 8, 12, 16],
    }.freeze
  end
end
