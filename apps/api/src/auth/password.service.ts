import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  private readonly pepper: string;

  constructor(config: ConfigService) {
    this.pepper = config.getOrThrow<string>('PASSWORD_PEPPER');
  }

  hash(password: string): Promise<string> {
    return argon2.hash(`${password}${this.pepper}`, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, `${password}${this.pepper}`);
  }
}
