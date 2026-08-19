require 'dry-types'

module Siteswap
  module Types
    include Dry.Types()

    # Non-negative integer siteswap throw value.
    ThrowValue = Strict::Integer.constrained(gteq: 0)

    # A valid generator throw value: must be even.
    EvenThrow = ThrowValue.constrained(even: true)

    # Validated list of generator throw values.
    ThrowList = Array.of(EvenThrow).constrained(min_size: 1)

    # Non-negative beat indices.
    BeatList = Array.of(Strict::Integer.constrained(gteq: 0)).constrained(min_size: 1)
  end
end
