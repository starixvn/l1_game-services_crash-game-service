import LiveGameCrons from "../live-game-cron";
import LiveGamePublisher from "../../event-publishers/live-game-publisher";
import { GameData } from "sc-game-base/src/core";
import { stub } from "jest-micro-auto-stub";
import { Chance } from "chance";
import { calculateMultiplier } from "../../helpers/crash-point-helper";
import { Actions, MinMultiplierValue, MultiplierValues } from "../../constants";
import { addMillisecond } from "../../helpers/date-helper";

jest.mock("../../helpers/crash-point-helper", () => ({
    calculateMultiplier: jest.fn(),
    calculateCrashTimeInMillisecond: jest.fn(),
}));

jest.mock("../../helpers/date-helper", () => ({
    addMillisecond: jest.fn(),
}));

describe("liveGameCrons", () => {
    const gameData = new GameData();
    gameData.startTime = new Date();
    const liveGamePublisher = stub(LiveGamePublisher);
    const logService = {};
    const chance = new Chance();
    let cron;
    beforeEach(() => {
        cron = new LiveGameCrons({ liveGamePublisher, logService, gameData });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("start", () => {
        beforeEach(() => {
            cron.proceed = jest.fn();
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
            clearTimeout(cron.timeoutId);
        });

        it("should call proceed", () => {
            // Act
            cron.start();

            // Assert
            expect(cron.proceed).toBeCalled();
        });

        it("should call setTimeOut", () => {
            // Act
            cron.start();

            // Assert
            expect(setTimeout).toBeCalledWith(expect.any(Function), 100);
        });

        it("should call proceed every 100ms", () => {
            // Act
            cron.start();
            jest.advanceTimersByTime(1000);

            // Assert
            expect(cron.proceed).toHaveBeenCalledTimes(11);
        });
    });

    describe("stop", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should remove timeOut", () => {
            // Arrange
            cron.timeoutId = chance.natural();

            // Act
            cron.stop();

            // Assert
            expect(clearTimeout).toBeCalledWith(cron.timeoutId);
        });
    });

    describe("proceed", () => {
        const mockDate = new Date();
        beforeEach(() => {
            cron.proceedAutoCashOut = jest.fn();
            jest.spyOn(global, "Date").mockImplementation(() => mockDate);
        });

        it("should call calculate multiplier", () => {
            // Act
            cron.proceed();

            // Assert
            expect(calculateMultiplier).toBeCalledWith(mockDate - gameData.startTime);
        });

        it("should call liveGamePublisher.publish", () => {
            // Act
            cron.proceed();

            // Assert
            expect(calculateMultiplier).toBeCalledWith(mockDate - gameData.startTime);
        });

        it("should call proceedAutoCashOut", () => {
            // Arrange
            const m = chance.floating({ min: 1, max: 2000 });
            calculateMultiplier.mockReturnValueOnce(m);

            // Act
            cron.proceed();

            // Assert
            expect(cron.proceedAutoCashOut).toBeCalledWith(m);
        });
    });

    describe("proceedAutoCashOut", () => {
        describe("when exist valid autoCashOut value on bet", () => {
            it("should push cashOut action to betQueue", () => {
                // Arrange
                const mockReceivedTime = new Date();
                const playerName = "name01";
                const UID = "uid";
                const autoCashOut = MinMultiplierValue;
                const multiplier = autoCashOut + 0.1;
                const betQueuePushMock = jest.fn();
                addMillisecond.mockReturnValueOnce(mockReceivedTime);

                const expectedPayload = {
                    roundId: gameData.roundId,
                    receivedTime: mockReceivedTime,
                    action: Actions.CashOut,
                };
                const realPlayer = {
                    UID,
                    socketClient: {
                        connected: true,
                    },
                };

                gameData.ingame = {
                    [playerName]: {
                        UID,
                        betTracks: {
                            [Actions.Bet]: {
                                autoCashOut,
                            },
                        },
                        betQueue: {
                            push: betQueuePushMock,
                        },
                    },
                };
                gameData.realPlayers[chance.guid()] = realPlayer;

                // Act
                cron.proceedAutoCashOut(multiplier);

                // Assert
                expect(betQueuePushMock).toBeCalledWith({ player: realPlayer, payload: expectedPayload });
            });
        });
    });
});
