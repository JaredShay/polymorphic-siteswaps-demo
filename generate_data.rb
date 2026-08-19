require_relative 'lib/siteswap/generator'
require_relative 'lib/siteswap/specs'

CONFIGS = [
  { balls: 4, family: '3over2',        spec: Siteswap::Specs::THREE_OVER_TWO,                        throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] },
  { balls: 5, family: '3over2',        spec: Siteswap::Specs::THREE_OVER_TWO,                        throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] },
  { balls: 4, family: '3over2_2cycle', spec: Siteswap::Specs::THREE_OVER_TWO_2CYCLE,                 throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], sample_limit: 50 },
  { balls: 5, family: '3over2_2cycle', spec: Siteswap::Specs::THREE_OVER_TWO_2CYCLE,                 throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18], sample_limit: 50 },
  { balls: 4, family: '4over3',        spec: Siteswap::Specs::FOUR_OVER_THREE,                       throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] },
  { balls: 5, family: '4over3',        spec: Siteswap::Specs::FOUR_OVER_THREE,                       throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
  { balls: 4, family: '5over2',        spec: Siteswap::Specs::FIVE_OVER_TWO,                         throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
  { balls: 5, family: '5over2',        spec: Siteswap::Specs::FIVE_OVER_TWO,                         throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
  { balls: 4, family: '5over3',        spec: Siteswap::Specs::FIVE_OVER_THREE,                       throws: [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
  { balls: 5, family: '5over3',        spec: Siteswap::Specs::FIVE_OVER_THREE,                       throws: [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
  { balls: 4, family: '5over4',        spec: Siteswap::Specs::FIVE_OVER_FOUR,                        throws: [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34] },
  { balls: 5, family: '5over4',        spec: Siteswap::Specs::FIVE_OVER_FOUR,                        throws: [0, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34] },
  { balls: 4, family: '332',           spec: Siteswap::Specs::THREE_THREE_TWO_OVER_FOUR_FOUR,        throws: [0, 2, 4, 6, 8, 10, 12, 14, 16] },
  { balls: 5, family: '332',           spec: Siteswap::Specs::THREE_THREE_TWO_OVER_FOUR_FOUR,        throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
  { balls: 4, family: '332_2cycle',    spec: Siteswap::Specs::THREE_THREE_TWO_OVER_FOUR_FOUR_2CYCLE, throws: [0, 2, 4, 6, 8, 10, 12, 14, 16], sample_limit: 50 },
  { balls: 5, family: '332_2cycle',    spec: Siteswap::Specs::THREE_THREE_TWO_OVER_FOUR_FOUR_2CYCLE, throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20], sample_limit: 50 },
  { balls: 4, family: 'clave',         spec: Siteswap::Specs::CLAVE,                                 throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] },
  { balls: 5, family: 'clave',         spec: Siteswap::Specs::CLAVE,                                 throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] },
].freeze

DEFAULT_SAMPLE_LIMIT = 200

def write_patterns(path, patterns, limit:)
  total = patterns.size
  if total > limit
    sampled = patterns.sample(limit)
    File.write(path, "#total=#{total}\n" + sampled.join("\n"))
    $stdout.puts "#{path}: #{limit} (sample of #{total})"
  else
    File.write(path, patterns.join("\n"))
    $stdout.puts "#{path}: #{total}"
  end
end

CONFIGS.each do |cfg|
  result = PolymorphicSiteswaps.generate(**cfg[:spec], number_of_balls: cfg[:balls], throws: cfg[:throws])
  limit  = cfg[:sample_limit] || DEFAULT_SAMPLE_LIMIT

  base = "data/#{cfg[:balls]}b_#{cfg[:family]}"
  write_patterns("#{base}_ground.txt", result[:ground], limit: limit)
  write_patterns("#{base}_active.txt", result[:active], limit: limit)
  $stdout.flush
end
