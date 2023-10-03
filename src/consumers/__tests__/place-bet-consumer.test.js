import { Core } from "sc-game-base";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import { PlaceBetConsumer } from "../place-bet-consumer";
import gameSettings from "../../../src/game-settings";
import { helpers } from "sc-common";
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
describe("PlaceBetConsumer", () => {
    const chance = new Chance();
    const payload = {
        amount: chance.natural(),
        freeBet: chance.bool(),
        roundId: chance.natural({ min: 1 }),
        autoCashOut: 3.4,
        action: Actions.bet,
    };
    const definition = new Core.GameDefinition(gameSettings);
    const gameData = {
        gameConfigs: { odds: {}, enableFreeBet: false },
        exchangeRates: { code: {} },
        currencyGroupGames: [{ groupId: player.session.currencyGroupId, minBet: 4, maxBet: 18 }],
        players: {},
        ingame: {},
        roundId: 1,
        remainingTime: 30,
    };

    let consumer;

    beforeEach(() => {
        jest.clearAllMocks();

        // Arrange
        const publisher = stub(BaseEventPublisher);
        consumer = new PlaceBetConsumer(definition, gameData, publisher);
    });

    it("inherit Core.BaseEventConsumers.PlaceBetConsumer", () => {
        // Assert
        expect(consumer instanceof Core.BaseEventConsumers.PlaceBetConsumer);
    });

    describe("composeValidationCriteria", () => {
        it("should return combined results of betting time and bet amount validations", () => {
            // Arrange
            spyOn(consumer, "composeBettingTimeValidationCriteria").and.returnValue([{ id: 1 }]);
            spyOn(consumer, "composeBetAmountValidationCriteria").and.returnValue([{ id: 2 }]);
            const expectedValue = [{ id: 1 }, { id: 2 }];

            // Act
            const actualValue = consumer.composeValidationCriteria();

            // Assert
            expect(actualValue).toStrictEqual(expectedValue);
        });
    });

    describe("composeBettingTimeValidationCriteria", () => {
        describe("when game's disabled", () => {
            it("should return invalid bet", () => {
                // arrange
                const gameData = new Core.GameData();
                gameData.gameConfigs = {
                    enabled: false,
                };

                // act
                const actualResult = consumer.composeBettingTimeValidationCriteria(1);

                // assert
                expect(actualResult[0].failure).toBe(true);
            });
        });

        describe("When roundId not match running round", () => {
            it("should return invalid notice ", () => {
                //arrange
                gameData.gameConfigs.enabled = true;
                // act
                var criterions = consumer.composeBettingTimeValidationCriteria(2);

                // assert
                expect(criterions).not.toBeEmpty();
                expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
                    failure: true,
                    notice: { errorCode: helpers.noticeHelper.invalidBet, gameRoundId: 2 },
                });
            });
        });

        describe("return place next round", () => {
            it("when place bet in lock bet time ", () => {
                // arrange
                gameData.gameConfigs.enabled = true;
                gameData.remainingTime = 3;
                // act
                const criterions = consumer.composeBettingTimeValidationCriteria(1);

                // assert
                expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
                    failure: true,
                    notice: { errorCode: helpers.noticeHelper.placeBetNextRound },
                });
            });

            it("when place bet in settle time ", () => {
                // arrange
                gameData.gameConfigs.enabled = true;
                gameData.remainingTime = 11;
                // act
                const criterions = consumer.composeBettingTimeValidationCriteria(1);

                // assert
                expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
                    failure: true,
                    notice: { errorCode: helpers.noticeHelper.placeBetNextRound },
                });
            });
        });
    });

    describe("composeBetAmountValidationCriteria", () => {
        describe("when amount < min bet", () => {
            it("should return failed", () => {
                // Arrange
                const amount = 3;
                const expectedValue = { failure: true, notice: { errorCode: helpers.noticeHelper.minBet, minBet: 6 } };

                // Act
                const actualValue = consumer.composeBetAmountValidationCriteria(player, amount, false, 1);

                // Assert
                expect(actualValue[1]).toStrictEqual(expectedValue);
            });
        });

        describe("when amount > max bet ", () => {
            it("should return failed", () => {
                // Arrange
                const amount = 19;
                const expectedValue = { failure: true, notice: { errorCode: helpers.noticeHelper.maxBet, maxBet: 8 } };

                // Act
                const actualValue = consumer.composeBetAmountValidationCriteria(player, amount, false, 1);

                // Assert
                expect(actualValue[2]).toStrictEqual(expectedValue);
            });
        });

        describe("when have autoCashOut ", () => {
            it("should return failed", () => {
                // Arrange
                const amount = 7;
                const autoCashOut = 2.1;
                const expectedValue = { failure: true, notice: { errorCode: noticeHelper.invalidValueCashOut, autoCashOut: 2.1 } };

                // Act
                const actualValue = consumer.composeBetAmountValidationCriteria(player, amount, false, autoCashOut);

                // Assert
                expect(actualValue[3]).toStrictEqual(expectedValue);
            });
        });
    });

    describe("validateBetRequest", () => {
        describe("when have failure", () => {
            it("should return false", () => {
                // Arrange
                consumer.gameData = { currencyGroupGames: [{ groupId: "group1", minBet: 4, maxBet: 18 }] };
                spyOn(consumer, "composeValidationCriteria").and.returnValue([{ failure: true, notice: { code: 1 } }]);
                const amount = 3;

                // Act
                const actualValue = consumer.validateBetRequest(player, amount, false, 1);

                // Assert
                expect(actualValue).toBeFalse();
            });
        });

        describe("when not have failure", () => {
            it("should return true", () => {
                // Arrange
                consumer.gameData = { currencyGroupGames: [{ groupId: player.session.currencyGroupId, minBet: 4, maxBet: 18 }] };
                spyOn(consumer, "composeValidationCriteria").and.returnValue([{ failure: false, notice: { code: 1 } }]);
                const amount = 3;

                // Act
                const actualValue = consumer.validateBetRequest(player, amount, false);

                // Assert
                expect(actualValue).toBeTrue();
            });
        });
    });

    describe("consume", () => {
        beforeEach(() => {
            consumer.validateBetRequest = jest.fn();
            consumer.adjustBetTracks = jest.fn();
        });

        it("should call validateBetRequest", () => {
            // Act
            consumer.consume(player, payload);

            // Assert
            expect(consumer.validateBetRequest).toBeCalledWith(
                player,
                payload.amount,
                payload.freeBet,
                payload.roundId,
                payload.autoCashOut
            );
        });

        describe("when bet request is invalid", () => {
            beforeEach(() => {
                consumer.validateBetRequest.mockReturnValueOnce(false);
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
                consumer.validateBetRequest.mockReturnValueOnce(true);
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

            describe("when player info is NOT exist on ingame data", () => {
                it("should add player info to ingame data", () => {
                    // Arrange
                    gameData.ingame = {};

                    // Act
                    consumer.consume(player, payload);

                    // Assert
                    expect(gameData.ingame[player.profile.name]).toBeDefined();
                });
            });
        });
    });

    describe("adjustBetTrack", () => {
        describe("when having player info on ingame data", () => {
            it("should update player betTracks", () => {
                // Arrange
                gameData.ingame[player.profile.name] = { betTracks: {} };

                // Act
                consumer.adjustBetTracks(player.profile.name, payload);

                // Assert
                expect(gameData.ingame[player.profile.name].betTracks[payload.action].amount).toStrictEqual(payload.amount);
                expect(gameData.ingame[player.profile.name].betTracks[payload.action].autoCashOut).toStrictEqual(payload.autoCashOut);
            });
        });
    });
});
