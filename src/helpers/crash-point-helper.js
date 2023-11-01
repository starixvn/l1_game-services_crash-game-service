import { roundFloat } from "./number-helper";

const CrashTimeSeed = 10;

function calculateMultiplier(timeInMilliseconds) {
    const multiplier = (timeInMilliseconds / 1000) ** 3 / 2 ** CrashTimeSeed + 1;

    return roundFloat(multiplier);
}

function calculateCrashTimeInMillisecond(crashPoint) {
    return Math.cbrt(2 ** CrashTimeSeed * (crashPoint - 1)) * 1000;
}

export { calculateMultiplier, calculateCrashTimeInMillisecond };
