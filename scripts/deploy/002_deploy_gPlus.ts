import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONTRACTS } from "../constants";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const sPlusDeployment = await deployments.get(CONTRACTS.sPlus);

    await deploy(CONTRACTS.gPlus, {
        from: deployer,
        args: [sPlusDeployment.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
};

func.tags = [CONTRACTS.gPlus, "migration", "tokens"];
func.dependencies = [CONTRACTS.migrator];

export default func;
