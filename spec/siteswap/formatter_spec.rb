RSpec.describe SiteswapFormatter do
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

RSpec.describe SiteswapBeatsFormatter do
  let(:notation) { Siteswap::Notation }
  subject(:result) { described_class.new.format(beats) }

  def ssb(left_val, left_cross, right_val, right_cross)
    notation::SuppressedSyncBeat.new(
      left:  notation::Throw.new(value: left_val,  cross: left_cross),
      right: notation::Throw.new(value: right_val, cross: right_cross)
    )
  end

  context 'with a rest beat (both zero)' do
    let(:beats) { [ssb(0, false, 0, false)] }

    it 'returns kind: rest' do
      expect(result).to eq([{ kind: "rest" }])
    end
  end

  context 'with a left-only beat' do
    let(:beats) { [ssb(5, false, 0, false)] }

    it 'returns kind: left with the left throw value' do
      expect(result).to eq([{ kind: "left", left: "5" }])
    end
  end

  context 'with a right-only beat' do
    let(:beats) { [ssb(0, false, 4, true)] }

    it 'returns kind: right with the right throw value including x' do
      expect(result).to eq([{ kind: "right", right: "4x" }])
    end
  end

  context 'with a sync beat (both non-zero)' do
    let(:beats) { [ssb(4, true, 6, false)] }

    it 'returns kind: sync with both throw values' do
      expect(result).to eq([{ kind: "sync", left: "4x", right: "6" }])
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

    it 'classifies each beat correctly' do
      expect(result).to eq([
        { kind: "sync",  left: "4x", right: "6" },
        { kind: "rest" },
        { kind: "right", right: "4x" },
        { kind: "left",  left: "5" },
        { kind: "right", right: "5" },
        { kind: "rest" },
      ])
    end
  end
end
