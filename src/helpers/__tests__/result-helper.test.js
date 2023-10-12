import { Chance } from "chance";
import { generateRawResultForHash, generateResult } from "../result-helper";

const chanceMock = { pickoneIndex: 0, boolVal: false };

jest.mock("chance", () => {
    return function () {
        const orig = {
            ...jest.requireActual("chance"),
        };

        return {
            natural: (opt) => {
                return new orig.Chance().natural(opt);
            },
            integer: (opt) => {
                return new orig.Chance().integer(opt);
            },
            bool: (opt) => chanceMock.boolVal,
            pickone: (arr) => arr[chanceMock.pickoneIndex],
        };
    };
});

describe("resultHelper", () => {
    describe("generateResult", () => {
        const testCases = [
            { randomMode: undefined, pickoneIndex: 0 },
            { randomMode: 1, pickoneIndex: 1 },
            { randomMode: 1, pickoneIndex: 2 },
            { randomMode: 1, pickoneIndex: 3 },
            { randomMode: 1, pickoneIndex: 4 },
            { randomMode: 2, pickoneIndex: 0 },
            { randomMode: 2, pickoneIndex: 1 },
            { randomMode: 2, pickoneIndex: 2 },
            { randomMode: 3, pickoneIndex: 0 },
            { randomMode: 3, pickoneIndex: 1 },
        ];

        it.each(testCases)("return correct number", (testCase) => {
            // Arrange
            chanceMock.pickoneIndex = testCase.pickoneIndex;
            chanceMock.boolVal = false;

            // Act
            const result = generateResult(testCase.randomMode);

            // Assert
            expect(result).toBeGreaterThanOrEqual(1);
        });

        it("should return 1 when meet crashAtBase", () => {
            // Arrange
            chanceMock.boolVal = true;

            // Act
            const result = generateResult();

            // Assert
            expect(result).toBe(1);
        });
    });

    describe("generateRawResultForHash", () => {
        it("should return result at format {result}", () => {
            // Arrange
            const result = 1.23;

            // Act
            const actualResult = generateRawResultForHash(result);

            // Assert
            expect(actualResult).toBe(`{${result}}`);
        });
    });
});
