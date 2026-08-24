require_relative 'notation'

module Siteswap
  module Transforms
    Notation.import_into(self)

    # Rule 1 – divide every throw value by 2, mark all beats suppressed (!).
    # Halving can flip parity, which must be compensated by toggling x:
    #   v mod 4 == 0 → v/2 is even, parity unchanged → keep x as-is
    #   v mod 4 == 2 → v/2 is odd,  parity flipped  → toggle x
    # For MultiplexThrow, apply independently to each component throw.
    class Halve
      def label            = "halve"
      def dilation_factor  = 0.5

      def call(elements)
        elements.map do |b|
          SuppressedSyncBeat.new(left: halve_throw(b.left), right: halve_throw(b.right))
        end
      end

      private

      def halve_throw(t)
        case t
        when MultiplexThrow
          MultiplexThrow.new(throws: t.throws.map { |th| halve_single(th) }.sort_by(&:value))
        when Throw
          halve_single(t)
        end
      end

      def halve_single(t)
        v     = t.value / 2
        cross = (t.value % 4 == 2) ? !t.cross : t.cross
        Throw.new(value: v, cross: cross)
      end
    end

    # Rule 2 – X!(0,0)! → X (un-suppressed).
    # Consecutive suppressed beats whose second is empty collapse into one normal beat.
    class CancelPairs
      def label           = "cancel_pairs"
      def dilation_factor = 1.0

      def call(elements)
        result = []
        i = 0
        while i < elements.size
          b   = elements[i]
          nxt = elements[i + 1]
          if b.is_a?(SuppressedSyncBeat) && nxt&.is_a?(SuppressedSyncBeat) && nxt.empty?
            result << b.cancel
            i += 2
          else
            result << b
            i += 1
          end
        end
        result
      end
    end

    # Rule 3 – Expand all sync beats to explicit async with per-beat hand markers,
    # then strip markers already implied by strict R-L alternation.
    #   (0,0)!  → 0        (suppressed empty  → one async slot)
    #   (0,0)   → 0 0      (unsuppressed empty → two async slots)
    #   (0,N)!  → R N      (suppressed right)
    #   (N,0)!  → L N      (suppressed left)
    #   (0,N)   → R N 0    (unsuppressed right)
    #   (N,0)   → L N 0    (unsuppressed left)
    # Beats containing a MultiplexThrow are left in sync form — there is no
    # standard async notation for a simultaneous multi-throw.
    class Expand
      def label           = "expand"
      def dilation_factor = 1.0

      def call(elements)
        remove_redundant_markers(expand_all(elements))
      end

      private

      def expand_all(elements)
        elements.flat_map do |b|
          next [b] unless b.is_a?(SyncBeat) || b.is_a?(SuppressedSyncBeat)
          next [b] if b.left.is_a?(MultiplexThrow) || b.right.is_a?(MultiplexThrow)

          if b.empty?
            b.is_a?(SuppressedSyncBeat) ? [EmptySlot.new] : [EmptySlot.new, EmptySlot.new]
          elsif b.single_hand?
            hand  = b.left.value.zero? ? :right : :left
            slots = [HandAnnotation.new(hand), AsyncThrow.new(throw: b.active_throw)]
            slots << EmptySlot.new unless b.is_a?(SuppressedSyncBeat)
            slots
          else
            [b]
          end
        end
      end

      def remove_redundant_markers(elements)
        result   = []
        expected = nil

        elements.each do |el|
          case el
          when HandAnnotation
            next if el.hand == expected
            expected = el.hand
            result << el
          when AsyncThrow, EmptySlot
            expected = flip(expected) if expected
            result << el
          else
            expected = nil
            result << el
          end
        end

        result
      end

      def flip(hand) = hand == :right ? :left : :right
    end
  end
end
