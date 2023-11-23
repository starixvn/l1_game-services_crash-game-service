import Chance from "chance";
import { Models } from "jest-auto-fixture";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { RoundResultPublisher, UserBetResultPublisher } from "sc-game-base/src/core/event-publishers";
import GameDefinition from "sc-game-base/src/core/game-definition";
import CrashGameData from "../../game-data";
import { SettleGameRoundConsumer } from "../settle-game-round-consumer";

describe("SettleGameRoundConsumer", () => {
    const chance = new Chance();
    const defaultDefinition = new GameDefinition({ id: 1, name: "game name" }, jest.fn(), jest.fn());
    const roundId = chance.natural();

    const defaultGameData = new CrashGameData(30);
    defaultGameData.gameConfigs = Models.GameConfig({});

    let gameData, definition, consumer;

    /** @type {UserRoundResultPublisher}*/
    const roundResultPublisher = stub(RoundResultPublisher);

    /** @type {UserBetResultPublisher}*/
    const userBetResultPublisher = stub(UserBetResultPublisher);

    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongoose(mongoose.Model);

    /** @type {mongoose.Model}*/
    const betsRepository = stubMongoose(mongoose.Model);

    /** @type {mongoose.Model}*/
    const betLogsRepository = stubMongoose(mongoose.Model);
    betLogsRepository.insertMany = jest.fn();

    /** @type {mongoose.Model}*/
    const tempBetsRepository = stubMongoose(mongoose.Model);

    /** @type {mongoose.Model}*/
    const tempBetLogsRepository = stubMongoose(mongoose.Model);

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
            betLogsRepository,
            tempBetsRepository,
            tempBetLogsRepository,
        });
    });

    describe("settleBets", () => {
        const result = chance.floating({ min: 1, max: 10000 });
        const playerId = chance.natural();
        const queryBets = [
            { uid: chance.guid(), playerId, siteId: chance.natural(), save: jest.fn() },
            {
                uid: chance.guid(),
                amount: chance.natural(),
                playerId: chance.natural(),
                siteId: chance.natural(),
                freeBet: true,
                save: jest.fn(),
            },
        ];
        const betResult = {
            totalBetAmount: chance.natural(),
            totalWin: chance.natural(),
            netWin: chance.natural(),
            totalLost: chance.natural(),
            winningByChoices: {},
        };

        const settleBetParams = { result, roundId, time: new Date() };

        beforeEach(() => {
            roundsRepository.create.mockReturnValueOnce({ id: 1, result });
            consumer.callEndGame = jest.fn();
            consumer.queryBets = jest.fn(() => queryBets);
            consumer.calculateBetResult = jest.fn(() => betResult);
            consumer.captureBetResult = jest.fn();
            consumer.betLogsRepository.find().lean().exec.mockReturnValueOnce([]);
            consumer.tempBetLogsRepository.find().lean().exec.mockReturnValueOnce([]);
        });

        it("should call queryBets", async () => {
            // Act
            await consumer.settleBets(settleBetParams);

            // Assert
            expect(consumer.queryBets).toBeCalledWith(settleBetParams.roundId);
        });

        it("should query betLogs", async () => {
            // Act
            await consumer.settleBets(settleBetParams);

            // Assert
            expect(betLogsRepository.find).toHaveBeenCalledWith({ roundId });
        });

        Object.keys(queryBets)
            .map((index) => +index)
            .forEach((betIndex) => {
                describe(`with bet ${betIndex + 1}`, () => {
                    it("should call calculateBetResult", async () => {
                        // Act
                        await consumer.settleBets(settleBetParams);

                        // Assert
                        expect(consumer.calculateBetResult).toHaveBeenNthCalledWith(betIndex + 1, queryBets[betIndex], []);
                    });

                    it("should call endGame", async () => {
                        // Act
                        await consumer.settleBets(settleBetParams);

                        // Assert
                        expect(consumer.callEndGame).toHaveBeenNthCalledWith(
                            betIndex + 1,
                            queryBets[betIndex],
                            settleBetParams.roundId,
                            settleBetParams.time,
                            betResult
                        );
                    });

                    it("should publish bet result to user", async () => {
                        // Act
                        await consumer.settleBets(settleBetParams);

                        // Assert
                        expect(userBetResultPublisher.publish).toHaveBeenNthCalledWith(betIndex + 1, queryBets[betIndex].uid, betResult);
                    });
                });
            });
    });

    describe("calculateWinAmount", () => {
        describe("when bet logs is empty", () => {
            it("should return 0", () => {
                // Act
                const result = consumer.calculateWinAmount([]);

                // Assert
                expect(result).toBe(0);
            });
        });

        describe("when bet logs is NOT empty", () => {
            const winAmount1 = chance.natural();
            const winAmount2 = chance.natural();

            const betLogs = [{ winAmount: winAmount1 }, { winAmount: winAmount2 }];

            it("should return total win amount", () => {
                // Act
                const result = consumer.calculateWinAmount(betLogs);

                // Assert
                expect(result).toBe(winAmount2 + winAmount1);
            });
        });
    });

    describe("calculateBetResult", () => {
        const bet = {
            amount: chance.natural(),
        };

        const betLogs = [];

        beforeEach(() => {
            consumer.calculateWinAmount = jest.fn();
        });

        it("should call calculateWinAmount", () => {
            // Arrange
            const winAmount = chance.natural();
            consumer.calculateWinAmount.mockReturnValueOnce(winAmount);

            // Act
            consumer.calculateBetResult(bet, betLogs);

            // Assert
            expect(consumer.calculateWinAmount).toBeCalledWith(betLogs);
        });

        it("should return Bet Result with total win equal winAmount", () => {
            // Arrange
            const winAmount = chance.natural();
            consumer.calculateWinAmount.mockReturnValueOnce(winAmount);

            // Act
            const { totalWin } = consumer.calculateBetResult(bet, betLogs);

            // Assert
            expect(totalWin).toBe(winAmount);
        });
        it("should return Bet Result with total bet amount equal bet amount", () => {
            // Arrange
            const winAmount = chance.natural();
            consumer.calculateWinAmount.mockReturnValueOnce(winAmount);

            // Act
            const { totalBetAmount } = consumer.calculateBetResult(bet, betLogs);

            // Assert
            expect(totalBetAmount).toBe(bet.amount);
        });

        describe("when win amount is greater than bet amount", () => {
            const betAmount = chance.natural({ min: 1, max: 2000 });
            const winAmount = betAmount * chance.floating({ min: 1, max: 2000 });

            beforeEach(() => {
                consumer.calculateWinAmount.mockReturnValueOnce(winAmount);
            });

            it("should return Bet Result with netWin is greater than 0", () => {
                // Act
                const expectResult = +(winAmount - betAmount).toFixed(2);
                const { netWin } = consumer.calculateBetResult({ amount: betAmount }, betLogs);

                // Assert
                expect(netWin).toBeGreaterThan(0);
                expect(netWin).toBe(expectResult);
            });

            it("should return Bet Result with totalLost is 0", () => {
                // Act
                const { totalLost } = consumer.calculateBetResult({ amount: betAmount }, betLogs);

                // Assert
                expect(totalLost).toBe(0);
            });
        });

        describe("when win amount is smaller than bet amount", () => {
            const betAmount = chance.natural({ min: 1, max: 2000 });
            const winAmount = betAmount * chance.floating({ min: 0, max: 0.9 });

            beforeEach(() => {
                consumer.calculateWinAmount.mockReturnValueOnce(winAmount);
            });

            it("should return Bet Result with netWin is 0", () => {
                // Act
                const { netWin } = consumer.calculateBetResult({ amount: betAmount }, betLogs);

                // Assert
                expect(netWin).toBe(0);
            });

            it("should return Bet Result with totalLost is greater than 0", () => {
                // Act
                const expectedResult = +(betAmount - winAmount).toFixed(2);
                const { totalLost } = consumer.calculateBetResult({ amount: betAmount }, betLogs);

                // Assert
                expect(totalLost).toBeGreaterThan(0);
                expect(totalLost).toBe(expectedResult);
            });
        });
    });

    describe("addRefundBetLogForPlayersOnUM", () => {
        const player1 = {
            uid: chance.guid(),
            name: chance.string(),
            playerId: chance.natural(),
            siteId: chance.string(),
            operatorId: "operator1",
            amount: 20,
        };
        const player2 = {
            uid: chance.guid(),
            name: chance.string(),
            playerId: chance.natural(),
            siteId: chance.string(),
            operatorId: "operator2",
            amount: 10,
        };

        afterEach(() => {
            gameData.ingame = {};
        });
        describe("when operator1 is under UM", () => {
            it("should only refund to users belong to operator1", async () => {
                //Arrange
                const bets = [player1, player2];
                const betLogs = [];
                gameData.ingame = {
                    [player1.name]: {
                        playerData: {
                            session: {
                                playerId: player1.playerId,
                                operatorId: player1.operatorId,
                            },
                        },
                        isUm: true,
                    },
                    [player2.name]: {
                        playerData: {
                            session: {
                                playerId: player2.playerId,
                                operatorId: player2.operatorId,
                            },
                        },
                    },
                };
                //Act
                await consumer.addRefundBetLogForPlayersOnUM(bets, betLogs);

                //Assert
                expect(betLogs.length).toBe(1);
                expect(betLogsRepository.insertMany).toHaveBeenCalled();
            });
        });
    });
});
