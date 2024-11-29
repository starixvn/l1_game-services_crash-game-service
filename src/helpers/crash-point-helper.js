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

function calculateNextTapMultiplier(current, stageConfigs) {
    const { stages } = stageConfigs;

    const currentStage = stages.find((stage) => current >= stage.minMultiplier && current <= stage.maxMultiplier);

    if (!currentStage) {
        return current;
    }

    const nextMultiplier = roundFloat(current + currentStage.increment);
    return Math.min(nextMultiplier, currentStage.maxMultiplier);
}

function getInitialTapMultiplier(stageConfigs) {
    return stageConfigs.initialMultiplier;
}

export { calculateMultiplier, calculateCrashTimeInMillisecond, calculateNextTapMultiplier, getInitialTapMultiplier };
