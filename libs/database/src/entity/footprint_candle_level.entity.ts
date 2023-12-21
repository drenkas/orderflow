/* eslint-disable indent */
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm'

export const UniqueColumns = ['openTime', 'exchange', 'interval', 'symbol', 'priceLevel']

@Entity({ name: 'footprint_candle_level' })
@Index(UniqueColumns, { unique: true })
export class FootPrintCandleLevel {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'timestamptz' })
  openTime: Date

  @Column({ type: 'timestamptz' })
  closeTime: Date

  @Column()
  exchange: string

  @Column()
  interval: string

  @Column()
  symbol: string

  @Column('double precision')
  priceLevel: number

  @Column('double precision')
  volSumBid: number

  @Column('double precision')
  volSumAsk: number

  @Column('double precision')
  bidImbalancePercent: number
}
