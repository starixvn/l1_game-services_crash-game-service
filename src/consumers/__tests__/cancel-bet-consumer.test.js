import { Core } from "sc-game-base";
import mongoose from "mongoose";
import { stubMongooseModelStupidly, stub } from "jest-micro-auto-stub";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import { CancelBetConsumer } from "../cancel-bet-consumer";
import gameSettings from "../../../src/game-settings";
import { helpers } from "sc-common";

/** @type {mongoose.Model}*/
const earlyBetsRepository = stubMongooseModelStupidly(mongoose.Model);
earlyBetsRepository.save = jest.fn();

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
describe("CancelBetConsumers", () => {
    const definition = new Core.GameDefinition(gameSettings);
    const gameData = {
        gameConfigs: { odds: {}, enableFreeBet: false },
        exchangeRates: { code: {} },
        currencyGroupGames: [{ groupId: player.session.currencyGroupId, minBet: 4, maxBet: 18 }],
        players: {},
        ingame: {},
        roundId: 1,
        remainingTime: -2,
    };

    let consumer;

    beforeEach(() => {
        jest.clearAllMocks();

        // Arrange
        const publisher = stub(BaseEventPublisher);
        consumer = new CancelBetConsumer(definition, gameData, publisher, earlyBetsRepository);
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
        describe("when betting on place bet time", () => {
            it("should return cannot cancel bet ", () => {
                // arrange
                gameData.gameConfigs.enabled = true;
                gameData.remainingTime = 9;
                // act
                const criterions = consumer.composeBettingTimeValidationCriteria(2);

                // assert
                expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
                    failure: true,
                    notice: { errorCode: helpers.noticeHelper.cannotCancelBet },
                });
            });
        });
    });

    describe("composeBetAmountValidationCriteria", () => {
        describe("when early bet not available ", () => {
            it("should return failed", () => {
                // Arrange
                const expectedValue = { failure: true, notice: { errorCode: helpers.noticeHelper.invalidBet } };

                // Act
                const actualValue = consumer.composeBetAmountValidationCriteria(player, 7, false);

                // Assert
                expect(actualValue[0]).toStrictEqual(expectedValue);
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
                const actualValue = consumer.validateBetRequest(player, amount, false);

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
        describe("when bet is invalid", () => {
            it("should not remove early bet", () => {
                // Arrange
                consumer.gameData = { ingame: { [player.profile.name]: { earlyBet: { amount: 3 } } } };
                spyOn(consumer, "validateBetRequest").and.returnValue(false);
                const payload = { amount: 3 };

                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.gameData.ingame[player.profile.name].earlyBet).toStrictEqual({ amount: 3 });
            });
        });

        describe("when bet is valid and not in game yet", () => {
            it("should remove early bet", () => {
                // Arrange
                consumer.gameData.ingame = { [player.profile.name]: { earlyBet: { amount: 3 } } };
                earlyBetsRepository.findOne().lean().exec.mockReturnValue({ actions: [], save: jest.fn() });
                spyOn(consumer, "validateBetRequest").and.returnValue(true);
                const payload = { amount: 3 };

                // Act
                consumer.consume(player, payload);

                // Assert
                expect(consumer.gameData.ingame[player.profile.name]).toStrictEqual({});
            });
        });
    });
});
