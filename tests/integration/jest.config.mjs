import base from "../../jest.config.cjs";

const config = {
  ...base,
  rootDir: "../..",
  testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
};

export default config;
