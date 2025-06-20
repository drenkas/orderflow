import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TelegramBot = require('node-telegram-bot-api');
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramChat } from '@database/entity/telegram_chat.entity';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: any;

  constructor(
    @InjectRepository(TelegramChat)
    private readonly chatRepo: Repository<TelegramChat>
  ) {
    const token = process.env.TG_BOT_API;
    if (!token) {
      throw new Error('TG_BOT_API not provided in env');
    }

    this.bot = new TelegramBot(token, { polling: true });

    this.bot.onText(/\/start/i, async (msg) => {
      const chatId = msg.chat.id.toString();
      await this.registerChat(chatId);
      this.bot.sendMessage(chatId, '✅ Підписка на сповіщення Orderflow активована');
    });
  }

  private async registerChat(chatId: string): Promise<void> {
    try {
      await this.chatRepo.upsert({ chatId }, [ 'chatId' ]);
      this.logger.log(`Telegram chat registered: ${chatId}`);
    } catch (e) {
      this.logger.error(`Failed to register chat ${chatId}`, e as any);
    }
  }

  async broadcast(message: string): Promise<void> {
    const chats = await this.chatRepo.find();

    for (const chat of chats) {
      try {
        await this.bot.sendMessage(chat.chatId, message, { parse_mode: 'Markdown' });
      } catch (err: any) {
        // 403: bot was blocked by the user => remove chat
        if (err?.response?.statusCode === 403) {
          await this.chatRepo.delete({ chatId: chat.chatId });
          this.logger.warn(`Chat ${chat.chatId} removed (blocked bot)`);
        } else {
          this.logger.error(`Failed to send message to chat ${chat.chatId}`, err);
        }
      }
    }
  }

  async send(chatId: string, message: string): Promise<void> {
    await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }
}
