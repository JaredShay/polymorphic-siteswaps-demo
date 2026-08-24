require_relative 'notation'

module Siteswap
  module Formatters
    SuppressedSyncBeat = Siteswap::Notation::SuppressedSyncBeat
    SyncBeat           = Siteswap::Notation::SyncBeat
    AsyncThrow         = Siteswap::Notation::AsyncThrow
    EmptySlot          = Siteswap::Notation::EmptySlot
    HandAnnotation     = Siteswap::Notation::HandAnnotation
    MultiplexThrow     = Siteswap::Notation::MultiplexThrow

    # Serializes a notation sequence into a siteswap string.
    class Pattern
      def format(elements)
        elements.map { |el| render(el) }.join
      end

      private

      def render(el)
        case el
        when SuppressedSyncBeat then "(#{fmt_throw(el.left)},#{fmt_throw(el.right)})!"
        when SyncBeat           then "(#{fmt_throw(el.left)},#{fmt_throw(el.right)})"
        when AsyncThrow         then fmt_throw(el.throw)
        when HandAnnotation     then el.hand == :right ? "R" : "L"
        when EmptySlot          then "0"
        else raise TypeError, "unexpected notation element: #{el.class}"
        end
      end

      def fmt_throw(t)
        case t
        when MultiplexThrow
          inner = t.throws.sort_by(&:value).map { |th| fmt_single(th) }.join
          "[#{inner}]"
        when Throw
          fmt_single(t)
        end
      end

      def fmt_single(t)
        s = t.value <= 35 ? t.value.to_s(36) : "{#{t.value}}"
        t.cross ? "#{s}x" : s
      end
    end

    # Serializes a notation beat sequence into an array of beat token hashes
    # for structured UI rendering.
    #
    # Each beat is classified by kind and whether it is suppressed:
    #   { kind: "rest",      suppressed: bool }
    #   { kind: "left",      left:  "5x",         suppressed: bool }
    #   { kind: "right",     right: "4",           suppressed: bool }
    #   { kind: "sync",      left:  "4x", right: "6", suppressed: bool }
    #   { kind: "multiplex", hand:  "left", throws: ["4", "6x"], suppressed: bool }
    class Beats
      def format(elements)
        elements.map { |b| classify(b) }
      end

      private

      def classify(b)
        suppressed = b.is_a?(SuppressedSyncBeat)
        left_mp    = b.left.is_a?(MultiplexThrow)
        right_mp   = b.right.is_a?(MultiplexThrow)

        if b.empty?
          { kind: "rest", suppressed: suppressed }
        elsif left_mp && b.right.value.zero?
          { kind: "multiplex", hand: "left",  throws: fmt_multiplex_throws(b.left),  suppressed: suppressed }
        elsif right_mp && b.left.value.zero?
          { kind: "multiplex", hand: "right", throws: fmt_multiplex_throws(b.right), suppressed: suppressed }
        elsif left_mp || right_mp
          { kind: "sync", left: fmt(b.left), right: fmt(b.right), suppressed: suppressed }
        elsif b.left.value.zero?
          { kind: "right", right: fmt(b.right), suppressed: suppressed }
        elsif b.right.value.zero?
          { kind: "left", left: fmt(b.left), suppressed: suppressed }
        else
          { kind: "sync", left: fmt(b.left), right: fmt(b.right), suppressed: suppressed }
        end
      end

      def fmt(t)
        case t
        when MultiplexThrow
          "[#{fmt_multiplex_throws(t).join}]"
        when Throw
          s = t.value <= 35 ? t.value.to_s(36) : "{#{t.value}}"
          t.cross ? "#{s}x" : s
        end
      end

      def fmt_multiplex_throws(mt)
        mt.throws.sort_by(&:value).map do |t|
          s = t.value <= 35 ? t.value.to_s(36) : "{#{t.value}}"
          t.cross ? "#{s}x" : s
        end
      end
    end

    # Formats a raw beat array into a hash of named representations,
    # each with its own transform pipeline and output formatter.
    #
    # Presets map a name to a config hash:
    #   { transforms: [transform, ...], formatter: <formatter> }
    #
    # Example:
    #   Siteswap::Formatters::Multi.new(presets: {
    #     halved:     { transforms: [HALVE],                    formatter: Pattern.new },
    #     simplified: { transforms: [HALVE, CANCEL_PAIRS, EXPAND], formatter: Pattern.new },
    #     beats:      { transforms: [HALVE],                    formatter: Beats.new },
    #   })
    #
    # Calling format(beat_arr) returns:
    #   { halved: "(4x,6)!...", simplified: "(4x,6)R4x550", beats: [...],
    #     multiplex: false, multiplex_slots: [] }
    class Multi
      def initialize(presets:)
        @presets = presets
      end

      def format(beat_arr)
        raw    = beat_arr.map { |l, r| SuppressedSyncBeat.new(left: l, right: r) }
        result = @presets.transform_values do |config|
          elements = config[:transforms].reduce(raw) { |els, t| t.call(els) }
          config[:formatter].format(elements)
        end
        is_multiplex = beat_arr.any? { |l, r| l.is_a?(MultiplexThrow) || r.is_a?(MultiplexThrow) }
        result[:multiplex]       = is_multiplex
        result[:multiplex_slots] = is_multiplex ? compute_multiplex_slots(beat_arr) : []
        result
      end

      private

      def compute_multiplex_slots(beat_arr)
        slots = []
        beat_arr.each_with_index do |(l, r), beat|
          slots << { beat: beat, hand: "left",  throws: fmt_multiplex_throws(l) } if l.is_a?(MultiplexThrow)
          slots << { beat: beat, hand: "right", throws: fmt_multiplex_throws(r) } if r.is_a?(MultiplexThrow)
        end
        slots
      end

      def fmt_multiplex_throws(mt)
        mt.throws.sort_by(&:value).map do |t|
          s = t.value <= 35 ? t.value.to_s(36) : "{#{t.value}}"
          t.cross ? "#{s}x" : s
        end
      end
    end
  end
end
