import getSSOToken from "./sso-handler";
import { authorize } from "./authorize-handler.js";
import { joinGame, placeBet } from "./socket-handler";
import { randomInt } from "../helpers/random";
import config from "../config";

const autoPlaceBet = (socket, gameInfo) => {
    const { betAmount, userBetEvent } = config.testConfig;
    const { betChoices } = config.gameInfo;

    for (let i = 0; i < userBetEvent; i++) {
        const betChoice = betChoices[randomInt(0, betChoices.length - 1)];

        placeBet(socket, { amount: betAmount, betChoice }, gameInfo);
    }
};

export default async function (playerId, gameInfo) {
    try {
        const ssoToken = await getSSOToken(playerId);
        const authorizeInfo = await authorize(ssoToken);

        const socket = await joinGame(gameInfo, authorizeInfo);

        socket && autoPlaceBet(socket, gameInfo);
    } catch (e) {
        console.log(e);
    }
}
