import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderflowApiService {
  getHello(): string {
    return 'Hello World!';
  }
}
