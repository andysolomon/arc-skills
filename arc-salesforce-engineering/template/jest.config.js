const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
  ...jestConfig,
  // The Jest resolver doesn't find CSS-only modules, so point it at the token module.
  moduleNameMapper: {
    ...jestConfig.moduleNameMapper,
    '^c/arcTokens$': '<rootDir>/force-app/main/default/lwc/arcTokens/arcTokens.css'
  },
  modulePathIgnorePatterns: ['<rootDir>/.localdevserver']
};
