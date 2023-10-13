import mongoose from "mongoose";
import { stubMongoose, stub } from "jest-micro-auto-stub";
import GameCrons from "../game-crons";
import Bot from "../bot";
import { SettleGameRoundConsumer } from "../../consumers/settle-game-round-consumer";
import { GameStatusPublisher, RunningRoundInfoPublisher } from "sc-game-base/src/core/event-publishers";
import LiveGameCrons from "../live-game-cron";
import { Core } from "sc-game-base";
import { GameData, GameDefinition } from "sc-game-base/src/core";
import { logger } from "sc-common";
import gameSettings from "../../game-settings";

const { durations } = gameSettings;
const gameData = new GameData(3);
const definition = new GameDefinition(
    { id: 1, name: "game name", durations: { lockingBet: 2, wholeRound: 30, placingBets: 25 } },
    jest.fn,
    jest.fn,
    jest.fn
);
const bot = new Bot(gameData, definition);
const settleGameRoundConsumer = new SettleGameRoundConsumer({});
const runningRoundInfoPublisher = new RunningRoundInfoPublisher();
const gameStatusPublisher = new GameStatusPublisher();
const liveGameCrons = new LiveGameCrons({});

/** @type {logger}*/
const logService = stub(logger);

/** @type {mongoose.Model}*/
const gameConfigsRepository = stubMongoose(mongoose.Model);
gameConfigsRepository.updateOne = jest.fn();

/** @type {mongoose.Model}*/
const roundsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const notificationRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const archiveRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const exchangeRatesRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const currencyGroupGamesRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const partnerConfigRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const currencyGroupRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const currencyRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const betsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const betLogsRepository = stubMongoose(mongoose.Model);

const roundResultConsumer = { generateResultAndPublishHash: jest.fn() };

const createBaseGameCron = function () {
    return new GameCrons({
        definition,
        gameData,
        bot,
        settleGameRoundConsumer,
        gameStatusPublisher,
        runningRoundInfoPublisher,
        logService,
        gameConfigsRepository,
        roundsRepository,
        archiveRepository,
        notificationRepository,
        exchangeRatesRepository,
        currencyGroupGamesRepository,
        partnerConfigRepository,
        currencyGroupRepository,
        currencyRepository,
        roundResultConsumer,
        liveGameCrons,
        betsRepository,
        betLogsRepository,
    });
};

let cron;

describe("gameCrons", () => {
    beforeEach(() => {
        cron = createBaseGameCron();
    });

    it("should inherit Core.Crons.BaseGameCron", () => {
        expect(cron instanceof Core.Crons.BaseGameCron);
    });

    describe("start", () => {
        beforeEach(() => {
            cron.initRoundId = jest.fn();
            cron.queryLastResult = jest.fn();
            cron.updateExchangeRates = jest.fn();
            cron.proceedUnsettledBets = jest.fn();
            cron.initResultHash = jest.fn();
            cron.getSettingForNewRound = jest.fn();
            cron.startCron = jest.fn();
        });

        it("should call initRoundId", async () => {
            // Act
            await cron.start();

            // Assert
            expect(cron.initRoundId).toBeCalled();
        });

        it("should call queryLastResult", async () => {
            // Act
            await cron.start();

            // Assert
            expect(cron.queryLastResult).toBeCalled();
        });

        it("should call updateExchangeRates", async () => {
            // Act
            await cron.start();

            // Assert
            expect(cron.updateExchangeRates).toBeCalled();
        });

        it("should call proceedUnsettledBets", async () => {
            // Act
            await cron.start();

            // Assert
            expect(cron.proceedUnsettledBets).toBeCalled();
        });

        it("should call initResultHash", async () => {
            // Act
            await cron.start();

            // Assert
            expect(cron.initResultHash).toBeCalled();
        });

        it("should call getSettingForNewRound", async () => {
            // Act
            await cron.start();

            // Assert
            expect(cron.getSettingForNewRound).toBeCalled();
        });

        it("should call startCron", async () => {
            // Act
            await cron.start();

            // Assert
            expect(cron.startCron).toBeCalled();
        });
    });

    describe("proceed", () => {
        beforeEach(() => {
            cron.checkGameStatus = jest.fn();
            cron.resetForNewRound = jest.fn();
            cron.updatePromotionOddsAndNotify = jest.fn();
            cron.isStartingTime = jest.fn();
            cron.bot = {
                reset: jest.fn(),
                run: jest.fn(),
                cashOut: jest.fn(),
            };
        });

        describe("when remainingTime = wholeRound", () => {
            it("should call checkGameStatus", async () => {
                // Arrange
                cron.definition.durations = durations;
                cron.gameData.remainingTime = durations.wholeRound;

                // Act
                await cron.proceed();

                // Assert
                expect(cron.checkGameStatus).toHaveBeenCalled();
            });
        });

        describe("when game is enabled", () => {
            it("should reduce remaining time by 1", async () => {
                cron.gameData.disabled = false;
                cron.gameData.remainingTime = 123;

                // Act
                await cron.proceed();

                // Assert
                expect(cron.gameData.remainingTime).toBe(122);
            });
        });

        describe("when starting time", () => {
            it("should call resetForNewRound", async () => {
                // Act
                await cron.proceed();

                // Assert
                expect(cron.resetForNewRound).toBeCalled();
            });
        });
    });
});
