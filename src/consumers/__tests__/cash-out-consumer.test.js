import { Core } from "sc-game-base";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import { CashOutConsumer } from "../cash-out-consumer";
import gameSettings from "../../../src/game-settings";
import Chance from "chance";
import { stub } from "jest-micro-auto-stub";
import noticeHelper from "../../helpers/notice-helper";
import { Actions } from "../../constants";

const player = {
    socketId: "scoketId1",
    UID: "uid1",
    session: { currencyGroupId: "group1", currencyName: "UUS", system: 1, partnerId: 2 },
    profile: {
        name: "name1",
        maxBet: 8,
        minBet: 6,
    },
};
describe("CashOutConsumer", () => {
    const chance = new Chance();
    const payload = {
        freeBet: chance.bool(),
        roundId: chance.natural(),
        halfCashOut: chance.bool(),
    };
    const definition = new Core.GameDefinition(gameSettings);
    const gameData = {
        gameConfigs: { odds: {}, enableFreeBet: false },
        exchangeRates: { code: {} },
        currencyGroupGames: [{ groupId: player.session.currencyGroupId, minBet: 4, maxBet: 18 }],
        players: {},
        ingame: {
            [player.profile.name]: {
                betQueue: [],
            },
        },
        roundId: 1,
        remainingTime: 30,
    };

    let consumer;

    beforeEach(() => {
        jest.clearAllMocks();
        const publisher = stub(BaseEventPublisher);
        consumer = new CashOutConsumer(definition, gameData, publisher);
    });

    it("inherit Core.BaseEventConsumers.PlaceBetConsumer", () => {
        // Assert
        expect(consumer instanceof Core.BaseEventConsumers.PlaceBetConsumer);
    });

    describe("consume", () => {
        beforeEach(() => {
            consumer.validateRequest = jest.fn();
            consumer.adjustBetTracks = jest.fn();
        });

        it("should call validateRequest with correct parameters", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(consumer.validateRequest).toBeCalledWith(player, payload.roundId, payload.clientSendTime, payload.receivedTime);
        });

        it("should set receivedTime in payload", () => {
            // Arrange
            const beforeTime = new Date();

            // Act
            consumer.consume(player, payload);

            // Assert
            expect(payload.receivedTime).toBeInstanceOf(Date);
            expect(payload.receivedTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        });

        describe("when bet request is invalid", () => {
            beforeEach(() => {
                consumer.validateRequest.mockReturnValueOnce(false);
            });

            it("should NOT call adjustBetTracks", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.adjustBetTracks).not.toBeCalled();
            });

            it("should NOT push bet to bet queue", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(gameData.ingame[player.profile.name]?.betQueue?.length ?? 0).toBe(0);
            });
        });

        describe("when bet request is valid", () => {
            beforeEach(() => {
                consumer.validateRequest.mockReturnValueOnce(true);
            });

            it("should call adjustBetTracks", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.adjustBetTracks).toBeCalledWith(player.profile.name, payload);
            });

            it("should push bet to bet queue", () => {
                // Act
                consumer.consume(player, payload);

                // Assert
                expect(gameData.ingame[player.profile.name]?.betQueue.includes((bet) => bet.player === player && bet.payload === payload));
            });
        });
    });

    describe("validateRequest", () => {
        let clientSendTime;
        let receivedTime;

        beforeEach(() => {
            clientSendTime = new Date();
            receivedTime = new Date();
            gameData.gameConfigs.enabled = true;
            gameData.remainingTime = -1;
            gameData.ingame = {
                [player.profile.name]: {
                    betQueue: [],
                    betTracks: {
                        [Actions.Bet]: {
                            time: new Date(),
                        },
                        [Actions.CashOut]: undefined,
                        [Actions.HalfCashOut]: undefined,
                    },
                },
            };
        });

        describe("when game is NOT enable", () => {
            beforeEach(() => {
                gameData.gameConfigs.enabled = false;
            });

            it("should publishToUser failed bet", () => {
                // Act
                consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

                // Assert
                expect(consumer.publisher.publishToUser).toBeCalledWith(player.UID, {
                    endBet: -1,
                    notice: consumer.getNoticeObj(noticeHelper.invalidCashOut),
                });
            });

            it("should return false", () => {
                // Act
                const result = consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

                // Assert
                expect(result).toBeFalsy();
            });
        });

        describe("when NOT already bet", () => {
            beforeEach(() => {
                gameData.ingame = {
                    [player.profile.name]: {
                        betQueue: [],
                        betTracks: {
                            [Actions.Bet]: undefined,
                        },
                    },
                };
            });

            it("should publishToUser failed bet", () => {
                // Act
                consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

                // Assert
                expect(consumer.publisher.publishToUser).toBeCalledWith(player.UID, {
                    endBet: -1,
                    notice: consumer.getNoticeObj(noticeHelper.invalidCashOut),
                });
            });

            it("should return false", () => {
                // Act
                const result = consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

                // Assert
                expect(result).toBeFalsy();
            });
        });

        describe("when already cash out", () => {
            beforeEach(() => {
                gameData.ingame = {
                    [player.profile.name]: {
                        betQueue: [],
                        betTracks: {
                            [Actions.CashOut]: {
                                time: new Date(),
                            },
                        },
                    },
                };
            });

            it("should publishToUser failed bet", () => {
                // Act
                consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

                // Assert
                expect(consumer.publisher.publishToUser).toBeCalledWith(player.UID, {
                    endBet: -1,
                    notice: consumer.getNoticeObj(noticeHelper.invalidCashOut),
                });
            });

            it("should return false", () => {
                // Act
                const result = consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

                // Assert
                expect(result).toBeFalsy();
            });
        });

        describe("when cash out half and already cash out half", () => {
            beforeEach(() => {
                gameData.ingame = {
                    [player.profile.name]: {
                        betQueue: [],
                        betTracks: {
                            [Actions.HalfCashOut]: {
                                time: new Date(),
                            },
                        },
                    },
                };
            });

            it("should publishToUser failed bet", () => {
                // Act
                consumer.validateRequest(player, gameData.roundId, true, receivedTime);

                // Assert
                expect(consumer.publisher.publishToUser).toBeCalledWith(player.UID, {
                    endBet: -1,
                    notice: consumer.getNoticeObj(noticeHelper.invalidCashOut),
                });
            });

            it("should return false", () => {
                // Act
                const result = consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

                // Assert
                expect(result).toBeFalsy();
            });
        });

        describe("when roundId NOT valid", () => {
            it("should publishToUser failed bet", () => {
                // Arrange
                const roundId = gameData.roundId - 1;

                // Act
                consumer.validateRequest(player, roundId, clientSendTime, receivedTime);

                // Assert
                expect(consumer.publisher.publishToUser).toBeCalledWith(player.UID, {
                    endBet: -1,
                    notice: consumer.getNoticeObj(noticeHelper.invalidCashOut, { gameRoundId: roundId }),
                });
            });

            it("should return false", () => {
                // Act
                const result = consumer.validateRequest(player, gameData.roundId - 1, clientSendTime, receivedTime);

                // Assert
                expect(result).toBeFalsy();
            });
        });

        describe("when cashout time NOT valid", () => {
            beforeEach(() => {
                gameData.remainingTime = chance.natural();
            });

            it("should publishToUser failed bet", () => {
                // Act
                consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

                // Assert
                expect(consumer.publisher.publishToUser).toBeCalledWith(player.UID, {
                    endBet: -1,
                    notice: consumer.getNoticeObj(noticeHelper.invalidCashOut),
                });
            });

            it("should return false", () => {
                // Act
                const result = consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

                // Assert
                expect(result).toBeFalsy();
            });
        });

        describe("when cashOut valid", () => {
            it("should NOT publishToUser failed bet", () => {
                // Act
                consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

                // Assert
                expect(consumer.publisher.publishToUser).not.toBeCalled();
            });

            it("should return true", () => {
                // Act
                const result = consumer.validateRequest(player, gameData.roundId, clientSendTime, receivedTime);

                // Assert
                expect(result).toBeTruthy();
            });
        });
    });

    describe("adjustBetTrack", () => {
        describe("when bet action is HalfCashOut", () => {
            it("should update player betTracks halfCashOut Time", () => {
                // Arrange
                const bet = {
                    halfCashOut: true,
                    receivedTime: new Date(),
                    action: Actions.HalfCashOut,
                };
                gameData.ingame[player.profile.name] = { betTracks: {} };

                // Act
                consumer.adjustBetTracks(player.profile.name, bet);

                // Assert
                expect(gameData.ingame[player.profile.name].betTracks[bet.action].time).toEqual(bet.receivedTime);
            });
        });

        describe("when bet action is CashOut", () => {
            it("should update player betTracks CashOut Time", () => {
                // Arrange
                const bet = {
                    receivedTime: new Date(),
                    action: Actions.CashOut,
                };
                gameData.ingame[player.profile.name] = { betTracks: {} };

                // Act
                consumer.adjustBetTracks(player.profile.name, bet);

                // Assert
                expect(gameData.ingame[player.profile.name].betTracks[bet.action].time).toEqual(bet.receivedTime);
            });
        });
    });

    describe("composeValidationCriteria", () => {
        let clientSendTime;
        let receivedTime;

        beforeEach(() => {
            clientSendTime = new Date();
            receivedTime = new Date();
        });

        it("should return combined criteria from betting time and bet track validations", () => {
            // Act
            const criteria = consumer.composeValidationCriteria(gameData.roundId, player, clientSendTime, receivedTime);

            // Assert
            expect(criteria).toBeInstanceOf(Array);
            expect(criteria.length).toBeGreaterThan(0);
            criteria.forEach((criterion) => {
                expect(criterion).toHaveProperty("failure");
                expect(criterion).toHaveProperty("notice");
            });
        });
    });

    describe("composeBetTrackValidationCriteria", () => {
        it("should validate missing bet track", () => {
            // Arrange
            const betTracks = {};

            // Act
            const criteria = consumer.composeBetTrackValidationCriteria(betTracks);

            // Assert
            expect(criteria[0].failure).toBeTruthy();
            expect(criteria[0].notice).toBeDefined();
        });

        it("should validate existing cash out", () => {
            // Arrange
            const betTracks = {
                [Actions.Bet]: { time: new Date() },
                [Actions.CashOut]: { time: new Date() },
            };

            // Act
            const criteria = consumer.composeBetTrackValidationCriteria(betTracks);

            // Assert
            expect(criteria[1].failure).toBeTruthy();
            expect(criteria[1].notice).toBeDefined();
        });

        it("should pass validation for valid bet track", () => {
            // Arrange
            const betTracks = {
                [Actions.Bet]: { time: new Date() },
                [Actions.CashOut]: undefined,
            };

            // Act
            const criteria = consumer.composeBetTrackValidationCriteria(betTracks);

            // Assert
            expect(criteria.every((c) => !c.failure)).toBeTruthy();
        });
    });

    describe("composeBettingTimeValidationCriteria", () => {
        let clientSendTime;
        let receivedTime;

        beforeEach(() => {
            clientSendTime = new Date();
            receivedTime = new Date();
        });

        it("should validate game enabled status", () => {
            // Arrange
            gameData.gameConfigs.enabled = false;

            // Act
            const criteria = consumer.composeBettingTimeValidationCriteria(gameData.roundId, clientSendTime, receivedTime);

            // Assert
            expect(criteria[0].failure).toBeTruthy();
            expect(criteria[0].notice).toBeDefined();
        });

        it("should validate round ID", () => {
            // Act
            const criteria = consumer.composeBettingTimeValidationCriteria(gameData.roundId + 1, clientSendTime, receivedTime);

            // Assert
            expect(criteria[1].failure).toBeTruthy();
            expect(criteria[1].notice).toBeDefined();
        });

        it("should validate remaining time", () => {
            // Arrange
            gameData.remainingTime = consumer.definition.durations.liveTime + 1;

            // Act
            const criteria = consumer.composeBettingTimeValidationCriteria(gameData.roundId, clientSendTime, receivedTime);

            // Assert
            expect(criteria[2].failure).toBeTruthy();
            expect(criteria[2].notice).toBeDefined();
        });
    });
});
