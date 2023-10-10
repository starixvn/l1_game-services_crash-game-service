module.exports = async () => {
    return {
        rootDir: "./",
        verbose: true,
        transform: {
            "^.+\\.js?$": "babel-jest",
        },
        transformIgnorePatterns: [
            "node_modules/(?!(sc-base-database|sc-common|sc-game-base|sc-base-apis|sc-api-client|sc-game-service-integration-utils|axios|jest-auto-fixture|random-int)/)",
        ],
        testEnvironment: "node",
        testResultsProcessor: "jest-sonar-reporter",
    };
};
