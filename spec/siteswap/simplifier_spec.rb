RSpec.describe SiteswapSimplifier do
  let(:simplifier) { described_class.new }
  let(:formatter)  { SiteswapFormatter.new }

  BEAT_RE = /\(([0-9a-z]x?|\{\d+\}x?),([0-9a-z]x?|\{\d+\}x?)\)(!?)/

  def parse_throw(s)
    cross   = s.end_with?('x')
    val_str = cross ? s.chomp('x') : s
    value   = val_str.start_with?('{') ? val_str[1..-2].to_i : val_str.to_i(36)
    Siteswap::Notation::Throw.new(value: value, cross: cross)
  end

  def parse_beat_arr(str)
    str.scan(BEAT_RE).map { |l, r, _| [parse_throw(l), parse_throw(r)] }
  end

  describe 'known patterns' do
    subject(:result) { formatter.format(simplifier.simplify(input).elements) }

    context 'ground state' do
      context '3/2 – first known good' do
        let(:input) { parse_beat_arr("(8x,c)(0,0)(0,8x)(ax,0)(0,ax)(0,0)") }

        it 'produces the expected notation' do
          expect(result).to eq("(4x,6)R4x550")
        end
      end

      context '3/2 – crossing with 7' do
        let(:input) { parse_beat_arr("(cx,8)(0,0)(0,ex)(ax,0)(0,4x)(0,0)") }

        it 'produces the expected notation' do
          expect(result).to eq("(6x,4)R752x0")
        end
      end

      context '3/2 – mixed crossing heights' do
        let(:input) { parse_beat_arr("(8x,c)(0,0)(0,8x)(c,0)(0,8)(0,0)") }

        it 'produces the expected notation' do
          expect(result).to eq("(4x,6)R4x640")
        end
      end
    end

    context '4/3 patterns' do
      context '4/3 – first ground' do
        let(:input) { parse_beat_arr("(cx,gx)(0,0)(0,0)(0,c)(g,0)(0,0)(0,c)(0,0)(ex,0)(0,ex)(0,0)(0,0)") }

        it 'produces the expected notation' do
          expect(result).to eq("(6x,8x)0R680R60L7700")
        end
      end

      context '4/3 – second ground' do
        let(:input) { parse_beat_arr("(cx,gx)(0,0)(0,0)(0,c)(g,0)(0,0)(0,c)(0,0)(g,0)(0,c)(0,0)(0,0)") }

        it 'produces the expected notation' do
          expect(result).to eq("(6x,8x)0R680R60L8600")
        end
      end
    end

    context 'active state' do
      context '3/2 – low crossing sync' do
        let(:input) { parse_beat_arr("(4x,6x)(0,0)(0,4)(i,0)(0,g)(0,0)") }

        it 'produces the expected notation' do
          expect(result).to eq("(2x,3)R29x80")
        end
      end

      context '3/2 – high crossing sync' do
        let(:input) { parse_beat_arr("(8x,4)(0,0)(0,ex)(6,0)(0,g)(0,0)") }

        it 'produces the expected notation' do
          expect(result).to eq("(4x,2)R73x80")
        end
      end

      context '3/2 – symmetric crossing' do
        let(:input) { parse_beat_arr("(c,6x)(0,0)(0,c)(6x,0)(0,c)(0,0)") }

        it 'produces the expected notation' do
          expect(result).to eq("(6,3)R6360")
        end
      end
    end
  end
end
