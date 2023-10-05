import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import { TableGameData, TableGameDefinition } from "sc-game-base/src/table";
import gameSettings from "../../game-settings";
import Bot from "../bot";

jest.mock("sc-game-base/src/core/event-publishers/base-event-publisher");

const tempBetsRepository = stubMongoose(mongoose.Model);
const tempBetLogsRepository = stubMongoose(mongoose.Model);
const userInfosRepository = stubMongoose(mongoose.Model);
const publisher = new BaseEventPublisher();
const definition = new TableGameDefinition(gameSettings);
const gameData = new TableGameData();

function initBot() {
    return new Bot(definition, gameData, publisher, userInfosRepository, tempBetsRepository, tempBetLogsRepository);
}

afterEach(() => {
    jest.clearAllMocks();
});

describe("getRemovalBotIds", () => {
    const bot = initBot();
    describe("when there are not bots in the room", () => {
        it("should return an empty array", () => {
            const botIds = bot.getRemovalBotIds(3);
            expect(botIds).toBeEmpty();
        });
    });

    describe("when all bots have bet", () => {
        it("should return an empty array", () => {
            bot.botsInRoom = {
                1: { totalBet: 10 },
                2: { totalBet: 20 },
                3: { totalBet: 30 },
            };
            const botIds = bot.getRemovalBotIds(2);
            expect(botIds).toBeEmpty();
        });
    });

    describe("when totalRemoval < bots in room", () => {
        it("should return an array with length = totalRemoval", () => {
            bot.botsInRoom = {
                1: { totalBet: 0 },
                2: { totalBet: 0 },
                3: { totalBet: 0 },
            };
            const botIds = bot.getRemovalBotIds(2);
            expect(botIds).toHaveLength(2);
        });
    });
    describe("when totalRemoval >= bots in room", () => {
        it("should return all bot ids", () => {
            bot.botsInRoom = {
                1: { totalBet: 0 },
                2: { totalBet: 0 },
                3: { totalBet: 0 },
            };
            const botIds = bot.getRemovalBotIds(4);
            expect(botIds).toHaveLength(3);
        });
    });
});

describe("getBotsToCashOut", () => {
    describe("when there are no bots in the room", () => {
        it("should return an empty array", () => {
            //Arrange
            const bot = initBot();
            bot.gameData.startTime = new Date(new Date() - 4000);

            //Act
            const botsToCashOut = bot.getBotsToCashOut();

            //Assert
            expect(botsToCashOut).toBeEmpty();
        });
    });
    describe("when all bots have cashed out", () => {
        it("should return an empty array", () => {
            //Arrange
            const bot = initBot();
            bot.gameData.startTime = new Date(new Date() - 4000);
            bot.botsInRoom = {
                1: {
                    totalBet: 100,
                    cashOut: true,
                },
                2: {
                    totalBet: 200,
                    cashOut: true,
                },
                3: {
                    totalBet: 300,
                    cashOut: true,
                },
            };

            //Act
            const botsToCashOut = bot.getBotsToCashOut();

            //Assert
            expect(botsToCashOut).toBeEmpty();
        });
    });

    /* it("should return all bots if the multiplier is greater than the cash out boundary", () => {
        const botsInRoom = {
            bot1: {
                totalBet: 100,
                cashOut: false,
            },
            bot2: {
                totalBet: 200,
                cashOut: false,
            },
            bot3: {
                totalBet: 300,
                cashOut: false,
            },
        };
        const cashOutBoundary = 1.5;

        jest.mock("./calculateMultiplier", () => () => 2.0);

        const botsToCashOut = getBotsToCashOut({ botsInRoom, cashOutBoundary, chance });

        expect(botsToCashOut).toEqual(["bot1", "bot2", "bot3"]);
    });

    it("should return a random subset of bots if the multiplier is less than the cash out boundary", () => {
        const botsInRoom = {
            bot1: {
                totalBet: 100,
                cashOut: false,
            },
            bot2: {
                totalBet: 200,
                cashOut: false,
            },
            bot3: {
                totalBet: 300,
                cashOut: false,
            },
        };
        const cashOutBoundary = 1.5;

        jest.mock("./calculateMultiplier", () => () => 1.0);

        const botsToCashOut = getBotsToCashOut({ botsInRoom, cashOutBoundary, chance });

        expect(botsToCashOut.length).toBeLessThanOrEqual(botsInRoom.length);
        expect(botsToCashOut.every((bot) => botsInRoom.hasOwnProperty(bot))).toBeTruthy();
    }); */
});
