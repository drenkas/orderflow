import { Injectable } from '@nestjs/common';

@Injectable()
export class BitgetService {
  getHello(): string {
    return 'Hello World!';
  }
}
