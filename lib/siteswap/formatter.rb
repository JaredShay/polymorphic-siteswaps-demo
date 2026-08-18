require_relative 'notation'

# Serializes a notation sequence into a siteswap string.
class SiteswapFormatter
  SyncBeat           = Siteswap::Notation::SyncBeat
  SuppressedSyncBeat = Siteswap::Notation::SuppressedSyncBeat
  AsyncThrow         = Siteswap::Notation::AsyncThrow
  EmptySlot          = Siteswap::Notation::EmptySlot

  def format(elements)
    elements.map { |el| render(el) }.join
  end

  private

  def render(el)
    case el
    when SuppressedSyncBeat then "(#{fmt_throw(el.left)},#{fmt_throw(el.right)})!"
    when SyncBeat           then "(#{fmt_throw(el.left)},#{fmt_throw(el.right)})"
    when AsyncThrow         then fmt_throw(el.throw)
    when EmptySlot          then "0"
    end
  end

  def fmt_throw(t)
    s = t.value.to_s(36)
    t.cross ? "#{s}x" : s
  end
end
