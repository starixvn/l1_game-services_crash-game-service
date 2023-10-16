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

jest.mock("sc-game-base/src/core/event-publishers");
jest.mock("../../consumers/settle-game-round-consumer");
jest.mock("../../helpers/crash-point-helper", () => ({
    calculateCrashTimeInMillisecond: jest.fn().mockReturnValue(1000),
}));

const { durations } = gameSettings;
const gameData = new GameData(3);
const definition = new GameDefinition({ id: 1, name: "game name", durations }, jest.fn, jest.fn, jest.fn);
const bot = new Bot(gameData, definition);
const settleGameRoundConsumer = new SettleGameRoundConsumer({});
const runningRoundInfoPublisher = new RunningRoundInfoPublisher();
const gameStatusPublisher = new GameStatusPublisher();
const liveGameCrons = new LiveGameCrons({});

/** @type {logger}*/
const logService = {
    logError: jest.fn(),
};

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
        gameData: { ...gameData },
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
        resultsRepository: {},
    });
};
let cron;

describe("gameCrons", () => {
    beforeEach(() => {
        cron = createBaseGameCron();

        cron.checkGameStatus = jest.fn();
        cron.resetForNewRound = jest.fn();
        cron.updatePromotionOddsAndNotify = jest.fn();
        cron.isStartingTime = jest.fn();
        cron.gameData.disabled = true;
        cron.bot = {
            reset: jest.fn(),
            run: jest.fn(),
            cashOut: jest.fn(),
        };
    });

    it("should inherit Core.Crons.BaseGameCron", () => {
        // Assert
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
                // Arrange
                cron.isStartingTime = jest.fn().mockReturnValueOnce(true);

                // Act
                await cron.proceed();

                // Assert
                expect(cron.resetForNewRound).toBeCalled();
            });
        });

        describe("when start placeBet time", () => {
            it("should call publishStartPlacingBetStatus", async () => {
                // Arrange
                cron.gameData.remainingTime = durations.placingBets;

                // Act
                await cron.proceed();

                // Assert
                expect(cron.gameStatusPublisher.publishStartPlacingBetStatus).toBeCalled();
            });

            describe("when exist resultsRepository", () => {
                it("should call generateResultAndPublishHash", async () => {
                    // Arrange
                    cron.gameData.remainingTime = durations.placingBets;

                    // Act
                    await cron.proceed();

                    // Assert
                    expect(cron.roundResultConsumer.generateResultAndPublishHash).toBeCalled();
                });

                it("should reset settlementResultFromAdmin", async () => {
                    // Arrange
                    cron.gameData.remainingTime = durations.placingBets;
                    cron.gameData.settlementResultFromAdmin = {
                        result: 100,
                    };

                    // Act
                    await cron.proceed();

                    // Assert
                    expect(cron.gameData.settlementResultFromAdmin).toStrictEqual({});
                });
            });

            describe("when lock bet time", () => {
                it("should call publishEndPlacingBetStatus", async () => {
                    // Arrange
                    cron.gameData.remainingTime = durations.lockingBet - 1;

                    // Act
                    await cron.proceed();

                    // Assert
                    expect(cron.gameStatusPublisher.publishEndPlacingBetStatus).toBeCalled();
                });
            });

            describe("when remaining time is -1", () => {
                beforeEach(() => {
                    cron.gameData.remainingTime = -1;
                    cron.startDelaySettleRound = jest.fn();
                });

                it("should call startDelaySettleRound", async () => {
                    // Act
                    await cron.proceed();

                    // Assert
                    expect(cron.startDelaySettleRound).toBeCalled();
                });

                describe("when round result > 1", () => {
                    it("should start liveGameCrons", async () => {
                        // Arrange
                        cron.liveGameCrons = { start: jest.fn() };
                        cron.gameData.result = 1.1;

                        // Act
                        await cron.proceed();

                        // Assert
                        expect(cron.liveGameCrons.start).toBeCalled();
                    });
                });
            });
        });
    });

    describe("startDelaySettleRound", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should sets a timeout to settle the round after the specified delay", () => {
            // Act
            cron.startDelaySettleRound(gameData, definition);

            // Assert
            expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000);
        });

        it("should calls the settleGameRoundConsumer.settleRound() method after the specified delay", () => {
            // Act
            cron.startDelaySettleRound(gameData, definition);
            cron;
            // Assert
            jest.runAllTimers();
            expect(cron.settleGameRoundConsumer.settleRound).toBeCalled();
        });

        it("should logs an error if settling the round fails", () => {
            // Arrange
            cron.settleGameRoundConsumer.settleRound.mockImplementation(() => {
                throw new Error("Settle round failed");
            });

            // Act
            cron.startDelaySettleRound(gameData, definition);

            // Assert
            jest.runAllTimers();
            expect(logService.logError).toHaveBeenCalledWith(new Error("Settle round failed"));
        });

        it("should set start time to current time", () => {
            // Arrange
            const mockDate = new Date();
            jest.spyOn(global, "Date").mockImplementation(() => mockDate);
            cron.gameData.startTime = undefined;

            // Act
            cron.startDelaySettleRound(gameData, definition);

            // Assert
            expect(cron.gameData.startTime).toBe(mockDate);
        });
    });
});
