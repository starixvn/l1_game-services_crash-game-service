import mongoose from "mongoose";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import GameData from "../../game-data";
import PlaceBetPublisher from "../../event-publishers/place-bet-publisher";
import { SettleCashOutConsumer } from "../settle-cash-out-consumer";
import { Actions, MinMultiplierValue } from "../../constants";
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
                jest.spyOn(global, "Date").mockImplementation(() => mockReceivedTime);
                gameData.betList = {
                    [UID]: {
                        [Actions.HalfCashOut]: {
                            win: 1.1,
                        },
                    },
                };

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
                expect(consumer.settleCashOut).toBeCalledWith(realPlayer, expectedPayload, amount, autoCashOut);
            });
        });
    });

    describe("settleCashOut", () => {
        let payload;
        let amount;
        let multiplier;
        let maxWinPerRound;
        let winningDetails;
        let currencyRate;

        beforeEach(() => {
            payload = {
                roundId: chance.natural(),
                action: Actions.CashOut,
            };
            amount = 13; // Use a fixed amount for predictable results
            multiplier = 1000; // Use max multiplier for predictable results
            maxWinPerRound = 200000;
            currencyRate = chance.floating({ min: 0.1, max: 1000 });

            // Calculate the actual winning details
            const cashOutWin = roundFloat(amount * multiplier);
            const winAmount = Math.min(cashOutWin, maxWinPerRound);
            winningDetails = {
                winAmount,
                multiplier,
                cashOutWin,
                reachMaxWin: winAmount === maxWinPerRound,
            };

            consumer.getMaxWinPerRound = jest.fn().mockReturnValue(maxWinPerRound);
            consumer.calculateCurrencyRate = jest.fn().mockReturnValue(currencyRate);
            consumer.recordBetLog = jest.fn();
            consumer.publishResults = jest.fn();
            consumer.updateGameData = jest.fn();
        });

        it("should call getMaxWinPerRound through calculateWinnings", async () => {
            // Act
            await consumer.settleCashOut(realPlayer, payload, amount, multiplier);

            // Assert
            expect(consumer.getMaxWinPerRound).toBeCalledWith(realPlayer);
        });

        it("should call recordBetLog", async () => {
            // Act
            await consumer.settleCashOut(realPlayer, payload, amount, multiplier);

            // Assert
            expect(consumer.recordBetLog).toBeCalledWith(realPlayer, payload, winningDetails);
        });

        it("should call publishResults", async () => {
            // Act
            await consumer.settleCashOut(realPlayer, payload, amount, multiplier);

            // Assert
            expect(consumer.publishResults).toBeCalledWith(realPlayer, payload, winningDetails);
        });

        it("should call updateGameData", async () => {
            // Act
            await consumer.settleCashOut(realPlayer, payload, amount, multiplier);

            // Assert
            expect(consumer.updateGameData).toBeCalledWith(realPlayer, payload.action, winningDetails);
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

    describe("insertBetLog", () => {
        const roundId = chance.natural();
        const payload = { roundId, action: chance.pickone(Object.values(Actions)) };

        beforeEach(() => {
            consumer.calculateCurrencyRate = jest.fn();
        });

        it("should call calculateCurrencyRate", async () => {
            // Act
            await consumer.insertBetLog(realPlayer, roundId, payload);

            // Assert
            expect(consumer.calculateCurrencyRate).toBeCalledWith(realPlayer.session);
        });

        it("should call betLogsRepository.create", async () => {
            // Arrange
            const rate = chance.floating({ min: 1 });
            const mockDate = new Date();
            jest.spyOn(global, "Date").mockReturnValueOnce(mockDate);
            consumer.calculateCurrencyRate.mockReturnValueOnce(rate);

            // Act
            await consumer.insertBetLog(realPlayer, roundId, payload);

            // Assert
            expect(betLogsRepository.create).toBeCalledWith({
                uid: realPlayer.UID,
                name: realPlayer.profile.name,
                time: mockDate,
                action: payload.action,
                amount: payload.amount,
                winAmount: payload.winAmount,
                freeBet: payload.freeBet,
                clientSendTime: payload.clientSendTime,
                receivedTime: payload.receivedTime,
                roundId,
                multiplier: payload.multiplier,
                reachMaxWin: payload.reachMaxWin,
                siteId: realPlayer.session.siteId,
                currency: realPlayer.session.currencyName,
                rate,
                operatorId: realPlayer.session.operatorId,
                playerId: realPlayer.session.playerId,
            });
        });
    });

    describe("validateAutoCashOut", () => {
        beforeEach(() => {
            gameData.result = 100;
        });

        it("should return false when betTracks is null", () => {
            // Act
            const result = consumer.validateAutoCashOut(null, 1.5);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return false when multiplier is null", () => {
            // Act
            const result = consumer.validateAutoCashOut({ [Actions.Bet]: { autoCashOut: 1.5 } }, null);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return false when bet has no autoCashOut value", () => {
            // Arrange
            const betTracks = {
                [Actions.Bet]: { amount: 100 },
            };

            // Act
            const result = consumer.validateAutoCashOut(betTracks, 1.5);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return false when autoCashOut is greater than current multiplier", () => {
            // Arrange
            const betTracks = {
                [Actions.Bet]: { autoCashOut: 2.0 },
            };

            // Act
            const result = consumer.validateAutoCashOut(betTracks, 1.5);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return false when player has already cashed out", () => {
            // Arrange
            const betTracks = {
                [Actions.Bet]: { autoCashOut: 1.5 },
                [Actions.CashOut]: { time: new Date() },
            };

            // Act
            const result = consumer.validateAutoCashOut(betTracks, 2.0);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return true for valid auto cash out", () => {
            // Arrange
            const betTracks = {
                [Actions.Bet]: { autoCashOut: 1.5 },
            };

            // Act
            const result = consumer.validateAutoCashOut(betTracks, 2.0);

            // Assert
            expect(result).toBeTruthy();
        });
    });

    describe("calculateWinnings", () => {
        const amount = 100;
        const maxWinPerRound = 1000;

        beforeEach(() => {
            consumer.getMaxWinPerRound = jest.fn().mockReturnValue(maxWinPerRound);
        });

        it("should cap multiplier at 1000", () => {
            // Arrange
            const multiplier = 1500;

            // Act
            const result = consumer.calculateWinnings(amount, multiplier, realPlayer);

            // Assert
            expect(result.multiplier).toBe(1000);
        });

        it("should calculate correct win amount", () => {
            // Arrange
            const multiplier = 2.5;
            const expectedWin = roundFloat(amount * multiplier);

            // Act
            const result = consumer.calculateWinnings(amount, multiplier, realPlayer);

            // Assert
            expect(result.winAmount).toBe(expectedWin);
        });

        it("should cap win amount at maxWinPerRound", () => {
            // Arrange
            const multiplier = 20; // Would result in win > maxWinPerRound

            // Act
            const result = consumer.calculateWinnings(amount, multiplier, realPlayer);

            // Assert
            expect(result.winAmount).toBe(maxWinPerRound);
            expect(result.reachMaxWin).toBeTruthy();
        });

        it("should handle small numbers correctly", () => {
            // Arrange
            const smallAmount = 0.0001;
            const multiplier = 1.5;
            const expectedWin = roundFloat(smallAmount * multiplier);

            // Act
            const result = consumer.calculateWinnings(smallAmount, multiplier, realPlayer);

            // Assert
            expect(result.winAmount).toBe(expectedWin);
        });
    });

    describe("error handling", () => {
        it("should log error when settleCashOut fails", async () => {
            // Arrange
            consumer.calculateWinnings = jest.fn().mockImplementation(() => {
                throw new Error("Test error");
            });

            try {
                // Act
                await consumer.settleCashOut(realPlayer, {}, 100, 1.5);
            } catch (error) {
                // Ignore the error as we expect it to be thrown
            }

            // Assert
            expect(logService.logError).toHaveBeenCalled();
        });

        it("should propagate error from settleCashOut", async () => {
            // Arrange
            consumer.calculateWinnings = jest.fn().mockImplementation(() => {
                throw new Error("Test error");
            });

            // Act & Assert
            await expect(async () => {
                await consumer.settleCashOut(realPlayer, {}, 100, 1.5);
            }).rejects.toThrow("Test error");
        });
    });
});
