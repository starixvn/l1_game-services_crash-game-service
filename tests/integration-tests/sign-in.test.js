import { GameClientDriver, normalUser } from "sc-game-service-integration-utils";
import { socketOptions } from "./stubs/test-data";
import { initUserSession } from "./helpers";

describe("event signin", () => {
    it("should receive signed in response", async () => {
        const normalUserClientDriver = new GameClientDriver(socketOptions, initUserSession(normalUser));
        // Assert
        await normalUserClientDriver.handleSignedInEvent();
        normalUserClientDriver.close();
    });
});
