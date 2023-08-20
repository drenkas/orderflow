import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { DatabaseService } from '@database/database.service'

@Injectable()
export class AppService {
  constructor(private readonly databaseService: DatabaseService) {}

  @Cron('45 0,4,8,12,16,20 * * *')
  async handlePrune() {
    await this.databaseService.pruneOldData()
  }
}
