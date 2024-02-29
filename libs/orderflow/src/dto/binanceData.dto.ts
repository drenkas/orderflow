export interface IAggregatedTrade {
  aggTradeId: number
  price: number
  quantity: number
  firstTradeId: number
  lastTradeId: number
  transactTime: number
  isBuyerMaker: boolean
}
