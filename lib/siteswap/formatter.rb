require_relative 'notation'

module Siteswap
  module Formatters
    Siteswap::Notation.import_into(self)

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

    # Serializes a notation beat sequence into an array of ApiBeat hashes
    # for structured UI rendering.
    #
    # Each beat:
    #   { index: int, suppressed: bool }
    #   { index: int, suppressed: bool, left:  { throws: [{label:,value:,cross:},...] } }
    #   { index: int, suppressed: bool, right: { throws: [{label:,value:,cross:},...] } }
    #   { index: int, suppressed: bool, left: {...}, right: {...} }
    #
    # left/right are omitted when both throws for that hand are zero (silent).
    class Beats
      def format(elements)
        elements.each_with_index.map { |b, i| classify(b, i) }
      end

      private

      def classify(b, index)
        suppressed = b.is_a?(SuppressedSyncBeat)
        result     = { index: index, suppressed: suppressed }

        left_throws  = hand_throws(b.left)
        right_throws = hand_throws(b.right)

        result[:left]  = { throws: left_throws  } unless left_throws.empty?
        result[:right] = { throws: right_throws } unless right_throws.empty?

        result
      end

      def hand_throws(t)
        case t
        when MultiplexThrow
          t.throws.sort_by(&:value).map { |th| throw_obj(th) }
        when Throw
          t.value.zero? ? [] : [throw_obj(t)]
        end
      end

      def throw_obj(t)
        s     = t.value <= 35 ? t.value.to_s(36) : "{#{t.value}}"
        label = t.cross ? "#{s}x" : s
        { label: label, value: t.value, cross: t.cross }
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
