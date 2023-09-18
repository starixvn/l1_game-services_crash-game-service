const CrashTimeSeed = 4;

function calculateMultiplier(timeInMilliseconds) {
    return (timeInMilliseconds / 1000) ** 2 / CrashTimeSeed ** 2 + 1;
}

function calculateCrashTimeInMillisecond(crashPoint) {
    return CrashTimeSeed * Math.sqrt(crashPoint - 1) * 1000;
}

export { calculateMultiplier, calculateCrashTimeInMillisecond };
