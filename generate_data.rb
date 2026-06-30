require 'json'
require_relative 'polymorphic_siteswaps'

CONFIGS = [
  { balls: 4, family: '3over2', method: :three_over_two,  throws: [0, 4, 6, 8, 12, 14] },
  { balls: 5, family: '3over2', method: :three_over_two,  throws: [0, 4, 6, 8, 12, 14] },
  { balls: 4, family: '4over3', method: :four_over_three, throws: [0, 6, 8, 12, 14, 16] },
  { balls: 5, family: '4over3', method: :four_over_three, throws: [0, 6, 8, 12, 14, 16] },
].freeze

[true, false].each do |strict|
  mode = strict ? 'strict' : 'free'
  CONFIGS.each do |cfg|
    result = PolymorphicSiteswaps.send(
      cfg[:method],
      number_of_balls: cfg[:balls],
      throws: cfg[:throws],
      strict_rhythm: strict
    )

    base = "data/#{cfg[:balls]}b_#{cfg[:family]}_#{mode}"
    File.write("#{base}_ground.json", JSON.generate(result[:ground]))
    File.write("#{base}_active.json", JSON.generate(result[:active]))
    $stdout.puts "#{base}_ground.json: #{result[:ground].size}"
    $stdout.puts "#{base}_active.json: #{result[:active].size}"
    $stdout.flush
  end
end
