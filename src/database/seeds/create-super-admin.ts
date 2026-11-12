import 'dotenv/config';
import * as argon2 from 'argon2';
import { UserRole } from '../../common/enums/user-role.enum';
import { normalizeEmail } from '../../common/utils/normalize-email';
import { User } from '../../users/entities/user.entity';
import { AppDataSource } from '../data-source';

async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const fullName = process.env.SUPER_ADMIN_FULL_NAME ?? 'Super Administrator';

  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required');
  }

  if (password.length < 8) {
    throw new Error('SUPER_ADMIN_PASSWORD must be at least 8 characters');
  }

  await AppDataSource.initialize();

  try {
    const usersRepository = AppDataSource.getRepository(User);
    const normalizedEmail = normalizeEmail(email);
    const existingUser = await usersRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      console.log(`A user with email ${normalizedEmail} already exists`);
      return;
    }

    const passwordHash = await argon2.hash(password);
    const user = usersRepository.create({
      email: normalizedEmail,
      passwordHash,
      fullName,
      role: UserRole.SUPER_ADMIN,
    });

    await usersRepository.save(user);
    console.log(`Super administrator ${normalizedEmail} created`);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

seedSuperAdmin().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
