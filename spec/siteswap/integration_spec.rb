require 'siteswap/generator'
require 'siteswap/simplifier'
require 'siteswap/formatter'
require 'siteswap/specs'

# Valid siteswap notation characters: sync beats (N,M)!?, hand markers R/L,
# async throws (single char or {N} for values > 35, with optional x suffix), and empty slots (0).
SITESWAP_NOTATION_RE = /\A[0-9a-z(,)!xRL{}]+\z/

RSpec.describe 'generate → format integration' do
  it 'produces valid halved and simplified siteswap strings for a 4-ball 3/2 pattern' do
    result = PolymorphicSiteswaps.generate(
      **Siteswap::Specs::THREE_OVER_TWO,
      number_of_balls: 4,
      throws:          [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
    )

    expect(result).to be_a(Hash)
    expect(result.keys).to contain_exactly(:ground, :active)

    all_patterns = result[:ground] + result[:active]
    expect(all_patterns).not_to be_empty

    all_patterns.each do |pattern|
      expect(pattern).to be_a(Hash)
      expect(pattern).to include(:halved, :simplified, :beats)

      expect(pattern[:halved]).to match(SITESWAP_NOTATION_RE),
        "invalid halved notation: #{pattern[:halved].inspect}"
      expect(pattern[:simplified]).to match(SITESWAP_NOTATION_RE),
        "invalid simplified notation: #{pattern[:simplified].inspect}"

      expect(pattern[:beats]).to be_an(Array).and(satisfy { |a| !a.empty? })
      pattern[:beats].each_with_index do |beat, i|
        expect(beat[:index]).to eq(i)
        expect(beat[:suppressed]).to be(true).or be(false)
        [:left, :right].each do |hand|
          next unless beat.key?(hand)
          expect(beat[hand]).to be_a(Hash).and include(:throws)
          beat[hand][:throws].each do |t|
            expect(t[:label]).to match(/\A[0-9a-z{}x]+\z/)
            expect(t[:value]).to be_a(Integer)
            expect(t[:cross]).to be(true).or be(false)
          end
        end
      end
    end
  end
end
