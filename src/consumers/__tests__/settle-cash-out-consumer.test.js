import mongoose from "mongoose";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import { GameData } from "sc-game-base/src/core";
import PlaceBetPublisher from "../../event-publishers/place-bet-publisher";
import { SettleCashOutConsumer } from "../settle-cash-out-consumer";
import { Actions, MinMultiplierValue } from "../../constants";
import { addMillisecond } from "../../helpers/date-helper";
import Chance from "chance";
import { roundFloat } from "../../helpers/number-helper";

const chance = new Chance();

jest.mock("../../helpers/date-helper", () => ({
    addMillisecond: jest.fn(),
}));

describe("SettleCashOutConsumer", () => {
    const gameData = new GameData();
    gameData.updatePlayerAction = jest.fn();
    gameData.gameConfigs.crashConfig = {};
    gameData.result = 100;

    const placeBetPublisher = stub(PlaceBetPublisher);
    const logService = {
        logError: jest.fn(),
    };
    const betLogsRepository = stubMongoose(mongoose.Model);

    let consumer;

    beforeEach(() => {
        consumer = new SettleCashOutConsumer(gameData, placeBetPublisher, logService, betLogsRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const UID = "uid";
    const playerName = "name01";
    const realPlayer = {
        UID,
        socketClient: {
            connected: true,
        },
        profile: {
            name: playerName,
        },
        session: {
            userId: 1,
            playerId: 1,
            siteId: "123456",
            currencyCode: "USD",
            currencyName: "USD",
            multiplier: 1000,
            currencyGroupId: chance.guid(),
        },
    };

    describe("proceedAutoCashOut", () => {
        beforeEach(() => {
            consumer.settleCashOut = jest.fn();
        });

        describe("when exist valid autoCashOut value on bet", () => {
            it("should call settleCashOut", async () => {
                // Arrange
                const mockReceivedTime = new Date();
                const autoCashOut = MinMultiplierValue;
                const amount = 100;
                const multiplier = autoCashOut + 0.1;
                const betQueuePushMock = jest.fn();
                addMillisecond.mockReturnValueOnce(mockReceivedTime);

                const expectedPayload = {
                    roundId: gameData.roundId,
                    receivedTime: mockReceivedTime,
                    action: Actions.CashOut,
                };

                gameData.ingame = {
                    [playerName]: {
                        UID,
                        betTracks: {
                            [Actions.Bet]: {
                                autoCashOut,
                                amount,
                            },
                            [Actions.HalfCashOut]: {
                                amount: amount / 2,
                                win: 1.1,
                            },
                        },
                        betQueue: {
                            push: betQueuePushMock,
                        },
                        playerData: realPlayer,
                    },
                };

                // Act
                await consumer.proceedAutoCashOut(multiplier);

                // Assert
                expect(consumer.settleCashOut).toBeCalledWith(realPlayer, expectedPayload, amount / 2, autoCashOut, 1.1);
            });
        });
    });

    describe("settleCashOut", () => {
        const payload = { roundId: chance.natural(), action: chance.pickone(Object.values(Actions)) };
        const amount = chance.natural({ min: 1, max: 100 });
        const multiplier = chance.floating({ min: 1, max: 2000 });
        const maxWinPerRound = 200000;
        const halfCashOutWinAmount = chance.floating({ min: 1.01, max: 10000 });
        const winAmount = roundFloat(multiplier * amount);
        const reachMaxWin = winAmount === maxWinPerRound;
        const currencyRate = chance.floating({ min: 0.1, max: 1000 });

        beforeEach(() => {
            consumer.getMaxWinPerRound = jest.fn().mockReturnValueOnce(maxWinPerRound);
            consumer.insertBetLog = jest.fn();
            consumer.adjustRunningBets = jest.fn();
            consumer.calculateCurrencyRate = jest.fn().mockReturnValueOnce(currencyRate);
        });

        it("should call getMaxWinPerRound", async () => {
            // Act
            await consumer.settleCashOut(realPlayer, payload, amount, multiplier, halfCashOutWinAmount);

            // Assert
            expect(consumer.getMaxWinPerRound).toBeCalledWith(realPlayer);
        });

        it("should call insertBetLog", async () => {
            // Arrange
            const expectBetLog = { ...payload, winAmount, multiplier, amount, reachMaxWin };

            // Act
            await consumer.settleCashOut(realPlayer, payload, amount, multiplier, halfCashOutWinAmount);

            // Assert
            expect(consumer.insertBetLog).toBeCalledWith(realPlayer, payload.roundId, expectBetLog);
        });

        it("should call placeBetPublisher.publishSuccessCashOut", async () => {
            // Act
            await consumer.settleCashOut(realPlayer, payload, amount, multiplier, halfCashOutWinAmount);

            // Assert
            expect(placeBetPublisher.publishSuccessCashOut).toBeCalledWith(
                realPlayer.UID,
                {
                    name: realPlayer.profile.name,
                    playerId: realPlayer.UID,
                    [payload.action]: { amount, win: winAmount, multiplier, reachMaxWin: false, cashOutWin: winAmount },
                },
                currencyRate
            );
        });

        it("should call gameData.updatePlayerAction", async () => {
            // Act
            await consumer.settleCashOut(realPlayer, payload, amount, multiplier, halfCashOutWinAmount);

            // Assert
            expect(gameData.updatePlayerAction).toBeCalledWith(realPlayer.UID, payload.action, { amount, win: winAmount, multiplier });
        });
    });

    describe("getMaxWinPerRound", () => {
        it("should return max win per round", () => {
            // Arrange
            const maxWinPerRound = chance.natural({ min: 1, max: 2000 });
            const currencyMaxBet = chance.natural({ min: 1, max: 2000 });
            consumer.gameData.currencyGroupGames = [{ groupId: realPlayer.session.currencyGroupId, maxBet: currencyMaxBet }];
            consumer.gameData.gameConfigs.crashConfig.maxWinPerRound = maxWinPerRound;
            const maxBet = Math.min(realPlayer.profile.maxBet, currencyMaxBet);

            // Act
            const actualResult = consumer.getMaxWinPerRound(realPlayer);

            // Assert
            expect(actualResult).toBe(maxBet * maxWinPerRound);
        });
    });
});
