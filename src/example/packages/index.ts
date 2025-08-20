/**
 * Example Packages
 * 
 * This directory demonstrates the recommended package structure:
 * 
 * - contracts/: Contains all service contracts, interfaces, and error definitions
 * - UserManager/: Contains implementations of the UserManager contracts
 * 
 * This separation allows for:
 * - Clear contract definitions independent of implementation
 * - Easy testing by mocking contracts
 * - Multiple implementations of the same contracts
 * - Better dependency management
 */

// Re-export contracts for easy access
export * from './contracts/index.ts';

// Re-export implementations
export * from './UserManager/index.ts';
