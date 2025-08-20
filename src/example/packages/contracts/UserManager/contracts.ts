import { z } from 'zod';
import { defineContract } from '../../../../core/defineContract.ts';
import { createUserErrors } from './errors.ts';

/**
 * Repository interface for user data persistence
 */
export interface UserRepository {
  save: (user: any) => Promise<void>;
  findByEmail: (email: string) => Promise<any | null>;
  findById: (id: string) => Promise<any | null>;
  update: (id: string, updates: any) => Promise<void>;
  delete: (id: string) => Promise<void>;
}

/**
 * Service for generating unique identifiers
 */
export interface IdGenerator {
  generate: () => string;
}

/**
 * Logging service interface
 */
export interface Logger {
  info: (message: string, data?: any) => void;
  error: (message: string, error: Error) => void;
  warn: (message: string, data?: any) => void;
  debug: (message: string, data?: any) => void;
}

/**
 * Email service interface
 */
export interface EmailService {
  sendWelcomeEmail: (email: string, name: string) => Promise<void>;
  sendNotification: (email: string, subject: string, body: string) => Promise<void>;
}

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

/**
 * Type definitions for UserManager dependencies
 */
export type UserManagerDependencies = {
  userRepository: UserRepository;
  idGenerator: IdGenerator;
  logger: Logger;
  emailService?: EmailService;
};

/**
 * Input type for creating a user
 */
export type CreateUserInput = z.infer<typeof createUserContract.schemas.input>;

/**
 * Output type for user creation
 */
export type CreateUserOutput = z.infer<typeof createUserContract.schemas.output>;

/**
 * Options for user creation
 */
export type CreateUserOptions = {
  skipDuplicateCheck?: boolean;
  sendWelcomeEmail?: boolean;
};
