import Chance from "chance";
import RoundResultConsumer from "../round-result-consumer";

describe("roundResultConsumer", () => {
    const chance = new Chance();
    const roundId = chance.natural();
    const maxMultiplier = chance.floating({ min: 10 });
    const crashAtBase = chance.natural({ min: 0, max: 100 });
    const gameData = {
        roundId,
        gameConfigs: {
            randomMode: chance.natural(),
            crashConfig: { maxMultiplier, crashAtBase },
        },
        settlementResultFromAdmin: {},
    };

    describe("generateResult", () => {
        describe("when admin set result", () => {
            describe("when result from admin > max multiplier config", () => {
                const settlementResultFromAdmin = {
                    roundId,
                    result: chance.floating({ min: maxMultiplier }),
                };
                const consumer = new RoundResultConsumer({ ...gameData, settlementResultFromAdmin });

                it("should return max multiplier config", () => {
                    // Act
                    const actualResult = consumer.generateResult();

                    // Assert
                    expect(actualResult).toBe(maxMultiplier);
                });
            });

            describe("when result from admin is < max multiplier config", () => {
                const expectResult = chance.floating({ max: maxMultiplier });
                const settlementResultFromAdmin = {
                    roundId,
                    result: expectResult,
                };

                const consumer = new RoundResultConsumer({ ...gameData, settlementResultFromAdmin });

                it("should return result from admin", () => {
                    // Act
                    const actualResult = consumer.generateResult();

                    // Assert
                    expect(actualResult).toBe(expectResult);
                });
            });
        });

        describe("when admin NOT set result", () => {
            const definition = {
                generateResult: jest.fn(),
            };

            it("should call definition.generateResult", () => {
                // Arrange
                definition.generateResult.mockReturnValueOnce(chance.floating());
                const consumer = new RoundResultConsumer({ ...gameData }, definition);

                // Act
                consumer.generateResult();

                // Assert
                expect(definition.generateResult).toBeCalledWith(gameData.gameConfigs.randomMode, crashAtBase);
            });

            describe("when result generated > max multiplier config", () => {
                it("should return max multiplier config", () => {
                    // Arrange
                    definition.generateResult.mockReturnValueOnce(chance.floating({ min: maxMultiplier }));
                    const consumer = new RoundResultConsumer({ ...gameData }, definition);

                    // Act
                    const actualResult = consumer.generateResult();

                    // Assert
                    expect(actualResult).toBe(maxMultiplier);
                });
            });

            describe("when result generated < max multiplier config", () => {
                it("should return result from admin", () => {
                    // Arrange
                    const expectResult = chance.floating({ max: maxMultiplier });
                    definition.generateResult.mockReturnValueOnce(expectResult);
                    const consumer = new RoundResultConsumer({ ...gameData }, definition);

                    // Act
                    const actualResult = consumer.generateResult();

                    // Assert
                    expect(actualResult).toBe(expectResult);
                });
            });
        });
    });
});
