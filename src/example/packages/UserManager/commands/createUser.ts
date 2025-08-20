import { ok, err } from 'neverthrow';
import { 
  createUserContract,
  UserAlreadyExistsError,
  UserRepositoryError,
  InvalidUserDataError,
} from '../../contracts/UserManager/index.ts';

/**
 * Implementation of the createUser command.
 * 
 * This command creates a new user with validation, duplicate checking,
 * and proper error handling.
 */
export const createUser = createUserContract.implementation(async ({ input, deps, options }) => {
  try {
    deps.logger.info('Creating user', { email: input.email });

    // Additional validation
    if (input.name.includes('@')) {
      return err(new InvalidUserDataError(
        { field: 'name', reason: 'Name cannot contain @ symbol' }
      ));
    }

    // Check for existing user unless skipped
    if (!options?.skipDuplicateCheck) {
      try {
        const existingUser = await deps.userRepository.findByEmail(input.email);
        if (existingUser) {
          return err(new UserAlreadyExistsError({ email: input.email }));
        }
      } catch (error) {
        return err(new UserRepositoryError(
          { operation: 'findByEmail', details: error?.toString() },
          'Failed to check for existing user',
          error
        ));
      }
    }

    // Create the new user
    const newUser = {
      id: deps.idGenerator.generate(),
      email: input.email,
      name: input.name,
      age: input.age,
      createdAt: new Date(),
    };

    // Save to repository
    try {
      await deps.userRepository.save(newUser);
    } catch (error) {
      return err(new UserRepositoryError(
        { operation: 'save', details: error?.toString() },
        'Failed to save user',
        error
      ));
    }
    
    deps.logger.info('User created successfully', { userId: newUser.id });

    // Return the created user
    return ok(newUser);
  } catch (error) {
    // This should not happen if we handle all cases above
    deps.logger.error('Unexpected error in createUser', error as Error);
    return err(new UserRepositoryError(
      { operation: 'createUser', details: 'Unexpected error' },
      'An unexpected error occurred',
      error
    ));
  }
});