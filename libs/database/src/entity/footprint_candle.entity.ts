/* eslint-disable indent */
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm'

@Entity({ name: 'footprint_candle' })
@Index('idx_footprint_candle_timestamp', ['timestamp'])
export class FootPrintCandle {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ type: 'timestamptz' })
  timestamp: Date

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
