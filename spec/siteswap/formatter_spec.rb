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
