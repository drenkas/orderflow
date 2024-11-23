import { Injectable } from '@nestjs/common';

@Injectable()
export class OkxService {
  getHello(): string {
    return 'Hello World!';
  }
}
