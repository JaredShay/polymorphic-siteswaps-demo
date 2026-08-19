require 'siteswap/generator'
require 'siteswap/simplifier'
require 'siteswap/formatter'
require 'siteswap/specs'

# Valid simplified siteswap notation: sync beats (N,M)!?, hand markers R/L,
# async throws (base-36 digit with optional x suffix), and empty slots (0).
SITESWAP_NOTATION_RE = /\A[0-9a-z(,)!xRL]+\z/

RSpec.describe 'generate → simplify → format integration' do
  let(:simplifier) { SiteswapSimplifier.new }
  let(:formatter)  { SiteswapFormatter.new }

  it 'produces valid simplified siteswap strings for a 4-ball 3/2 pattern' do
    result = PolymorphicSiteswaps.generate(
      **Siteswap::Specs::THREE_OVER_TWO,
      number_of_balls: 4,
      throws:          [0, 2, 4, 6, 8, 10, 12, 14, 16, 18],
      simplifier:      simplifier,
      formatter:       formatter
    )

    expect(result).to be_a(Hash)
    expect(result.keys).to contain_exactly(:ground, :active)

    all_patterns = result[:ground] + result[:active]
    expect(all_patterns).not_to be_empty

    all_patterns.each do |pattern|
      expect(pattern).to be_a(String)
      expect(pattern).to match(SITESWAP_NOTATION_RE), "invalid notation: #{pattern.inspect}"
    end
  end
end
