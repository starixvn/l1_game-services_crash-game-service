import { roundFloat } from "./number-helper";

const CrashTimeSeed = 4;

function calculateMultiplier(timeInMilliseconds) {
    const multiplier = (timeInMilliseconds / 1000) ** 2 / CrashTimeSeed ** 2 + 1;

    return roundFloat(multiplier);
}

function calculateCrashTimeInMillisecond(crashPoint) {
    return CrashTimeSeed * Math.sqrt(crashPoint - 1) * 1000;
}

export { calculateMultiplier, calculateCrashTimeInMillisecond };
