import { Chance } from "chance";
import RoundResultPublisher from "../round-result-publisher";
import GameData from "../../game-data";

const chance = new Chance();

describe("roundResultPublisher", () => {
    let publisher, gameData;

    beforeEach(() => {
        gameData = new GameData();
        publisher = new RoundResultPublisher("", gameData);

        publisher.publishToAllUsers = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("publishRoundResult", () => {
        const roundResult = {
            result: chance.floating({ min: 1, max: 2000 }),
        };

        const resultHash = {
            rawValue: chance.guid(),
        };

        describe("when rawValue is available in gameData", () => {
            beforeEach(() => {
                gameData.resultHash = { ...resultHash };
                gameData.result = roundResult.result;
            });

            it("should call publishToAllUsers with resultHash", () => {
                // Act
                publisher.publishRoundResult(roundResult);

                // Assert
                expect(publisher.publishToAllUsers).toBeCalledWith({
                    finish: roundResult,
                    resultHash: { rawValue: resultHash.rawValue, extraInfos: roundResult.result },
                });
            });
        });

        describe("when rawValue is NOT exist in gameData", () => {
            it("should call publishToAllUsers without resultHash", () => {
                // Act
                publisher.publishRoundResult(roundResult);

                // Assert
                expect(publisher.publishToAllUsers).toBeCalledWith({
                    finish: roundResult,
                });
            });
        });
    });
});
