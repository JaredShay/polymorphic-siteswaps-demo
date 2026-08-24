require 'dry-struct'
require_relative 'types'

module Siteswap
  module Notation
    class Throw < Dry::Struct
      attribute :value, Types::Strict::Integer.constrained(gteq: 0)
      attribute :cross, Types::Strict::Bool

      def empty? = value.zero?
    end

    class MultiplexThrow < Dry::Struct
      attribute :throws, Types::Strict::Array.of(Types.Instance(Throw))
                           .constrained(min_size: 2)

      def empty? = false
      def value  = throws.sum(&:value)
      def values = throws.map(&:value)
    end

    ThrowOrMultiplex = Types.Instance(Throw) | Types.Instance(MultiplexThrow)

    module SyncBeatMethods
      def empty?       = left.value.zero? && right.value.zero?
      def single_hand? = left.value.zero? ^ right.value.zero?
      def active_throw = left.value.zero? ? right : left
    end

    class SyncBeat < Dry::Struct
      include SyncBeatMethods
      attribute :left,  ThrowOrMultiplex
      attribute :right, ThrowOrMultiplex
    end

    class SuppressedSyncBeat < Dry::Struct
      include SyncBeatMethods
      attribute :left,  ThrowOrMultiplex
      attribute :right, ThrowOrMultiplex

      def cancel = SyncBeat.new(left: left, right: right)
    end

    class AsyncThrow < Dry::Struct
      attribute :throw, Types.Instance(Throw)
    end

    EmptySlot = Class.new

    HandAnnotation = Struct.new(:hand)  # hand: :left | :right

    NotationElement =
      Types.Instance(SyncBeat) |
      Types.Instance(SuppressedSyncBeat) |
      Types.Instance(AsyncThrow) |
      Types.Instance(EmptySlot) |
      Types.Instance(HandAnnotation)

    # Useful for referencing the constants here without needing the full name
    # space of this module.
    def self.import_into(target)
      constants.each { |name| target.const_set(name, const_get(name)) }
    end
  end
end
