require 'siteswap/notation'
require 'siteswap/generator'
require 'siteswap/formatter'

Throw          = Siteswap::Notation::Throw
MultiplexThrow = Siteswap::Notation::MultiplexThrow

THREE_TWO_MULTIPLEX = {
  period: 6, left_beats: [0, 3], right_beats: [0, 2, 4],
  number_of_balls: 3, throws: [4, 6, 8],
  multiplex_throws: ["46"]
}.freeze

RSpec.describe Siteswap::Notation::MultiplexThrow do
  describe "data model" do
    it "requires at least 2 component throws" do
      expect { described_class.new(throws: [Throw.new(value: 4, cross: false)]) }
        .to raise_error(Dry::Struct::Error)
    end

    it "reports the sum of component values" do
      mp = described_class.new(throws: [
        Throw.new(value: 4, cross: false),
        Throw.new(value: 6, cross: false)
      ])
      expect(mp.value).to eq 10
    end

    it "is never empty" do
      mp = described_class.new(throws: [
        Throw.new(value: 4, cross: false),
        Throw.new(value: 6, cross: false)
      ])
      expect(mp.empty?).to be false
    end
  end
end

RSpec.describe "multiplex average rule" do
  let(:result) { PolymorphicSiteswaps.generate(**THREE_TWO_MULTIPLEX) }

  def individual_throw_sum(pattern)
    pattern[:beats].flat_map do |b|
      case b[:kind]
      when "multiplex"
        b[:throws].map { |t| t.delete("x").to_i(36) }
      when "sync"
        [b[:left], b[:right]].compact.map { |t| t.delete("x").to_i(36) }
      when "left"
        [b[:left].delete("x").to_i(36)]
      when "right"
        [b[:right].delete("x").to_i(36)]
      else
        []
      end
    end.sum
  end

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

RSpec.describe "multiplex throw value containment" do
  let(:single_values)    { [4, 6, 8] }
  let(:multiplex_combos) { ["46"] }
  let(:result) do
    PolymorphicSiteswaps.generate(
      period: 6, left_beats: [0, 3], right_beats: [0, 2, 4],
      number_of_balls: 3, throws: single_values,
      multiplex_throws: multiplex_combos
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

RSpec.describe "multiplex categorization" do
  let(:result) { PolymorphicSiteswaps.generate(**THREE_TWO_MULTIPLEX) }

  it "no ground pattern is a multiplex pattern" do
    expect(result[:ground].count { |p| p[:multiplex] }).to eq 0
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

RSpec.describe "squeeze catch filtering" do
  let(:base) { THREE_TWO_MULTIPLEX }
  let(:without_squeeze) { PolymorphicSiteswaps.generate(**base, allow_squeeze_catches: false) }
  let(:with_squeeze)    { PolymorphicSiteswaps.generate(**base, allow_squeeze_catches: true) }

  it "patterns produced without squeeze are a subset of those produced with squeeze" do
    without_keys = (without_squeeze[:ground] + without_squeeze[:active]).map { |p| p[:halved] }.to_set
    with_keys    = (with_squeeze[:ground]    + with_squeeze[:active]).map    { |p| p[:halved] }.to_set
    expect(without_keys).to be_subset(with_keys)
  end
end

RSpec.describe "single-throw behavior unaffected by multiplex parameters" do
  let(:params) do
    { period: 6, left_beats: [0, 3], right_beats: [0, 2, 4],
      number_of_balls: 3, throws: [4, 6, 8] }
  end

  it "nil and empty multiplex_throws produce identical pattern sets" do
    with_nil   = PolymorphicSiteswaps.generate(**params, multiplex_throws: nil)
    with_empty = PolymorphicSiteswaps.generate(**params, multiplex_throws: [])
    expect(with_nil[:ground].map { |p| p[:halved] }.sort)
      .to eq(with_empty[:ground].map { |p| p[:halved] }.sort)
    expect(with_nil[:active].map { |p| p[:halved] }.sort)
      .to eq(with_empty[:active].map { |p| p[:halved] }.sort)
  end

  it "every pattern has multiplex: false" do
    result = PolymorphicSiteswaps.generate(**params)
    expect((result[:ground] + result[:active]).all? { |p| p[:multiplex] == false }).to be true
  end

  it "every pattern has an empty multiplex_slots list" do
    result = PolymorphicSiteswaps.generate(**params)
    expect((result[:ground] + result[:active]).all? { |p| p[:multiplex_slots].empty? }).to be true
  end
end

RSpec.describe "multiplex notation formatting" do
  subject(:formatter) { Siteswap::Formatters::Pattern.new }

  it "concatenates component values with no separator" do
    mp = MultiplexThrow.new(throws: [
      Throw.new(value: 4, cross: false),
      Throw.new(value: 6, cross: false)
    ])
    ssb = Siteswap::Notation::SuppressedSyncBeat.new(
      left: mp, right: Throw.new(value: 0, cross: false)
    )
    expect(formatter.format([ssb])).to eq "([46],0)!"
  end

  it "appends x to crossing components only" do
    mp = MultiplexThrow.new(throws: [
      Throw.new(value: 4, cross: true),
      Throw.new(value: 6, cross: false)
    ])
    ssb = Siteswap::Notation::SuppressedSyncBeat.new(
      left: mp, right: Throw.new(value: 0, cross: false)
    )
    expect(formatter.format([ssb])).to eq "([4x6],0)!"
  end

  it "outputs components in ascending value order regardless of construction order" do
    mp = MultiplexThrow.new(throws: [
      Throw.new(value: 6, cross: false),
      Throw.new(value: 4, cross: false)
    ])
    ssb = Siteswap::Notation::SuppressedSyncBeat.new(
      left: mp, right: Throw.new(value: 0, cross: false)
    )
    expect(formatter.format([ssb])).to eq "([46],0)!"
  end
end

RSpec.describe "multiplex beats formatter" do
  let(:notation) { Siteswap::Notation }
  subject(:result) { Siteswap::Formatters::Beats.new.format(beats) }

  def mp_ssb(mp_throw, other_throw, mp_hand: :left)
    left  = mp_hand == :left  ? mp_throw : other_throw
    right = mp_hand == :right ? mp_throw : other_throw
    notation::SuppressedSyncBeat.new(left: left, right: right)
  end

  let(:mp46) do
    MultiplexThrow.new(throws: [
      Throw.new(value: 4, cross: false),
      Throw.new(value: 6, cross: false)
    ])
  end

  context "with a left-hand multiplex, right empty" do
    let(:beats) { [mp_ssb(mp46, Throw.new(value: 0, cross: false), mp_hand: :left)] }

    it "returns kind: multiplex with hand: left and throws array" do
      expect(result).to eq([{ kind: "multiplex", hand: "left", throws: ["4", "6"], suppressed: true }])
    end
  end

  context "with a right-hand multiplex, left empty" do
    let(:beats) { [mp_ssb(mp46, Throw.new(value: 0, cross: false), mp_hand: :right)] }

    it "returns kind: multiplex with hand: right and throws array" do
      expect(result).to eq([{ kind: "multiplex", hand: "right", throws: ["4", "6"], suppressed: true }])
    end
  end
end
