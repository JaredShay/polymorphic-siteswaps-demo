RSpec.describe Siteswap::Formatters::Pattern do
  subject(:formatter) { described_class.new.format(input) }

  let(:notation) { Siteswap::Notation }
  let(:throw_l) { notation::Throw.new(value: 4, cross: true) }
  let(:throw_r) { notation::Throw.new(value: 6, cross: false) }

  describe '#format' do
    context 'with a sync beat' do
      let(:input) { [notation::SyncBeat.new(left: throw_l, right: throw_r)] }

      it 'formats correctly' do
        expect(subject).to eq("(4x,6)")
      end
    end

    context 'with a suppressed sync beat' do
      let(:throw_l) { notation::Throw.new(value: 4, cross: false) }
      let(:throw_r) { notation::Throw.new(value: 6, cross: false) }
      let(:input) { [notation::SuppressedSyncBeat.new(left: throw_l, right: throw_r)] }

      it 'appends !' do
        expect(subject).to eq("(4,6)!")
      end
    end

    context 'with an async throw' do
      let(:throw_l) { notation::Throw.new(value: 5, cross: false) }
      let(:input) { [notation::AsyncThrow.new(throw: throw_l)] }

      it 'formats correctly' do
        expect(subject).to eq("5")
      end
    end

    context 'with an empty slot' do
      let(:input) { [notation::EmptySlot.new] }

      it 'formats as 0' do
        expect(subject).to eq("0")
      end
    end
  end
end

RSpec.describe Siteswap::Formatters::Beats do
  let(:notation) { Siteswap::Notation }
  subject(:result) { described_class.new.format(beats) }

  def ssb(left_val, left_cross, right_val, right_cross)
    notation::SuppressedSyncBeat.new(
      left:  notation::Throw.new(value: left_val,  cross: left_cross),
      right: notation::Throw.new(value: right_val, cross: right_cross)
    )
  end

  def th(label, value, cross)
    { label: label, value: value, cross: cross }
  end

  context 'with a rest beat (both zero)' do
    let(:beats) { [ssb(0, false, 0, false)] }

    it 'returns index, suppressed, no hands' do
      expect(result).to eq([{ index: 0, suppressed: true }])
    end
  end

  context 'with a left-only beat' do
    let(:beats) { [ssb(5, false, 0, false)] }

    it 'returns left throws, no right' do
      expect(result).to eq([{ index: 0, suppressed: true, left: { throws: [th("5", 5, false)] } }])
    end
  end

  context 'with a right-only beat with cross' do
    let(:beats) { [ssb(0, false, 4, true)] }

    it 'returns right throws with x label, no left' do
      expect(result).to eq([{ index: 0, suppressed: true, right: { throws: [th("4x", 4, true)] } }])
    end
  end

  context 'with a sync beat (both non-zero)' do
    let(:beats) { [ssb(4, true, 6, false)] }

    it 'returns both hands with correct throws' do
      expect(result).to eq([{
        index: 0, suppressed: true,
        left:  { throws: [th("4x", 4, true)]  },
        right: { throws: [th("6",  6, false)] },
      }])
    end
  end

  context 'with a multiplex left beat' do
    let(:beats) do
      [notation::SuppressedSyncBeat.new(
        left:  notation::MultiplexThrow.new(throws: [
          notation::Throw.new(value: 3, cross: false),
          notation::Throw.new(value: 4, cross: false),
        ]),
        right: notation::Throw.new(value: 0, cross: false)
      )]
    end

    it 'returns left with multiple throws, no right' do
      expect(result).to eq([{
        index: 0, suppressed: true,
        left: { throws: [th("3", 3, false), th("4", 4, false)] },
      }])
    end
  end

  context 'with a mixed sequence' do
    # Halved form of a typical 3/2 pattern: (4x,6)!(0,0)!(0,4x)!(5,0)!(0,5)!(0,0)!
    let(:beats) do
      [
        ssb(4, true,  6, false),
        ssb(0, false, 0, false),
        ssb(0, false, 4, true),
        ssb(5, false, 0, false),
        ssb(0, false, 5, false),
        ssb(0, false, 0, false),
      ]
    end

    it 'assigns correct index and classifies each beat' do
      expect(result).to eq([
        { index: 0, suppressed: true, left: { throws: [th("4x", 4, true)] }, right: { throws: [th("6", 6, false)] } },
        { index: 1, suppressed: true },
        { index: 2, suppressed: true, right: { throws: [th("4x", 4, true)] } },
        { index: 3, suppressed: true, left:  { throws: [th("5",  5, false)] } },
        { index: 4, suppressed: true, right: { throws: [th("5",  5, false)] } },
        { index: 5, suppressed: true },
      ])
    end
  end
end
