require_relative 'polymorphic_siteswaps'

CONFIGS = [
  { balls: 4, family: '3over2', method: :three_over_two,  throws: [0, 2, 4, 6, 8, 12, 14, 16, 18] },
  { balls: 5, family: '3over2', method: :three_over_two,  throws: [0, 2, 4, 6, 8, 12, 14, 16, 18] },
  { balls: 4, family: '4over3', method: :four_over_three, throws: [0, 2, 4, 6, 8, 12, 14, 16, 18] },
  { balls: 5, family: '4over3', method: :four_over_three, throws: [0, 2, 4, 6, 8, 12, 14, 16, 18] },
].freeze

CONFIGS.each do |cfg|
  result = PolymorphicSiteswaps.send(
    cfg[:method],
    number_of_balls: cfg[:balls],
    throws: cfg[:throws]
  )

  base = "data/#{cfg[:balls]}b_#{cfg[:family]}"
  File.write("#{base}_ground.txt", result[:ground].join("\n"))
  File.write("#{base}_active.txt", result[:active].join("\n"))
  $stdout.puts "#{base}_ground.txt: #{result[:ground].size}"
  $stdout.puts "#{base}_active.txt: #{result[:active].size}"
  $stdout.flush
end
