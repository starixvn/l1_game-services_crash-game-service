import { BaseSocketRouter } from "sc-game-base/src/core/routers";
import { SocketRouter } from "../";

describe("socketRouter", () => {
    const socketClient = { on: jest.fn(), id: 99999 };
    let socketRouter;
    beforeEach(() => {
        socketRouter = new SocketRouter({});
        socketRouter.socketClient = socketClient;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should inherit BaseSocketRouter", () => {
        expect(socketRouter instanceof BaseSocketRouter);
    });

    describe("init", () => {
        it("should register cashOut event", () => {
            // Act
            socketRouter.init(socketClient);

            // Assert
            expect(socketClient.on).toHaveBeenLastCalledWith("cashOut", expect.any(Function));
        });
    });

    describe("handleCashOut", () => {
        const payload = { amount: 123 };

        beforeEach(() => {
            socketRouter.verify = jest.fn();
        });

        it("should call verify", () => {
            // Act
            socketRouter.handleCashOut(payload);

            // Assert
            expect(socketRouter.verify).toBeCalled();
        });

        describe("when event is valid", () => {
            const gameData = {
                realPlayers: {
                    [socketClient.id]: socketClient,
                },
            };

            beforeEach(() => {
                socketClient.gameData = gameData;
            });

            it("should call cashOutConsumer.consume", () => {
                // Arrange
            });
        });
    });
});
