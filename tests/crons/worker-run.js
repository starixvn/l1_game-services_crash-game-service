import { Worker, parentPort, isMainThread, workerData } from "worker_threads";
import { calculateMultiplier, calculateCrashTimeInMillisecond } from "./../../src/helpers/crash-point-helper";
import { fileURLToPath } from "url";
import { generateResult } from "../../src/helpers/result-helper";

if (isMainThread) {
    const __filename = fileURLToPath(import.meta.url);
    //TODO generate results and livetime here, then push data to worker
    const result = generateResult(1, 3, 2000);
    const maxTimer = calculateCrashTimeInMillisecond(result);
    const multipliers = [];
    const duration = 100;

    for (let timer = 100; timer < maxTimer; timer += duration) {
        const m = calculateMultiplier(timer);
        multipliers.push({ multiplier: m, liveTime: timer });
    }

    const worker = new Worker(__filename, { workerData: { multipliers, duration } });

    worker.on("error", console.log);
    worker.on("exit", (err) => {
        console.log(`Worker Exit, errCode ${err}`);
    });
} else {
    console.log(`Worker running....`);

    const { multipliers, duration } = workerData;
    const id = setInterval(() => {
        if (multipliers.length > 0) {
            const data = multipliers.shift();
            console.log(`Inside of Worker: LiveTime ${data.liveTime} - Multiplier ${data.multiplier}`);
        } else {
            clearInterval(id);
        }
    }, duration);
}
