import { run } from '@oclif/core';

export { run };

// Only run if this file is executed directly
if (require.main === module) {
  run()
    .then(() => {
      // CLI completed successfully
    })
    .catch((error: Error) => {
      // Handle CLI errors
      // eslint-disable-next-line no-console
      console.error('CLI Error:', error.message);
      process.exit(1);
    });
}
