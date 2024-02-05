import { Table } from "sc-game-base";
import MultipleClassesExtender from "sc-provably-fair/src/multiple-classes-extender";
import PFGameData from "sc-provably-fair/src/pf-game-data";
import { MaxCombinedClientSeeds } from "./constants";

export default class GameData extends MultipleClassesExtender.extend(Table.TableGameData, PFGameData) {
    constructor(remainingTime) {
        super([remainingTime], [MaxCombinedClientSeeds]);
        this.betList = {};
    }
}
