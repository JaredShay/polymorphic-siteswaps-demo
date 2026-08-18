module Siteswap
  module Notation
    Throw = Struct.new(:value, :cross)

    SyncBeat = Struct.new(:left, :right, :suppressed) do
      def empty?       = left.value.zero? && right.value.zero?
      def single_hand? = left.value.zero? ^ right.value.zero?
      def active_throw = left.value.zero? ? right : left
    end

    AsyncThrow = Struct.new(:throw)

    EmptySlot = Class.new
  end
end
