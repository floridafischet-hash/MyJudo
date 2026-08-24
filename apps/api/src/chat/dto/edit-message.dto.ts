import { IsString, Length } from 'class-validator';

export class EditMessageDto {
  @IsString()
  @Length(1, 4000)
  text!: string;
}
