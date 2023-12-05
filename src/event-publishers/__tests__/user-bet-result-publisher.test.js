import { logger } from "sc-common";
import GameData from "../../game-data";
import UserBetResultPublisher from "../user-bet-result-publisher";

jest.mock("sc-game-base/src/core/helpers", () => ({
    init: jest.fn(),
    post: jest.fn(),
}));

jest.mock("sc-common", () => ({
    logger: {
        logError: jest.fn(),
    },
}));

const gameData = new GameData();
const gameName = "game";

const initPublisher = function () {
    return new UserBetResultPublisher(gameName, gameData, logger);
};

describe("userBetResultPublisher", () => {
    describe("publish", () => {
        it("should publish to user", async () => {
            // arrange
            const publisher = initPublisher();
            publisher.publishToUser = jest.fn();
            // act
            await publisher.publish(1, { totalWin: 200 });
            // assert
            expect(publisher.publishToUser).toHaveBeenCalled();
        });
    });
});
