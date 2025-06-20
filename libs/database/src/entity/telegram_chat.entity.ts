import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'telegram_chats' })
export class TelegramChat {
  @PrimaryColumn('bigint')
    chatId!: string;

  @CreateDateColumn()
    createdAt!: Date;
}
