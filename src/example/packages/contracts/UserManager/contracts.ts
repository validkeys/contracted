import { z } from 'zod';
import { defineContract } from '../../../../core/defineContract.ts';
import { createUserErrors } from './errors.ts';
import { 
  UserRepository, 
  IdGenerator, 
  Logger, 
  EmailService 
} from '../infrastructure.ts';

/**
 * Contract for creating a new user
 */
export const createUserContract = defineContract({
  input: z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    age: z.number().min(18).max(120),
  }),
  output: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    age: z.number(),
    createdAt: z.date(),
  }),
  dependencies: {
    userRepository: {} as UserRepository,
    idGenerator: {} as IdGenerator,
    logger: {} as Logger,
  },
  options: {} as {
    skipDuplicateCheck?: boolean;
    sendWelcomeEmail?: boolean;
  },
  errors: createUserErrors,
});
