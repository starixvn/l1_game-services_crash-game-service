import { GameClientDriver, normalUser } from "sc-game-service-integration-utils";
import { initUserSession } from "./helpers";
import { socketOptions } from "./stubs/test-data";

describe("ProvablyPair", () => {
    let userClientDriver;

    afterAll(() => {
        userClientDriver.close();
    });

    beforeAll(async () => {
        userClientDriver = new GameClientDriver(socketOptions, initUserSession(normalUser));
        await userClientDriver.handleSignedInEvent();
        userClientDriver.sendInGameEvent();
    });

    describe("when get ingame data", () => {
        it("should receive pf info in round history ", async () => {
            //Act
            userClientDriver.sendInGameEvent();
            const { roundHistory } = await userClientDriver.handleGameEvent((ingameData) => ingameData.roundHistory);

            // Assert
            expect(roundHistory.some((round) => !round.pf)).toBeFalse();
        });
    });

    describe("when start placeBet", () => {
        it("should receive pf server seed hash ", async () => {
            //Act
            const { pf } = await userClientDriver.handleGameEvent((data) => data.pf);

            // Assert
            expect(pf.roundId).not.toBeEmpty();
            expect(pf.serverSeedHash).not.toBeEmpty();
        });
    });

    describe("when finish", () => {
        it("should receive pf info", async () => {
            //Act
            const { finish } = await userClientDriver.handleGameEvent((data) => data.finish);

            // Assert
            expect(finish.pf.finalHash).not.toBeEmpty();
            expect(finish.pf.mergeSeed).not.toBeEmpty();
            expect(finish.pf.result).not.toBeEmpty();
            expect(finish.pf.roundId).not.toBeEmpty();
            expect(finish.pf.clientSeeds).toBeDefined();
        });
    });
});
