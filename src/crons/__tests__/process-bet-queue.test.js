import Chance from "chance";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import { cloneDeep } from "lodash";
import mongoose from "mongoose";
import logger from "sc-common/logger";
import { calculateMultiplier } from "../../helpers/crash-point-helper";
import BaseMetrics from "sc-game-base/src/core/base-metrics";
import { PlaceBetPublisher } from "sc-game-base/src/core/event-publishers";
import { GameData } from "sc-game-base/src/core";
import { GameDefinition } from "sc-game-base/src/core";
import ProcessBetQueue from "../process-bet-queue";
import { Actions } from "../../constants";
import noticeHelper from "../../helpers/notice-helper";

const chance = new Chance();

jest.mock("../../helpers/crash-point-helper", () => ({
    calculateMultiplier: jest.fn(),
}));

describe("ProcessBetQueue", () => {
    jest.mock("sc-game-base/src/core/event-publishers");
    const roundId = chance.natural();
    const gameData = new GameData(10);
    gameData.exchangeRates = {
        exId: 1,
        code: {
            USD: 1,
            VND: 0.00004405,
            IDR: 0.07099,
        },
    };

    gameData.startTime = new Date();

    gameData.gameConfigs = {
        crashConfig: {},
    };

    gameData.currencies = [
        { code: "USD", name: "USD", isTest: false, isUncountOnTotal: false },
        { code: "IND", name: "IND", isTest: true, isUncountOnTotal: false },
        { code: "VND", name: "UUS", isTest: true, isUncountOnTotal: true },
    ];

    const definition = new GameDefinition({
        id: 1,
        name: "game name",
        durations: {
            wholeRound: 36,
            placingBets: 30,
            lockingBet: 5,
            shakeThePlateDuration: 1,
        },
        choicesMapper: { red2: 1 },
    });
    const placeBetPublisher = stub(PlaceBetPublisher);
    /** @type {logger}*/
    const logService = stub(logger);
    /** @type {mongoose.Model}*/
    const betsRepository = { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn() }) }) };

    /** @type {mongoose.Model}*/
    const betLogsRepository = {
        create: jest.fn(),
        findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn() }) }),
    };

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongoose(mongoose.Model);
    userInfosRepository.updateOne = jest.fn();

    const baseMetrics = stub(BaseMetrics);
    let player = null,
        proceedBetQueue = null,
        placeBet = null;

    const payload = {
        freeBet: chance.bool(),
        amount: chance.natural(),
        action: chance.pickone(Object.values(Actions)),
        roundId,
        receivedTime: new Date(),
        time: new Date(),
    };
    beforeEach(() => {
        jest.clearAllMocks();

        const playerInGameData = {
            name: "player01",
            betTracks: { red2: 100 },
            betQueue: [
                {
                    player: {},
                    payload: {},
                },
            ],
        };
        player = mockPlayer();
        placeBet = jest.fn();
        proceedBetQueue = initBetQueue(placeBet);

        gameData.ingame = {
            player01: cloneDeep(playerInGameData),
        };
    });

    describe("proceedActions", () => {
        beforeEach(() => {
            proceedBetQueue.proceedBet = jest.fn();
            proceedBetQueue.proceedCashOut = jest.fn();
        });

        describe("when action is bet", () => {
            it("should call proceedBet", async () => {
                // Arrange
                const betPayload = { ...payload, action: Actions.Bet };

                // Act
                await proceedBetQueue.proceedActions(player, betPayload);

                // Assert
                expect(proceedBetQueue.proceedBet).toBeCalledWith(player, betPayload);
            });
        });

        describe("when action is cashOut", () => {
            it("should call proceedCashOut", async () => {
                // Arrange
                const cashOutPayload = { ...payload, action: Actions.CashOut };

                // Act
                await proceedBetQueue.proceedActions(player, cashOutPayload);

                // Assert
                expect(proceedBetQueue.proceedCashOut).toBeCalledWith(player, cashOutPayload);
            });
        });

        describe("when action is halfCashOut", () => {
            it("should call halfCashOut", async () => {
                // Arrange
                const cashOutPayload = { ...payload, action: Actions.HalfCashOut };

                // Act
                await proceedBetQueue.proceedActions(player, cashOutPayload);

                // Assert
                expect(proceedBetQueue.proceedCashOut).toBeCalledWith(player, cashOutPayload);
            });
        });
    });

    describe("proceedCashOut", () => {
        it("should find current round bet", async () => {
            // Act
            await proceedBetQueue.proceedCashOut(player, payload);

            // Assert
            expect(betsRepository.findOne).toBeCalledWith({ uid: player.UID, roundId: gameData.roundId, freeBet: payload.freeBet });
        });

        describe("when NOT exist bet", () => {
            it("should publishGameFailedBet", async () => {
                // Act
                await proceedBetQueue.proceedCashOut(player, payload);

                // Assert
                expect(proceedBetQueue.placeBetPublisher.publishGameFailedBet).toBeCalledWith(player.UID, {
                    endBet: -1,
                    notice: { errorCode: noticeHelper.invalidCashOut },
                });
            });
        });

        describe("when existing bet", () => {
            const bet = { receivedTime: new Date(), amount: chance.natural() };
            const multiplier = chance.floating({ min: 2, max: 100 });

            beforeEach(() => {
                betsRepository.findOne().lean().exec.mockReturnValueOnce(bet);
                calculateMultiplier.mockReturnValueOnce(multiplier);
                proceedBetQueue.isCashOutHalfAmount = jest.fn();
                proceedBetQueue.publishCashOutFailed = jest.fn();
                proceedBetQueue.adjustRunningBets = jest.fn();
                proceedBetQueue.getMaxWinPerRound = jest.fn();
            });

            it("should call calculateMultiplier", async () => {
                // Act
                await proceedBetQueue.proceedCashOut(player, payload);

                // Assert
                expect(calculateMultiplier).toBeCalledWith(expect.any(Number));
            });

            describe("when multiplier = result", () => {
                it("should call publishCashOutFailed", async () => {
                    // Arrange
                    gameData.result = multiplier;

                    // Act
                    await proceedBetQueue.proceedCashOut(player, payload);

                    // Assert
                    expect(proceedBetQueue.publishCashOutFailed).toBeCalledWith(player);
                });
            });

            describe("when multiplier > result", () => {
                it("should publishGameFailedBet", async () => {
                    // Arrange
                    gameData.result = chance.floating({ min: 1, max: multiplier });

                    // Act
                    await proceedBetQueue.proceedCashOut(player, payload);

                    // Assert
                    expect(proceedBetQueue.publishCashOutFailed).toBeCalledWith(player);
                });
            });

            describe("when multiplier is smaller than result", () => {
                beforeEach(() => {
                    gameData.result = chance.floating({ min: multiplier });
                    proceedBetQueue.settleCashOut = jest.fn();
                });

                it("should NOT publishGameFailed", async () => {
                    // Act
                    await proceedBetQueue.proceedCashOut(player, bet);

                    // Assert
                    expect(proceedBetQueue.publishCashOutFailed).not.toBeCalled();
                });

                describe("when action is Cash Out", () => {
                    describe("when NOT exist halfCashOut bet logs", () => {
                        it("should call betLogsRepository.findOne", async () => {
                            // Act
                            await proceedBetQueue.proceedCashOut(player, { ...payload, action: Actions.CashOut });

                            // Assert
                            expect(betLogsRepository.findOne).toBeCalledWith({
                                uid: player.UID,
                                roundId: gameData.roundId,
                                freeBet: payload.freeBet,
                                action: Actions.HalfCashOut,
                            });
                        });

                        it("should call settleCashOut with bet amount", async () => {
                            // Act
                            await proceedBetQueue.proceedCashOut(player, { ...payload, action: Actions.CashOut });

                            // Assert
                            expect(proceedBetQueue.settleCashOut).toBeCalledWith(
                                player,
                                { ...payload, action: Actions.CashOut },
                                bet.amount,
                                multiplier,
                                undefined
                            );
                        });
                    });

                    describe("when NOT exist halfCashOut bet logs", () => {
                        const betLog = { winAmount: chance.natural() };

                        beforeEach(() => {
                            betLogsRepository.findOne().lean().exec.mockResolvedValueOnce(betLog);
                        });

                        it("should call settleCashOut with half of bet amount and current win amount", async () => {
                            // Arrange
                            const expectAmount = bet.amount / 2;

                            // Act
                            await proceedBetQueue.proceedCashOut(player, { ...payload, action: Actions.CashOut });

                            // Assert
                            expect(proceedBetQueue.settleCashOut).toBeCalledWith(
                                player,
                                { ...payload, action: Actions.CashOut },
                                expectAmount,
                                multiplier,
                                betLog.winAmount
                            );
                        });
                    });
                });

                // describe("when action is Half Cash Out", () => {
                //     it("should NOT call betLogs repository.findOne");
                // });
            });
        });
    });

    const initBetQueue = (placeBet) => {
        return new ProcessBetQueue({
            definition,
            gameData,
            placeBetPublisher,
            placeBet,
            logService,
            betsRepository,
            betLogsRepository,
            userInfosRepository,
            baseMetrics,
        });
    };

    const mockPlayer = () => {
        return {
            UID: 1,
            profile: { name: "player01", minBet: 1, maxBet: 5000 },
            session: {
                userId: 1,
                playerId: 1,
                siteId: "123456",
                currencyCode: "USD",
                currencyName: "USD",
                multiplier: 1000,
            },
            socketClient: {
                emit: jest.fn(),
            },
        };
    };
});
