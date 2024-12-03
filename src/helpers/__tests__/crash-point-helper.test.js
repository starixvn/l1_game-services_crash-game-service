import { findStage, calculateIncrement, calculateNextTapMultiplier } from "../crash-point-helper";

describe("crash-point-helper", () => {
    const mockStageConfigs = {
        initialMultiplier: 1.2,
        stages: [
            { minMultiplier: 1.0, maxMultiplier: 2.0, increment: 0.1 },
            { minMultiplier: 2.0, maxMultiplier: 5.0, increment: 0.2 },
            { minMultiplier: 5.0, maxMultiplier: 10.0, increment: 0.5 },
        ],
    };

    describe("findStage", () => {
        it("should find correct stage for given multiplier", () => {
            expect(findStage(1.5, mockStageConfigs.stages)).toEqual(mockStageConfigs.stages[0]);
            expect(findStage(3.0, mockStageConfigs.stages)).toEqual(mockStageConfigs.stages[1]);
            expect(findStage(7.0, mockStageConfigs.stages)).toEqual(mockStageConfigs.stages[2]);
        });

        it("should return undefined for multiplier outside stages range", () => {
            expect(findStage(0.5, mockStageConfigs.stages)).toBeUndefined();
            expect(findStage(11.0, mockStageConfigs.stages)).toBeUndefined();
        });
    });

    describe("calculateIncrement", () => {
        it("should return correct increment for given multiplier", () => {
            expect(calculateIncrement(1.5, mockStageConfigs)).toBe(0.1);
            expect(calculateIncrement(3.0, mockStageConfigs)).toBe(0.2);
            expect(calculateIncrement(7.0, mockStageConfigs)).toBe(0.5);
        });

        it("should return last stage increment for multiplier above max range", () => {
            expect(calculateIncrement(11.0, mockStageConfigs)).toBe(0.5);
        });

        it("should return 0 when stages array is empty", () => {
            expect(calculateIncrement(1.5, { stages: [] })).toBe(0);
        });
    });

    describe("calculateNextTapMultiplier", () => {
        it("should calculate next multiplier within stage limits", () => {
            expect(calculateNextTapMultiplier(1.5, mockStageConfigs)).toBe(1.6);
            expect(calculateNextTapMultiplier(3.0, mockStageConfigs)).toBe(3.2);
            expect(calculateNextTapMultiplier(7.0, mockStageConfigs)).toBe(7.5);
        });

        it("should not exceed stage max multiplier", () => {
            expect(calculateNextTapMultiplier(1.95, mockStageConfigs)).toBe(2.0);
            expect(calculateNextTapMultiplier(4.9, mockStageConfigs)).toBe(5.0);
            expect(calculateNextTapMultiplier(9.8, mockStageConfigs)).toBe(10.0);
        });

        it("should handle multiplier outside stages range", () => {
            expect(calculateNextTapMultiplier(11.0, mockStageConfigs)).toBe(11.5);
        });
    });
});
