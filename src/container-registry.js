import awilix from "awilix";
import { Table } from "sc-game-base";
import { PFHistoryQuery, PFRoundQuery, PFRoundResultConsumer, PFRoundResultPublisher } from "sc-provably-fair";
import {
    CashOutConsumer,
    InGameConsumer,
    PlaceBetConsumer,
    RefundBetConsumer,
    SettleCashOutConsumer,
    SettleGameRoundConsumer,
} from "./consumers";
import { LiveGameCrons } from "./crons";
import Bot from "./crons/bot";
import GameCrons from "./crons/game-crons";
import ProcessBetQueue from "./crons/process-bet-queue";
import { LiveGamePublisher, PlaceBetPublisher, UserBetResultPublisher } from "./event-publishers";
import { BetLogs, Bets, Results, Rounds, tempBetLogs, tempBets, umInfo } from "./models";
import liveGameLogs from "./models/live-game-logs";
import { HttpRouter, SocketRouter } from "./routers";
import UmInfoWatcher from "./watchers/um-info-watcher";
import { ProvablyFairConsumer } from "sc-provably-fair";

const { asClass, asValue } = awilix;

export default class ContainerRegistry extends Table.TableContainerRegistry {
    register(appConfigs, definition, gameData) {
        super.register(appConfigs, definition, gameData);
        this.registerWatchers();

        return this.container;
    }

    registerWatchers() {
        this.container.register({
            umInfoWatcher: asClass(UmInfoWatcher).singleton(),
        });
    }

    registerModels() {
        const definition = this.container.resolve("definition");
        super.registerModels();

        this.container.register({
            roundsRepository: asValue(Rounds(definition.configName)),
            betsRepository: asValue(Bets(definition.configName)),
            resultsRepository: asValue(Results(definition.configName)),
            betLogsRepository: asValue(BetLogs(definition.configName)),
            tempBetsRepository: asValue(tempBets(definition.configName)),
            tempBetLogsRepository: asValue(tempBetLogs(definition.configName)),
            liveGameLogsRepository: asValue(liveGameLogs(definition.configName)),
            umInfoRepository: asValue(umInfo()),
        });
    }

    registerConsumers() {
        super.registerConsumers();

        this.container.register({
            inGameConsumer: asClass(InGameConsumer).singleton(),
            placeBetConsumer: asClass(PlaceBetConsumer).singleton(),
            cashOutConsumer: asClass(CashOutConsumer).singleton(),
            roundResultConsumer: asClass(PFRoundResultConsumer).singleton(),
            settleGameRoundConsumer: asClass(SettleGameRoundConsumer).singleton().proxy(),
            settleCashOutConsumer: asClass(SettleCashOutConsumer).singleton(),
            refundBetConsumer: asClass(RefundBetConsumer).singleton().proxy(),
            provablyFairConsumer: asClass(ProvablyFairConsumer).singleton().proxy(),
        });
    }

    registerPublishers() {
        super.registerPublishers();

        this.container.register({
            liveGamePublisher: asClass(LiveGamePublisher).singleton(),
            placeBetPublisher: asClass(PlaceBetPublisher).singleton(),
            roundResultPublisher: asClass(PFRoundResultPublisher).singleton(),
            userBetResultPublisher: asClass(UserBetResultPublisher).singleton(),
        });
    }

    registerCrons() {
        super.registerCrons();

        this.container.register({
            gameCron: asClass(GameCrons).singleton().proxy(),
            liveGameCrons: asClass(LiveGameCrons).singleton().proxy(),
            processBetQueue: asClass(ProcessBetQueue).singleton().proxy(),
            bot: asClass(Bot).singleton(),
        });
    }

    registerApis() {
        super.registerApis();

        this.container.register({
            roundQuery: asClass(PFRoundQuery).singleton(),
            historyQuery: asClass(PFHistoryQuery).singleton(),
        });
    }

    registerRouters() {
        super.registerRouters();

        this.container.register({
            socketRouter: asClass(SocketRouter).proxy(),
            httpRouter: asClass(HttpRouter),
        });
    }
}
