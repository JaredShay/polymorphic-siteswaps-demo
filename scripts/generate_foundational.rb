require 'json'
require_relative '../lib/siteswap/generator'
require_relative '../lib/siteswap/specs'

# Foundational patterns: 1-cycle, all throws <= the base pattern's max throw.
#
# 3-over-2 base: (c,8)(0,0)(0,8)(c,0)(0,8)(0,0) → max throw = c (12)
FOUNDATIONAL_SPECS = [
  { family: '3over2', spec: Siteswap::Specs::THREE_OVER_TWO,  balls: [4, 5], throws: [0, 2, 4, 6, 8, 10, 12] },
  { family: '4over3', spec: Siteswap::Specs::FOUR_OVER_THREE, balls: [4, 5], throws: [0, 2, 4, 6, 8, 10, 12, 14, 16] },
].freeze

def write_file(path, patterns)
  File.write(path, JSON.generate(patterns))
  $stdout.puts "#{path}: #{patterns.size}"
end

FOUNDATIONAL_SPECS.each do |cfg|
  cfg[:balls].each do |balls|
    result = PolymorphicSiteswaps.generate(**cfg[:spec], number_of_balls: balls, throws: cfg[:throws])
    write_file("data/#{balls}b_#{cfg[:family]}_foundational.json", result[:ground].sort_by { |h| h[:simplified] })
  end
end
