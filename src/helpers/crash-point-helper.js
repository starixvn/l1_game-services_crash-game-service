import { roundFloat } from "./number-helper";

const nthPower = 5;

const a = 0.04,
    b = 0.66,
    c = 1 - b ** 5;

function calculateMultiplier(timeInMilliseconds) {
    const multiplier = (a * (timeInMilliseconds / 1000) + b) ** nthPower + c;

    return roundFloat(multiplier);
}

function calculateCrashTimeInMillisecond(crashPoint) {
    return (1000 * ((crashPoint - c) ** (1 / nthPower) - b)) / a;
}

function findStage(multiplier, stages) {
    return stages.find((stage) => multiplier >= stage.minMultiplier && multiplier <= stage.maxMultiplier);
}

function calculateIncrement(multiplier, stageConfigs) {
    const { stages } = stageConfigs;

    if (stages.length === 0) {
        return 0;
    }

    const currentStage = findStage(multiplier, stages);

    return currentStage ? currentStage.increment : stages[stages.length - 1].increment;
}

function calculateNextTapMultiplier(current, stageConfigs) {
    const { stages } = stageConfigs;
    const currentStage = findStage(current, stages);

    const increment = calculateIncrement(current, stageConfigs);
    const nextMultiplier = roundFloat(current + increment);

    return currentStage ? Math.min(nextMultiplier, currentStage.maxMultiplier) : nextMultiplier;
}

function getInitialTapMultiplier(stageConfigs) {
    return stageConfigs.initialMultiplier;
}

function generateTapResult(result) {
    return result > 1.0;
}

export {
    calculateMultiplier,
    calculateCrashTimeInMillisecond,
    calculateNextTapMultiplier,
    getInitialTapMultiplier,
    generateTapResult,
    calculateIncrement,
    findStage,
};
