import { roundFloat } from "./number-helper";

const CrashTimeSeed = 6;

function calculateMultiplier(timeInMilliseconds) {
    const multiplier = (timeInMilliseconds / 1000) ** 2 / 2 ** CrashTimeSeed + 1;

    return roundFloat(multiplier);
}

function calculateCrashTimeInMillisecond(crashPoint) {
    return Math.sqrt(2 ** CrashTimeSeed * (crashPoint - 1)) * 1000;
}

export { calculateMultiplier, calculateCrashTimeInMillisecond };
