import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import TableGameDefinition from "sc-game-base/src/table/table-game-definition";
import { PFRoundResultConsumer, ProvablyFairConsumer } from "sc-provably-fair";
import { Actions } from "../../constants";
import CrashGameData from "../../game-data";
import gameSettings from "../../game-settings";
import { RefundBetConsumer } from "../refund-bet-consumer";
import { SettleGameRoundConsumer } from "../settle-game-round-consumer";

const definition = new TableGameDefinition(gameSettings, jest.fn());
let gameData;

/** @type {mongoose.Model}*/
const betsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const tempBetsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const betLogsRepository = stubMongoose(mongoose.Model);
const settleGameRoundConsumer = stub(SettleGameRoundConsumer);
const roundResultConsumer = stub(PFRoundResultConsumer);
const provablyFairConsumer = stub(ProvablyFairConsumer);

beforeEach(() => {
    gameData = new CrashGameData(3);
});

afterEach(() => {
    jest.clearAllMocks();
});

function initConsumer() {
    return new RefundBetConsumer({
        gameData,
        definition,
        betsRepository,
        betLogsRepository,
        tempBetsRepository,
        settleGameRoundConsumer,
        roundResultConsumer,
        provablyFairConsumer,
    });
}

describe("RefundBetConsumer", () => {
    describe("generateResult", () => {
        describe("when lastResultRecord has finalHash", () => {
            it("should call definition.generateResult", async () => {
                // Arrange
                const refundBetConsumer = initConsumer();
                gameData.lastResultRecord = { finalHash: "hash" };

                // Act
                await refundBetConsumer.generateResult([]);

                // Assert
                expect(definition.generateResult).toHaveBeenCalledWith(gameData.lastResultRecord.finalHash);
            });
        });

        describe("when lastResultRecord does not have finalHash", () => {
            it("should call provablyFairConsumer.addServerSeed", async () => {
                // Arrange
                const refundBetConsumer = initConsumer();
                gameData.lastResultRecord = { serverSeed: "seed", serverSeedHash: "serverSeedHash" };

                // Act
                await refundBetConsumer.generateResult([]);

                // Assert
                expect(provablyFairConsumer.addServerSeed).toHaveBeenCalledWith(gameData.lastResultRecord.serverSeed);
            });

            it("should call provablyFairConsumer.addServerSeed", async () => {
                // Arrange
                const refundBetConsumer = initConsumer();
                gameData.lastResultRecord = { serverSeed: "seed", serverSeedHash: "serverSeedHash" };

                // Act
                await refundBetConsumer.generateResult([]);

                // Assert
                expect(provablyFairConsumer.addServerSeedHash).toEqual(gameData.lastResultRecord.serverSeedHash);
            });

            it("should call roundResultConsumer.generateResult", async () => {
                // Arrange
                const refundBetConsumer = initConsumer();
                gameData.lastResultRecord = { serverSeed: "seed" };

                // Act
                await refundBetConsumer.generateResult([]);

                // Assert
                expect(roundResultConsumer.generateResult).toHaveBeenCalled();
            });
        });
    });

    describe("updateClientSeeds", () => {
        it("should call provablyFairConsumer.addClientSeed", () => {
            // Arrange
            const unsettledBets = [
                { name: "player2", clientSeed: "seed2", time: new Date(new Date().getTime() + 10000) },
                { name: "player1", clientSeed: "seed1", time: new Date() },
                { name: "player3", clientSeed: "seed3", time: new Date(new Date().getTime() + 20000) },
            ];

            const refundBetConsumer = new initConsumer();

            // Act
            refundBetConsumer.updateClientSeeds(unsettledBets);

            // Assert
            expect(provablyFairConsumer.addClientSeed).toHaveBeenCalledTimes(unsettledBets.length);
        });
    });

    describe("getUnsettledBets", () => {
        it("should return array containing bot bets and player bets", async () => {
            // Arrange
            const refundBetConsumer = initConsumer();
            gameData.roundId = 100;
            const playerBets = [
                { name: "player1", clientSeed: "seed1", time: new Date() },
                { name: "player2", clientSeed: "seed2", time: new Date(new Date().getTime() + 10000) },
                { name: "player3", clientSeed: "seed3", time: new Date(new Date().getTime() + 20000) },
            ];
            const botBets = [
                { name: "bot1", clientSeed: "botseed1", time: new Date() },
                { name: "bot2", clientSeed: "botseed2", time: new Date(new Date().getTime() + 10000) },
                { name: "bot3", clientSeed: "botseed3", time: new Date(new Date().getTime() + 20000) },
            ];

            betsRepository.find().lean().exec.mockReturnValueOnce(playerBets);
            tempBetsRepository.find().lean().exec.mockReturnValueOnce(botBets);

            // Act
            const result = await refundBetConsumer.getUnsettledBets();

            // Assert
            expect(result).toEqual(playerBets.concat(botBets));
        });
    });

    describe("proceed", () => {
        describe(" when there are no unsettled bets", () => {
            it("should do nothing", async () => {
                // Arrange
                const refundBetConsumer = initConsumer();
                betsRepository.find().lean().exec.mockReturnValueOnce([]);
                tempBetsRepository.find().lean().exec.mockReturnValueOnce([]);

                // Act
                await refundBetConsumer.proceed();

                // Assert
                expect(settleGameRoundConsumer.settleRound).not.toHaveBeenCalled();
            });
        });

        describe("when there are unsettled bets", () => {
            beforeAll(() => {
                jest.useFakeTimers("modern");
                jest.setSystemTime(new Date(2024, 3, 1));
            });

            afterAll(() => {
                jest.useRealTimers();
            });

            const unsettledBets = [
                {
                    uid: "player1-uid",
                    name: "player1",
                    clientSeed: "seed1",
                    time: new Date(),
                    amount: 10,
                    roundId: 1,
                    siteId: "123",
                    currency: "USD",
                    rate: 1,
                    operatorId: "OW",
                    playerId: 1,
                },
                {
                    uid: "player2-uid",
                    name: "player2",
                    clientSeed: "seed2",
                    time: new Date(new Date().getTime() + 10000),
                    amount: 10,
                    roundId: 1,
                    siteId: "123",
                    currency: "USD",
                    rate: 1,
                    operatorId: "OW",
                    playerId: 2,
                },
            ];

            it("should insert refund betlogs for player not cashing out", async () => {
                // Arrange
                const betLogs = [
                    {
                        uid: "player2-uid",
                        name: "player2",
                        playerId: 2,
                        action: Actions.CashOut,
                        amount: 10,
                        siteId: "123",
                        currency: "USD",
                        rate: 1,
                        operatorId: "OW",
                    },
                ];
                gameData.lastResultRecord = { serverSeed: "seed", finalHash: "hash" };

                betLogsRepository.find().lean().exec.mockReturnValueOnce(betLogs);
                betsRepository.find().lean().exec.mockReturnValueOnce(unsettledBets);
                tempBetsRepository.find().lean().exec.mockReturnValueOnce([]);

                const refundBetConsumer = initConsumer();

                // Act
                await refundBetConsumer.proceed();

                // Assert
                expect(betLogsRepository.insertMany).toHaveBeenCalledWith([
                    {
                        uid: "player1-uid",
                        name: "player1",
                        time: new Date(2024, 3, 1),
                        action: Actions.Refund,
                        amount: 10,
                        winAmount: 10,
                        clientSendTime: new Date(2024, 3, 1),
                        receivedTime: new Date(2024, 3, 1),
                        roundId: 1,
                        siteId: "123",
                        currency: "USD",
                        rate: 1,
                        operatorId: "OW",
                        playerId: 1,
                    },
                ]);
            });

            it("should insert refund betlogs for player half cash out", async () => {
                // Arrange
                const betLogs = [
                    {
                        uid: "player1-uid",
                        name: "player1",
                        playerId: 1,
                        action: Actions.HalfCashOut,
                        amount: 5,
                        siteId: "123",
                        currency: "USD",
                        rate: 1,
                        operatorId: "OW",
                    },
                    {
                        uid: "player2-uid",
                        name: "player2",
                        playerId: 2,
                        action: Actions.CashOut,
                        amount: 10,
                        siteId: "123",
                        currency: "USD",
                        rate: 1,
                        operatorId: "OW",
                    },
                ];

                gameData.lastResultRecord = { serverSeed: "seed", finalHash: "hash" };

                betLogsRepository.find().lean().exec.mockReturnValueOnce(betLogs);
                betsRepository.find().lean().exec.mockReturnValueOnce(unsettledBets);
                tempBetsRepository.find().lean().exec.mockReturnValueOnce([]);

                const refundBetConsumer = initConsumer();

                // Act
                await refundBetConsumer.proceed();

                // Assert
                expect(betLogsRepository.insertMany).toHaveBeenCalledWith([
                    {
                        uid: "player1-uid",
                        name: "player1",
                        time: new Date(),
                        action: Actions.Refund,
                        amount: 5,
                        winAmount: 5,
                        clientSendTime: new Date(),
                        receivedTime: new Date(),
                        roundId: 1,
                        siteId: "123",
                        currency: "USD",
                        rate: 1,
                        operatorId: "OW",
                        playerId: 1,
                    },
                ]);
            });
        });
    });
});
