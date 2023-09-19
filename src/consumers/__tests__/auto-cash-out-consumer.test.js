import { Core } from "sc-game-base";
import { stub } from "jest-micro-auto-stub";
import { BaseEventPublisher } from "sc-game-base/src/core/event-publishers";
import gameSettings from "../../../src/game-settings";
import { AutoCashOutConsumer } from "../auto-cash-out-consumer";

jest.mock("sc-game-base/src/core/event-publishers");
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
describe("AutoCashOutBetConsumers", () => {
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
    const publisher = stub(BaseEventPublisher);

    beforeEach(() => {
        jest.clearAllMocks();

        // Arrange
        consumer = new AutoCashOutConsumer(definition, gameData, publisher);
    });

    it("inherit Core.BaseEventConsumers.PlaceBetConsumer", () => {
        // Assert
        expect(consumer instanceof Core.BaseEventConsumers.PlaceBetConsumer);
    });
});
