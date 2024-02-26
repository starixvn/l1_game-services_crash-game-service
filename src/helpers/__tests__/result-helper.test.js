import Chance from "chance";
import { generateRawResultForHash, generateResult } from "../result-helper";

describe("resultHelper", () => {
    const chance = new Chance();

    describe("generateResult", () => {
        const hexValue = chance.hash();

        it("should return correct number", () => {
            // Act
            const result = generateResult(hexValue);

            // Assert
            expect(result).toBeGreaterThanOrEqual(1);
        });
    });

    describe("generateRawResultForHash", () => {
        it("should return result at format {result}", () => {
            // Arrange
            const result = 1.23;

            // Act
            const actualResult = generateRawResultForHash(result);

            // Assert
            expect(actualResult).toBe(result);
        });
    });
});
