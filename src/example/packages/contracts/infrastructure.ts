/**
 * Infrastructure Contracts
 * 
 * This file contains shared infrastructure interfaces that can be used
 * across multiple services and domains.
 */

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
