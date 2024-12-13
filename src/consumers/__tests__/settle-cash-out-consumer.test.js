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

    describe("insertBetLog", () => {
        const roundId = chance.natural();
        const payload = { roundId, action: Actions.CashOut, tapCount: 1 };

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
                clientSendTime: payload.clientSendTime,
                receivedTime: payload.receivedTime,
                roundId,
                multiplier: payload.multiplier,
                siteId: realPlayer.session.siteId,
                currency: realPlayer.session.currencyName,
                rate,
                operatorId: realPlayer.session.operatorId,
                playerId: realPlayer.session.playerId,
                tapCount: payload.tapCount,
            });
        });
    });

    describe("validateCashOut", () => {
        beforeEach(() => {
            gameData.ingame = {
                [playerName]: {
                    betTracks: {},
                },
            };
        });

        it("should return false when player has no game data", () => {
            // Arrange
            gameData.ingame = {};

            // Act
            const result = consumer.validateCashOut(realPlayer);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return false when player has no bet tracks", () => {
            // Arrange
            gameData.ingame[playerName].betTracks = null;

            // Act
            const result = consumer.validateCashOut(realPlayer);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return false when player has no bet", () => {
            // Arrange
            gameData.ingame[playerName].betTracks = {
                // Empty bet tracks
            };

            // Act
            const result = consumer.validateCashOut(realPlayer);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return false when player has already cashed out", () => {
            // Arrange
            gameData.ingame[playerName].betTracks = {
                [Actions.Bet]: { amount: 100 },
                [Actions.CashOut]: { time: new Date() },
            };

            // Act
            const result = consumer.validateCashOut(realPlayer);

            // Assert
            expect(result).toBeFalsy();
        });

        it("should return true when player has bet and hasn't cashed out", () => {
            // Arrange
            gameData.ingame[playerName].betTracks = {
                [Actions.Bet]: { amount: 100 },
            };

            // Act
            const result = consumer.validateCashOut(realPlayer);

            // Assert
            expect(result).toBeTruthy();
        });
    });

    describe("proceedCashOut", () => {
        beforeEach(() => {
            gameData.ingame = {
                [playerName]: {
                    betTracks: {},
                },
            };
        });

        it("should return null and publish invalid notice when cash out is invalid", async () => {
            // Arrange
            const payload = { action: Actions.CashOut };

            // Act
            const result = await consumer.proceedCashOut(realPlayer, payload);

            // Assert
            expect(result).toBeNull();
            expect(consumer.baseEventPublisher.publishToUser).toHaveBeenCalledWith(realPlayer.UID, {
                endBet: -1,
                notice: helpers.invalidCashOut,
            });
        });

        it("should process valid cash out successfully", async () => {
            // Arrange
            const payload = { action: Actions.CashOut };
            const bet = {
                multiplier: 1.5,
                roundId: 123,
                tapCount: 1,
                amount: 100,
            };
            gameData.ingame[playerName].betTracks = {
                [Actions.Bet]: bet,
            };

            // Act
            const result = await consumer.proceedCashOut(realPlayer, payload);

            // Assert
            expect(result).toEqual({
                player: realPlayer,
                ...bet,
            });
        });
    });

    describe("getCashOutBet", () => {
        beforeEach(() => {
            gameData.ingame = {
                [playerName]: {
                    betTracks: {},
                },
            };
        });

        it("should return null when no bet exists", async () => {
            // Act
            const result = await consumer.getCashOutBet(realPlayer);

            // Assert
            expect(result).toBeNull();
        });

        it("should return bet details when bet exists", async () => {
            // Arrange
            const expectedBet = {
                multiplier: 1.5,
                roundId: 123,
                tapCount: 1,
                amount: 100,
            };
            gameData.ingame[playerName].betTracks = {
                [Actions.Bet]: expectedBet,
            };

            // Act
            const result = await consumer.getCashOutBet(realPlayer);

            // Assert
            expect(result).toEqual(expectedBet);
        });
    });

    describe("publishCashOut", () => {
        beforeEach(() => {
            consumer.placeBetPublisher = {
                publishSuccessCashOut: jest.fn(),
            };
            consumer.calculateCurrencyRate = jest.fn().mockReturnValue(1.0);
        });

        it("should publish cash out details correctly", async () => {
            // Arrange
            const payload = { action: Actions.CashOut };
            const winningDetails = {
                multiplier: 1.5,
                amount: 100,
            };

            // Act
            await consumer.publishCashOut(realPlayer, payload, winningDetails);

            // Assert
            expect(consumer.placeBetPublisher.publishSuccessCashOut).toHaveBeenCalledWith(
                realPlayer.UID,
                {
                    name: realPlayer.profile.name,
                    playerId: realPlayer.UID,
                    [payload.action]: winningDetails,
                },
                1.0
            );
        });
    });
});
