export function roundToTickSize(price: number, tickSize: string): number {
  const tick = parseFloat(tickSize)
  const decimals = (tickSize.split('.')[1] || '').length
  const roundedPrice = Math.round(price / tick) * tick
  return parseFloat(roundedPrice.toFixed(decimals))
}
