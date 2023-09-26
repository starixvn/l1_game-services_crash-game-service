import Chance from "chance";
import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import { cloneDeep } from "lodash";
import mongoose from "mongoose";
import logger from "sc-common/logger";

import BaseMetrics from "sc-game-base/src/core/base-metrics";
import { PlaceBetPublisher } from "sc-game-base/src/core/event-publishers";
import { GameData } from "sc-game-base/src/core";
import { GameDefinition } from "sc-game-base/src/core";
import ProcessBetQueue from "../process-bet-queue";
import { Actions } from "../../constants";
import noticeHelper from "../../helpers/notice-helper";

describe("ProcessBetQueue", () => {
    jest.mock("sc-game-base/src/core/event-publishers");

    const gameData = new GameData(10);
    gameData.exchangeRates = {
        exId: 1,
        code: {
            USD: 1,
            VND: 0.00004405,
            IDR: 0.07099,
        },
    };

    gameData.gameConfigs = {
        odds: {
            red2: 2.4,
        },
    };

    gameData.currencies = [
        { code: "USD", name: "USD", isTest: false, isUncountOnTotal: false },
        { code: "IND", name: "IND", isTest: true, isUncountOnTotal: false },
        { code: "VND", name: "UUS", isTest: true, isUncountOnTotal: true },
    ];

    const chance = new Chance();
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
    const betLogsRepository = stubMongooseModelStupidly(mongoose.Model);
    betLogsRepository.create = jest.fn();

    /** @type {mongoose.Model}*/
    const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);
    userInfosRepository.updateOne = jest.fn();

    const baseMetrics = stub(BaseMetrics);
    let player = null,
        proceedBetQueue = null,
        payload = null,
        placeBet = null;

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
        payload = mockPayload();
        proceedBetQueue = initBetQueue(placeBet);

        gameData.ingame = {
            player01: cloneDeep(playerInGameData),
        };
    });

    describe("proceedActions", () => {
        beforeEach(() => {
            proceedBetQueue.proceedBet = jest.fn();
            proceedBetQueue.proceedHalfCashOut = jest.fn();
            proceedBetQueue.proceedCashOut = jest.fn();
        });

        describe("when action is bet", () => {
            it("should call proceedBet", async () => {
                // Arrange
                const payload = { ...mockPayload(), action: Actions.Bet };

                // Act
                await proceedBetQueue.proceedActions(player, payload);

                // Assert
                expect(proceedBetQueue.proceedBet).toBeCalledWith(player, payload);
            });
        });

        describe("when action is cashOut", () => {
            it("should call proceedCashOut", async () => {
                // Arrange
                const payload = { ...mockPayload(), action: Actions.CashOut };

                // Act
                await proceedBetQueue.proceedActions(player, payload);

                // Assert
                expect(proceedBetQueue.proceedCashOut).toBeCalledWith(player, payload);
            });
        });

        describe("when action is halfCashOut", () => {
            it("should call halfCashOut", async () => {
                // Arrange
                const payload = { ...mockPayload(), action: Actions.HalfCashOut };

                // Act
                await proceedBetQueue.proceedActions(player, payload);

                // Assert
                expect(proceedBetQueue.proceedHalfCashOut).toBeCalledWith(player, payload);
            });
        });
    });

    describe("proceedHalfCashOut", () => {
        it("should find current round bet", async () => {
            // Act
            await proceedBetQueue.proceedHalfCashOut(player, payload);

            // Assert
            expect(betsRepository.findOne).toBeCalledWith({ uid: player.UID, roundId: gameData.roundId, freeBet: payload.freeBet });
        });

        describe("when NOT exist bet", () => {
            it("should publishGameFailedBet", async () => {
                // Act
                await proceedBetQueue.proceedHalfCashOut(player, payload);

                // Assert
                expect(proceedBetQueue.placeBetPublisher.publishGameFailedBet).toBeCalledWith(player.UID, {
                    endBet: -1,
                    notice: { errorCode: noticeHelper.invalidCashOut },
                });
            });
        });

        describe("when existing bet", () => {
            it("should NOT publishGameFailed");
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

    const mockPayload = (roundId = 1, freeBet = false) => {
        return {
            freeBet,
            amount: chance.natural(),
            action: chance.pickone(Object.values(Actions)),
            roundId,
            receivedTime: new Date(),
            time: new Date(),
        };
    };
});
