/* eslint-disable indent */
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm'

export const KlineUniqueColumns = ['exchange', 'symbol', 'interval', 'openTime']

@Entity({ name: 'footprint_candle' })
@Index(KlineUniqueColumns, { unique: true })
export class FootPrintCandle {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'timestamptz' })
  openTime: Date

  @Column()
  exchange: string

  @Column()
  interval: string

  @Column()
  symbol: string

  @Column('double precision')
  delta: number

  @Column('double precision')
  volume: number

  @Column('double precision', { default: 0 })
  aggressiveBid: number

  @Column('double precision', { default: 0 })
  aggressiveAsk: number

  @Column('double precision')
  high: number

  @Column('double precision')
  low: number

  // Storing bid and ask as JSON
  @Column('jsonb', { default: {} })
  bid: Record<string, number>

  @Column('jsonb', { default: {} })
  ask: Record<string, number>
}
