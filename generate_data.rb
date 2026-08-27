require 'json'
require_relative 'lib/siteswap/generator'
require_relative 'lib/siteswap/specs'

# Each entry produces patterns for one (family, balls, cycles) combo.
# All entries with the same family are written together into data/{family}.json.
CONFIGS = [
  { balls: 4, family: '3over2', cycles: 1, spec: Siteswap::Specs::THREE_OVER_TWO,                        throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] },
  { balls: 5, family: '3over2', cycles: 1, spec: Siteswap::Specs::THREE_OVER_TWO,                        throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] },
  { balls: 4, family: '3over2', cycles: 2, spec: Siteswap::Specs::THREE_OVER_TWO_2CYCLE,                 throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], sample_limit: 50 },
  { balls: 5, family: '3over2', cycles: 2, spec: Siteswap::Specs::THREE_OVER_TWO_2CYCLE,                 throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], sample_limit: 50 },
  { balls: 4, family: '4over3', cycles: 1, spec: Siteswap::Specs::FOUR_OVER_THREE,                       throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] },
  { balls: 5, family: '4over3', cycles: 1, spec: Siteswap::Specs::FOUR_OVER_THREE,                       throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
  { balls: 4, family: '4over3', cycles: 2, spec: Siteswap::Specs::FOUR_OVER_THREE_2CYCLE,                throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], sample_limit: 50 },
  { balls: 4, family: '5over2', cycles: 1, spec: Siteswap::Specs::FIVE_OVER_TWO,                         throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
  { balls: 5, family: '5over2', cycles: 1, spec: Siteswap::Specs::FIVE_OVER_TWO,                         throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
  { balls: 4, family: '5over3', cycles: 1, spec: Siteswap::Specs::FIVE_OVER_THREE,                       throws: [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
  { balls: 5, family: '5over3', cycles: 1, spec: Siteswap::Specs::FIVE_OVER_THREE,                       throws: [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
  { balls: 4, family: '5over4', cycles: 1, spec: Siteswap::Specs::FIVE_OVER_FOUR,                        throws: [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34] },
  { balls: 5, family: '5over4', cycles: 1, spec: Siteswap::Specs::FIVE_OVER_FOUR,                        throws: [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34] },
  { balls: 4, family: '332',    cycles: 1, spec: Siteswap::Specs::THREE_THREE_TWO_OVER_FOUR_FOUR,        throws: [0, 2, 4, 6, 8, 10, 12, 14, 16] },
  { balls: 5, family: '332',    cycles: 1, spec: Siteswap::Specs::THREE_THREE_TWO_OVER_FOUR_FOUR,        throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
  { balls: 4, family: '332',    cycles: 2, spec: Siteswap::Specs::THREE_THREE_TWO_OVER_FOUR_FOUR_2CYCLE, throws: [0, 2, 4, 6, 8, 10, 12, 14, 16], sample_limit: 50 },
  { balls: 5, family: '332',    cycles: 2, spec: Siteswap::Specs::THREE_THREE_TWO_OVER_FOUR_FOUR_2CYCLE, throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20], sample_limit: 50 },
  { balls: 4, family: 'clave',  cycles: 1, spec: Siteswap::Specs::CLAVE,                                 throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] },
  { balls: 5, family: 'clave',  cycles: 1, spec: Siteswap::Specs::CLAVE,                                 throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] },
].freeze

DEFAULT_LIMIT = 200

CONFIGS.group_by { |c| c[:family] }.each do |family, configs|
  all_patterns = []

  configs.each do |cfg|
    spec_hash = cfg[:spec].to_hash
    n         = spec_hash[:period] || spec_hash[:single_cycle_period] * spec_hash[:num_cycles]
    rhythm    = {
      n:          n,
      leftBeats:  spec_hash[:left_beats],
      rightBeats: spec_hash[:right_beats],
    }

    limit  = cfg[:sample_limit] || DEFAULT_LIMIT
    result = PolymorphicSiteswaps.generate(
      **spec_hash,
      number_of_balls: cfg[:balls],
      throws:          cfg[:throws],
      ground_limit:    limit,
      active_limit:    limit
    )

    [:ground, :active].each do |cat|
      result[cat].each do |pattern|
        all_patterns << pattern
          .except(:multiplex, :multiplex_slots)
          .merge(
            balls:  cfg[:balls],
            state:  cat.to_s,
            cycles: cfg[:cycles],
            length: pattern[:beats].length,
            rhythm: rhythm,
          )
      end
    end
  end

  path = "data/#{family}.json"
  File.write(path, JSON.generate(all_patterns))
  $stdout.puts "#{path}: #{all_patterns.size} patterns"
  $stdout.flush
end
