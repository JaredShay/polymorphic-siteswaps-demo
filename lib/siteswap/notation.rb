require 'dry-struct'
require_relative 'types'

module Siteswap
  module Notation
    class Throw < Dry::Struct
      attribute :value, Types::Strict::Integer.constrained(gteq: 0)
      attribute :cross, Types::Strict::Bool

      def empty? = value.zero?
    end

    module SyncBeatMethods
      def empty?       = left.value.zero? && right.value.zero?
      def single_hand? = left.value.zero? ^ right.value.zero?
      def active_throw = left.value.zero? ? right : left
    end

    class SyncBeat < Dry::Struct
      include SyncBeatMethods
      attribute :left,  Types.Instance(Throw)
      attribute :right, Types.Instance(Throw)
    end

    class SuppressedSyncBeat < Dry::Struct
      include SyncBeatMethods
      attribute :left,  Types.Instance(Throw)
      attribute :right, Types.Instance(Throw)

      def cancel = SyncBeat.new(left: left, right: right)
    end

    class AsyncThrow < Dry::Struct
      attribute :throw, Types.Instance(Throw)
    end

    EmptySlot = Class.new

    NotationElement =
      Types.Instance(SyncBeat) |
      Types.Instance(SuppressedSyncBeat) |
      Types.Instance(AsyncThrow) |
      Types.Instance(EmptySlot)
  end
end
