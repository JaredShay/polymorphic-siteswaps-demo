RSpec.describe PolymorphicSiteswaps do
  describe '.generate' do
    it 'returns a hash with :ground and :active arrays of formatted pattern hashes' do
      result = described_class.generate(
        **Siteswap::Specs::THREE_OVER_TWO,
        number_of_balls: 4,
        throws: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
      )
      expect(result).to include(:ground, :active)
      expect(result[:ground]).to be_an(Array)
      expect(result[:active]).to be_an(Array)
      expect(result[:ground].first).to be_a(Hash)
      expect(result[:ground].first).to include(:halved, :simplified)
    end

    it 'raises ArgumentError for odd throw values' do
      expect {
        described_class.generate(
          period: 6,
          left_beats: [0, 3],
          right_beats: [0, 2, 4],
          number_of_balls: 3,
          throws: [1, 2, 4]
        )
      }.to raise_error(ArgumentError, /even/)
    end
  end
end
