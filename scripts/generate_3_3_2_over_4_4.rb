require_relative '../lib/siteswap/generator'
require_relative '../lib/siteswap/specs'
require_relative '../lib/siteswap/notation'

spec   = Siteswap::Specs::THREE_THREE_TWO_OVER_FOUR_FOUR
throws = [0, 2, 4, 6, 8, 10, 12, 14, 16]

result = PolymorphicSiteswaps.generate(
  **spec.to_hash,
  number_of_balls: 4,
  throws: throws
)

puts "ground (#{result[:ground].size}):"
result[:ground].each { |h| puts "  #{h[:halved]}  |  #{h[:simplified]}" }
puts "active (#{result[:active].size}):"
result[:active].each { |h| puts "  #{h[:halved]}  |  #{h[:simplified]}" }
