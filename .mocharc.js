module.exports = {
	bail: true, // Exit test script on first error
	exit: true, // Force Mocha to exit after tests complete
	recursive: true, // Look for tests in subdirectories
	require: [
		'ts-node/register',
	],
	extension: ['ts'],
	spec: ['test/**/*.spec.ts'],
	timeout: 30000,
};
