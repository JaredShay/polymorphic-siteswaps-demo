RSpec.describe SiteswapFormatter do
  subject(:formatter) { described_class.new.format(input) }

  let(:notation) { Siteswap::Notation }
  let(:throw_l) { notation::Throw.new(4, true) }
  let(:throw_r) { notation::Throw.new(6, false) }

  describe '#format' do
    context 'with a sync beat' do
      let(:input) { [notation::SyncBeat.new(throw_l, throw_r)] }

      it 'formats correctly' do
        expect(subject).to eq("(4x,6)")
      end
    end

    context 'with a suppressed sync beat' do
      let(:throw_l) { notation::Throw.new(4, false) }
      let(:throw_r) { notation::Throw.new(6, false) }
      let(:input) { [notation::SuppressedSyncBeat.new(throw_l, throw_r)] }

      it 'appends !' do
        expect(subject).to eq("(4,6)!")
      end
    end

    context 'with an async throw' do
      let(:throw_l) { notation::Throw.new(5, false) }
      let(:input) { [notation::AsyncThrow.new(throw_l)] }

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
