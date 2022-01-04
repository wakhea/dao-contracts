import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    CONTRACTS,
    EPOCH_LENGTH_IN_BLOCKS,
    FIRST_EPOCH_TIME,
    FIRST_EPOCH_NUMBER,
} from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const plusDeployment = await deployments.get(CONTRACTS.plus);
    const sPlusDeployment = await deployments.get(CONTRACTS.sPlus);
    const gPlusDeployment = await deployments.get(CONTRACTS.gPlus);

    await deploy(CONTRACTS.staking, {
        from: deployer,
        args: [
            plusDeployment.address,
            sPlusDeployment.address,
            gPlusDeployment.address,
            EPOCH_LENGTH_IN_BLOCKS,
            FIRST_EPOCH_NUMBER,
            FIRST_EPOCH_TIME,
            authorityDeployment.address,
        ],
        log: true,
    });
};

func.tags = [CONTRACTS.staking, "staking"];
func.dependencies = [CONTRACTS.plus, CONTRACTS.sPlus, CONTRACTS.gPlus];

export default func;
