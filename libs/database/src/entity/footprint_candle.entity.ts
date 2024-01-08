/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable indent */
import { Entity, PrimaryGeneratedColumn, Column, Index, OneToMany, JoinColumn } from 'typeorm'
import { IPriceLevelClosed } from '../../../orderflow/src/dto/orderflow.dto'

export const KlineUniqueColumns = ['exchange', 'symbol', 'interval', 'openTime', 'closeTime']

@Entity({ name: 'footprint_candle' })
@Index(KlineUniqueColumns, { unique: true })
export class FootPrintCandle {
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
  volumeDelta: number

  @Column('double precision')
  volume: number

  @Column('double precision', { default: 0 })
  aggressiveBid: number

  @Column('double precision', { default: 0 })
  aggressiveAsk: number

  @Column('double precision', { default: 0 })
  aggressiveBidImbalancePercent: number

  @Column('double precision')
  high: number

  @Column('double precision')
  low: number

  @Column('double precision')
  close: number

  // Storing bid and ask as JSON
  @Column('jsonb', { default: {} })
  // @OneToMany(() => FootPrintCandleLevel, (level) => level.closeTime)
  // @JoinColumn()
  priceLevels: Record<string, IPriceLevelClosed>
}
