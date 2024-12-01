import { Injectable } from '@nestjs/common';

@Injectable()
export class GateioService {
  getHello(): string {
    return 'Hello World!';
  }
}
