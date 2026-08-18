require_relative '../lib/siteswap/simplifier'
require_relative '../lib/siteswap/formatter'
require_relative '../lib/siteswap/notation'

# Parse a sync siteswap string into a generator-compatible beat array
# [[left_throw, right_throw], ...] using SiteswapSimplifier::Throw.
BEAT_RE = /\(([0-9a-z]x?),([0-9a-z]x?)\)(!?)/

def parse_beat_arr(str)
  str.scan(BEAT_RE).map do |l_str, r_str, _|
    [parse_throw(l_str), parse_throw(r_str)]
  end
end

def parse_throw(s)
  cross = s.end_with?('x')
  value = (cross ? s.chomp('x') : s).to_i(36)
  Siteswap::Notation::Throw.new(value, cross)
end

SIMPLIFIER = SiteswapSimplifier.new
FORMATTER  = SiteswapFormatter.new

CASES = [
  {
    input:    "(8x,c)(0,0)(0,8x)(ax,0)(0,ax)(0,0)",
    expected: "(4x,6)4x550",
    note:     "3/2 ground – first known good",
  },
  {
    input:    "(cx,8)(0,0)(0,ex)(ax,0)(0,4x)(0,0)",
    expected: "(6x,4)752x0",
    note:     "3/2 ground – confirmed in parity",
  },
  {
    input:    "(8x,c)(0,0)(0,8x)(c,0)(0,8)(0,0)",
    expected: "(4x,6)4x640",
    note:     "3/2 ground – confirmed in parity",
  },
  {
    input:    "(4x,6x)(0,0)(0,4)(i,0)(0,g)(0,0)",
    expected: "(2x,3)29x80",
    note:     "3/2 active – confirmed in parity",
  },
  {
    input:    "(8x,4)(0,0)(0,ex)(6,0)(0,g)(0,0)",
    expected: "(4x,2)73x80",
    note:     "3/2 active – confirmed in parity",
  },
  {
    input:    "(c,6x)(0,0)(0,c)(6x,0)(0,c)(0,0)",
    expected: "(6,3)6360",
    note:     "3/2 active – confirmed in parity",
  },
].freeze

passed = 0
failed = 0

CASES.each do |tc|
  beat_arr = parse_beat_arr(tc[:input])
  got      = FORMATTER.format(SIMPLIFIER.simplify(beat_arr))

  if got == tc[:expected]
    puts "PASS  #{tc[:note]}"
    puts "      #{tc[:input]}"
    puts "   -> #{got}"
    passed += 1
  else
    puts "FAIL  #{tc[:note]}"
    puts "      input:    #{tc[:input]}"
    puts "      expected: #{tc[:expected]}"
    puts "      got:      #{got}"
    failed += 1
  end
  puts
end

puts "#{passed} passed, #{failed} failed"
