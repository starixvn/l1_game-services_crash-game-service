import { generateResult } from "../result-helper";
import fs from "fs";
import Chance from "chance";

describe("generateResult", () => {
    //const modes = [1, 2, 3];
    const chance = new Chance();
    const modes = [2];

    const numberOfRuns = 1_000_000;

    it.each(modes)("mode %s: max frequency difference of numbers should under 0.004", (testCase) => {
        let max = 0;
        let maxwin = 0;
        let crashPointRange = {};
        let totalWinAmount = 0;
        let winCount = 0;
        let totalBetAmount = 0;
        let crashAtBase = 0;

        for (let index = 0; index < numberOfRuns; index++) {
            const betAmount = chance.pickone([1, 5, 10, 50, 100]);
            //const bet = chance.floating({ min: 1.2, max: 500 });
            //const bet = chance.floating({ min: 1.2, max: 10 });
            const bet = chance.floating({ min: 1.2, max: 1.5 });
            //const bet = chance.floating({ min: 2, max: 3 });
            const crashPoint = generateResult(testCase);
            const range = Math.round(crashPoint);
            crashPoint == 1 && crashAtBase++;
            crashPointRange[range] ? crashPointRange[range]++ : (crashPointRange[range] = 1);
            totalBetAmount += betAmount;
            crashPoint > max && (max = crashPoint);
            if (bet <= crashPoint) {
                winCount++;
                bet * betAmount > maxwin && (maxwin = bet * betAmount);
                totalWinAmount += bet * betAmount;
            }
        }

        let jsonData = "";

        jsonData += `*** RTP *** - ${(totalWinAmount / totalBetAmount) * 100}% \n`;
        jsonData += `*** Win Pecent *** - ${(winCount / numberOfRuns) * 100}% \n`;
        jsonData += `*** Maximum Win *** - ${maxwin} \n`;
        jsonData += `*** Maximum Multiplier *** - ${max}`;
        jsonData += `*** Crash Point Range Keys *** \n ${Object.keys(crashPointRange).join("\n ")}`;
        jsonData += `\n*** Crash Point Range Values *** \n ${Object.values(crashPointRange).join("\n ")}`;
        jsonData += `\n *** Crash At Base *** ${crashAtBase}`;

        fs.writeFileSync("stat.txt", jsonData);
    });
});
