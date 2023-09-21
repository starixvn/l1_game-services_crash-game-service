import { stubMongooseModelStupidly, stub } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { RoundResultPublisher } from "sc-game-base/src/core/event-publishers";
import { UserBetResultPublisher } from "sc-game-base/src/core/event-publishers";
import GameData from "sc-game-base/src/core/game-data";
import GameDefinition from "sc-game-base/src/core/game-definition";
import { SettleGameRoundConsumer } from "../settle-game-round-consumer";
import Chance from "chance";

describe("SettleGameRoundConsumer", () => {
    const chance = new Chance();
    const defaultDefinition = new GameDefinition({ id: 1, name: "game name" }, jest.fn(), jest.fn());

    const defaultGameData = new GameData(30);

    let gameData, definition, consumer;

    /** @type {UserRoundResultPublisher}*/
    const roundResultPublisher = stub(RoundResultPublisher);

    /** @type {UserBetResultPublisher}*/
    const userBetResultPublisher = stub(UserBetResultPublisher);

    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const betsRepository = stubMongooseModelStupidly(mongoose.Model);

    const endGame = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        gameData = { ...defaultGameData };
        definition = { ...defaultDefinition };

        consumer = new SettleGameRoundConsumer({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
        });
    });

    describe("calculateMultiplier", () => {
        it("should return result is greater than 1", () => {});
    });
});
