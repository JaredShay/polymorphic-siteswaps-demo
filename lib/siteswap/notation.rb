module Siteswap
  module Notation
    Throw = Struct.new(:value, :cross)

    module SyncBeatMethods
      def empty?       = left.value.zero? && right.value.zero?
      def single_hand? = left.value.zero? ^ right.value.zero?
      def active_throw = left.value.zero? ? right : left
    end

    SyncBeat = Struct.new(:left, :right) do
      include SyncBeatMethods
    end

    SuppressedSyncBeat = Struct.new(:left, :right) do
      include SyncBeatMethods
      def cancel = SyncBeat.new(left, right)
    end

    AsyncThrow = Struct.new(:throw)

    EmptySlot = Class.new
  end
end
