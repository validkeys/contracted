import { 
  createUserCommand,
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
export const createUser = createUserCommand.implementation(async ({ input, deps, options }) => {
  deps.logger.info('Creating user', { email: input.email });

  // Additional validation
  if (input.name.includes('@')) {
    throw new InvalidUserDataError(
      { field: 'name', reason: 'Name cannot contain @ symbol' }
    );
  }

  // Check for existing user unless skipped
  if (!options?.skipDuplicateCheck) {
    try {
      const existingUser = await deps.userRepository.findByEmail(input.email);
      if (existingUser) {
        throw new UserAlreadyExistsError({ email: input.email });
      }
    } catch (error) {
      throw new UserRepositoryError(
        { operation: 'findByEmail', details: error?.toString() },
        'Failed to check for existing user',
        error
      );
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
    throw new UserRepositoryError(
      { operation: 'save', details: error?.toString() },
      'Failed to save user',
      error
    );
  }
  
  deps.logger.info('User created successfully', { userId: newUser.id });

  // Return the created user (will be automatically wrapped in ok())
  return newUser;
});