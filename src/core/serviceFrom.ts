import { z } from 'zod';
import { ImplementedContract, CurriedImplementation } from './defineContract';
import { ErrorUnion } from './errors';

// Helper type to extract dependency types from a contract
type ExtractDependencies<T> = T extends ImplementedContract<any, any, infer TDeps, any, any> ? TDeps : never;

// Helper type to extract error types from a contract
type ExtractErrors<T> = T extends ImplementedContract<any, any, any, any, infer TErrors> ? TErrors : never;

// Helper type to merge all dependencies from multiple contracts
type MergeDependencies<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = {
  [K in keyof T]: ExtractDependencies<T[K]>
}[keyof T];

// Helper type to merge all error types from multiple contracts
type MergeErrors<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = 
  ErrorUnion<ExtractErrors<T[keyof T]>>;

// Type for the service with all contract metadata
type ServiceWithContracts<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = {
  [K in keyof T]: T[K] extends ImplementedContract<infer TInput, infer TOutput, infer TDeps, infer TOptions, infer TErrors>
    ? Omit<T[K], 'run' | 'withDependencies'> & {
        run: CurriedImplementation<z.infer<TInput>, z.infer<TOutput>, TOptions, ErrorUnion<TErrors>>;
      }
    : never
};

// Type for the curried service (simple version)
type CurriedService<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = {
  [K in keyof T]: T[K] extends ImplementedContract<infer TInput, infer TOutput, any, infer TOptions, infer TErrors>
    ? CurriedImplementation<z.infer<TInput>, z.infer<TOutput>, TOptions, ErrorUnion<TErrors>>
    : never
};

// The serviceFrom utility function
export function serviceFrom<
  T extends Record<string, ImplementedContract<any, any, any, any, any>>
>(
  commands: T
): (deps: MergeDependencies<T>) => ServiceWithContracts<T> {
  return (deps: MergeDependencies<T>) => {
    const service = {} as ServiceWithContracts<T>;
    
    for (const [commandName, contract] of Object.entries(commands)) {
      // Create a curried version of each command with the provided dependencies
      const curriedCommand = contract.withDependencies(deps);
      
      // Build the service command with all contract metadata but curried run
      service[commandName as keyof T] = {
        schemas: contract.schemas,
        types: contract.types,
        errors: contract.errors,
        validateInput: contract.validateInput,
        validateOutput: contract.validateOutput,
        run: curriedCommand,
      } as any;
    }
    
    return service;
  };
}

// Alternative: Return just the curried functions for a cleaner API
export function serviceFromSimple<
  T extends Record<string, ImplementedContract<any, any, any, any, any>>
>(
  commands: T
): (deps: MergeDependencies<T>) => CurriedService<T> {
  return (deps: MergeDependencies<T>) => {
    const service = {} as CurriedService<T>;
    
    for (const [commandName, contract] of Object.entries(commands)) {
      service[commandName as keyof T] = contract.withDependencies(deps) as any;
    }
    
    return service;
  };
}

// Export helper types for consumers
export type ServiceDependencies<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = MergeDependencies<T>;
export type ServiceErrors<T extends Record<string, ImplementedContract<any, any, any, any, any>>> = MergeErrors<T>;