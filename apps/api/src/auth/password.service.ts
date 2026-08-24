import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  constructor(private readonly config: ConfigService) {}

  hash(password: string): Promise<string> {
    return argon2.hash(this.peppered(password), { type: argon2.argon2id });
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, this.peppered(password));
  }

  private peppered(password: string): string {
    return `${password}${this.config.getOrThrow<string>('PASSWORD_PEPPER')}`;
  }
}
