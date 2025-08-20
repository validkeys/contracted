import { createUserService } from './packages/UserManager/service.ts';
import { matchError } from '../core/errors.ts';
import { 
  UserAlreadyExistsError,
  UserRepositoryError,
  InvalidUserDataError
} from './packages/UserManager/internal/errors.ts';

// Initialize the service
const userService = createUserService({

  // Provide Dependencies
  userRepository: {
    save: async (user: any) => {
      // Simulate database save
      console.log('Saving user:', user);
    },
    findByEmail: async (email: string) => {
      // Simulate database lookup
      if (email === 'existing@example.com') {
        return { id: '123', email, name: 'Existing User' };
      }
      return null;
    },
  },
  idGenerator: {
    generate: () => `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  },
  logger: {
    info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
    error: (message: string, error: Error) => console.error(`[ERROR] ${message}`, error),
  },
});

// Example 1: Basic usage with success case
async function example1() {
  const result = await userService.createUser.run({
    email: 'john@example.com',
    name: 'John Doe',
    age: 30,
  });

  if (result.isOk()) {
    console.log('User created successfully:', result.value);
  } else {
    console.error('Failed to create user:', result.error);
  }
}

// // Example 2: Exhaustive error handling with matchError
// async function example2() {
//   const result = await userService.createUser.run({
//     email: 'existing@example.com',
//     name: 'Jane Doe',
//     age: 25,
//   });

//   if (result.isErr()) {
//     const response = matchError(result.error, {
//       USER_ALREADY_EXISTS: (error) => ({
//         status: 409,
//         message: `User with email ${error.data.email} already exists`,
//         code: 'DUPLICATE_USER',
//       }),
//       USER_REPOSITORY_ERROR: (error) => ({
//         status: 500,
//         message: 'Database error occurred',
//         code: 'DB_ERROR',
//         details: error.data.details,
//       }),
//       INVALID_USER_DATA: (error) => ({
//         status: 400,
//         message: `Invalid ${error.data.field}: ${error.data.reason}`,
//         code: 'VALIDATION_ERROR',
//       }),
//     });

//     console.log('Error response:', response);
//   }
// }

// // Example 3: Using switch statement for error handling
// async function example3() {
//   const result = await userService.createUser.run({
//     email: 'test@example.com',
//     name: 'Test@User', // Invalid name with @ symbol
//     age: 30,
//   });

//   if (result.isErr()) {
//     switch (result.error._tag) {
//       case 'USER_ALREADY_EXISTS':
//         console.log('User already exists');
//         break;
//       case 'USER_REPOSITORY_ERROR':
//         console.log('Database error:', result.error.data);
//         break;
//       case 'INVALID_USER_DATA':
//         console.log(`Validation error in ${result.error.data.field}: ${result.error.data.reason}`);
//         break;
//       default:
//         // TypeScript ensures exhaustiveness
//         const _exhaustive: never = result.error;
//         throw new Error(`Unhandled error case: ${_exhaustive}`);
//     }
//   }
// }


// export async function createUserHandler(req: Request, res: Response) {
//   // Validate input with contract schema
//   try {
//     const input = userService.createUser.validateInput(req.body);
    
//     const result = await userService.createUser.run(input, {
//       sendWelcomeEmail: true,
//     });
    
//     if (result.isErr()) {
//       const errorResponse = matchError(result.error, {
//         USER_ALREADY_EXISTS: () => res.status(409).json({
//           error: 'User already exists',
//           code: 'DUPLICATE_USER',
//         }),
//         USER_REPOSITORY_ERROR: () => res.status(500).json({
//           error: 'Internal server error',
//           code: 'DB_ERROR',
//         }),
//         INVALID_USER_DATA: (error) => res.status(400).json({
//           error: 'Invalid input',
//           field: error.data.field,
//           reason: error.data.reason,
//         }),
//       });
      
//       return errorResponse;
//     }
    
//     return res.status(201).json({
//       status: 'success',
//       data: result.value,
//     });
//   } catch (validationError) {
//     return res.status(400).json({
//       error: 'Invalid request body',
//       details: validationError,
//     });
//   }
// }

// Run examples
if (require.main === module) {
  (async () => {
    console.log('=== Example 1: Success Case ===');
    await example1();
    
    // console.log('\n=== Example 2: Error with matchError ===');
    // await example2();
    
    // console.log('\n=== Example 3: Error with switch ===');
    // await example3();
  })();
}