require 'siteswap/notation'
require 'siteswap/generator'
require 'siteswap/formatter'

RSpec.describe Siteswap::Notation::MultiplexThrow do
  let(:mp46) do
    described_class.new(throws: [
      Siteswap::Notation::Throw.new(value: 4, cross: false),
      Siteswap::Notation::Throw.new(value: 6, cross: false)
    ])
  end

  describe "data model" do
    it "requires at least 2 component throws" do
      expect do
        described_class.new(throws: [Siteswap::Notation::Throw.new(value: 4, cross: false)])
      end.to raise_error(Dry::Struct::Error)
    end

    it "reports the sum of component values" do
      expect(mp46.value).to eq 10
    end

    it "is never empty" do
      expect(mp46.empty?).to be false
    end
  end
end

RSpec.describe PolymorphicSiteswaps do
  let(:base_params) do
    {
      period: 6,
      left_beats: [0, 3],
      right_beats: [0, 2, 4],
      number_of_balls: 3,
      throws: [4, 6, 8],
      multiplex_throws: ["46"]
    }
  end

  def individual_throw_sum(pattern)
    pattern[:beats].sum do |b|
      hand_sum = 0
      hand_sum += b[:left][:throws].sum  { |t| t[:value] } if b[:left]
      hand_sum += b[:right][:throws].sum { |t| t[:value] } if b[:right]
      hand_sum
    end
  end

  def parse_throw_values(s)
    if s.start_with?("[")
      s[1..-2].scan(/[0-9a-z]x?/).map { |v| v[0].to_i(36) }
    else
      [s.delete("x").to_i(36)]
    end
  end

  context "average rule" do
    let(:result) { described_class.generate(**base_params) }

    it "holds for all ground patterns" do
      result[:ground].each do |pattern|
        expect(individual_throw_sum(pattern)).to eq(3 * 6),
          "average rule violated in #{pattern[:halved]}"
      end
    end

    it "holds for all active patterns" do
      result[:active].each do |pattern|
        expect(individual_throw_sum(pattern)).to eq(3 * 6),
          "average rule violated in #{pattern[:halved]}"
      end
    end
  end

  context "multiplex throw value containment" do
    let(:multiplex_combos) { ["46"] }
    let(:result) do
      described_class.generate(
        **base_params.merge(multiplex_throws: multiplex_combos)
      )
    end

    it "multiplex slots use only combos from the multiplex_throws list" do
      (result[:ground] + result[:active]).select { |p| p[:multiplex] }.each do |pattern|
        pattern[:multiplex_slots].each do |slot|
          parsed = slot[:throws].map { |t| t.delete("x").to_i(36) }.sort.join
          expect(multiplex_combos).to include(parsed)
        end
      end
    end
  end

  context "multiplex categorization" do
    let(:result) { described_class.generate(**base_params) }

    it "generates at least one multiplex pattern" do
      expect(result[:active].any? { |p| p[:multiplex] }).to be true
    end

    it "multiplex patterns have at least one multiplex_slot entry" do
      result[:active].select { |p| p[:multiplex] }.each do |pattern|
        expect(pattern[:multiplex_slots]).not_to be_empty
      end
    end

    it "non-multiplex patterns have an empty multiplex_slots list" do
      (result[:ground] + result[:active]).reject { |p| p[:multiplex] }.each do |pattern|
        expect(pattern[:multiplex_slots]).to be_empty
      end
    end
  end

  context "squeeze catch filtering" do
    let(:without_squeeze) { described_class.generate(**base_params, allow_squeeze_catches: false) }
    let(:with_squeeze)    { described_class.generate(**base_params, allow_squeeze_catches: true) }

    it "patterns produced without squeeze are a subset of those produced with squeeze" do
      without_keys = (without_squeeze[:ground] + without_squeeze[:active]).map { |p| p[:halved] }.to_set
      with_keys    = (with_squeeze[:ground]    + with_squeeze[:active]).map    { |p| p[:halved] }.to_set
      expect(without_keys).to be_subset(with_keys)
    end
  end

  context "single-throw behavior unaffected by multiplex parameters" do
    let(:single_throw_params) do
      { period: 6, left_beats: [0, 3], right_beats: [0, 2, 4],
        number_of_balls: 3, throws: [4, 6, 8] }
    end

    it "nil and empty multiplex_throws produce identical pattern sets" do
      with_nil   = described_class.generate(**single_throw_params, multiplex_throws: nil)
      with_empty = described_class.generate(**single_throw_params, multiplex_throws: [])
      expect(with_nil[:ground].map { |p| p[:halved] }.sort)
        .to eq(with_empty[:ground].map { |p| p[:halved] }.sort)
      expect(with_nil[:active].map { |p| p[:halved] }.sort)
        .to eq(with_empty[:active].map { |p| p[:halved] }.sort)
    end

    it "every pattern has multiplex: false" do
      result = described_class.generate(**single_throw_params)
      expect((result[:ground] + result[:active]).all? { |p| p[:multiplex] == false }).to be true
    end

    it "every pattern has an empty multiplex_slots list" do
      result = described_class.generate(**single_throw_params)
      expect((result[:ground] + result[:active]).all? { |p| p[:multiplex_slots].empty? }).to be true
    end
  end
end

RSpec.describe Siteswap::Formatters::Pattern do
  subject(:formatter) { described_class.new }

  let(:mp46) do
    Siteswap::Notation::MultiplexThrow.new(throws: [
      Siteswap::Notation::Throw.new(value: 4, cross: false),
      Siteswap::Notation::Throw.new(value: 6, cross: false)
    ])
  end

  def mp_ssb(left, right)
    Siteswap::Notation::SuppressedSyncBeat.new(left: left, right: right)
  end

  it "concatenates component values with no separator" do
    ssb = mp_ssb(mp46, Siteswap::Notation::Throw.new(value: 0, cross: false))
    expect(formatter.format([ssb])).to eq "([46],0)!"
  end

  it "appends x to crossing components only" do
    mp = Siteswap::Notation::MultiplexThrow.new(throws: [
      Siteswap::Notation::Throw.new(value: 4, cross: true),
      Siteswap::Notation::Throw.new(value: 6, cross: false)
    ])
    ssb = mp_ssb(mp, Siteswap::Notation::Throw.new(value: 0, cross: false))
    expect(formatter.format([ssb])).to eq "([4x6],0)!"
  end

  it "outputs components in ascending value order regardless of construction order" do
    mp = Siteswap::Notation::MultiplexThrow.new(throws: [
      Siteswap::Notation::Throw.new(value: 6, cross: false),
      Siteswap::Notation::Throw.new(value: 4, cross: false)
    ])
    ssb = mp_ssb(mp, Siteswap::Notation::Throw.new(value: 0, cross: false))
    expect(formatter.format([ssb])).to eq "([46],0)!"
  end
end

RSpec.describe Siteswap::Formatters::Beats do
  subject(:result) { described_class.new.format(beats) }

  let(:mp46) do
    Siteswap::Notation::MultiplexThrow.new(throws: [
      Siteswap::Notation::Throw.new(value: 4, cross: false),
      Siteswap::Notation::Throw.new(value: 6, cross: false)
    ])
  end

  def mp_ssb(mp_throw, other_throw, mp_hand: :left)
    left  = mp_hand == :left  ? mp_throw : other_throw
    right = mp_hand == :right ? mp_throw : other_throw
    Siteswap::Notation::SuppressedSyncBeat.new(left: left, right: right)
  end

  context "with a left-hand multiplex, right empty" do
    let(:beats) { [mp_ssb(mp46, Siteswap::Notation::Throw.new(value: 0, cross: false), mp_hand: :left)] }

    it "returns left throws for both components, no right" do
      expect(result).to eq([{
        index: 0, suppressed: true,
        left: { throws: [
          { label: "4", value: 4, cross: false },
          { label: "6", value: 6, cross: false },
        ]},
      }])
    end
  end

  context "with a right-hand multiplex, left empty" do
    let(:beats) { [mp_ssb(mp46, Siteswap::Notation::Throw.new(value: 0, cross: false), mp_hand: :right)] }

    it "returns right throws for both components, no left" do
      expect(result).to eq([{
        index: 0, suppressed: true,
        right: { throws: [
          { label: "4", value: 4, cross: false },
          { label: "6", value: 6, cross: false },
        ]},
      }])
    end
  end
end
