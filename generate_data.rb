require_relative 'polymorphic_siteswaps'

CONFIGS = [
  { balls: 4, family: '3over2', method: :three_over_two,  throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] },
  { balls: 5, family: '3over2', method: :three_over_two,  throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] },
  { balls: 4, family: '4over3', method: :four_over_three, throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] },
  { balls: 5, family: '4over3', method: :four_over_three, throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18] },
  { balls: 4, family: '5over2', method: :five_over_two,   throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
  { balls: 5, family: '5over2', method: :five_over_two,   throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
  { balls: 4, family: '5over3', method: :five_over_three, throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
  { balls: 5, family: '5over3', method: :five_over_three, throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] },
  { balls: 4, family: '5over4', method: :five_over_four,  throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40] },
  { balls: 5, family: '5over4', method: :five_over_four,  throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40] },
].freeze

SAMPLE_LIMIT = 200

def write_patterns(path, patterns)
  total = patterns.size
  if total > SAMPLE_LIMIT
    sampled = patterns.sample(SAMPLE_LIMIT)
    File.write(path, "#total=#{total}\n" + sampled.join("\n"))
    $stdout.puts "#{path}: #{SAMPLE_LIMIT} (sample of #{total})"
  else
    File.write(path, patterns.join("\n"))
    $stdout.puts "#{path}: #{total}"
  end
end

CONFIGS.each do |cfg|
  result = PolymorphicSiteswaps.send(
    cfg[:method],
    number_of_balls: cfg[:balls],
    throws: cfg[:throws]
  )

  base = "data/#{cfg[:balls]}b_#{cfg[:family]}"
  write_patterns("#{base}_ground.txt", result[:ground])
  write_patterns("#{base}_active.txt", result[:active])
  $stdout.flush
end
