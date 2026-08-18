require 'dry-types'

module Siteswap
  module Types
    include Dry.Types()

    # Non-negative integer representable as a single base-36 character.
    ThrowValue = Strict::Integer.constrained(gteq: 0, lteq: 35)

    # A valid generator throw value: even and in base-36 range.
    EvenThrow = ThrowValue.constrained(even: true)

    # Validated list of generator throw values.
    ThrowList = Array.of(EvenThrow).constrained(min_size: 1)

    # Non-negative beat indices.
    BeatList = Array.of(Strict::Integer.constrained(gteq: 0)).constrained(min_size: 1)
  end
end
