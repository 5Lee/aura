const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.cjs"],
  testMatch: ["<rootDir>/__tests__/**/*.test.{js,jsx,ts,tsx}"],
}

module.exports = config
