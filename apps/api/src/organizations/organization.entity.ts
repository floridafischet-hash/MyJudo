import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 64, default: 'Europe/Berlin' })
  timezone!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
