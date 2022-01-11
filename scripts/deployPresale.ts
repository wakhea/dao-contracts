import { PlutusERC20Token__factory } from "../types";
import { CONTRACTS, INITIAL_MINT } from "./constants";
import { waitFor } from "./txHelper";

const hre = require("hardhat");

async function main() {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    const authorityDeployment = await deploy(CONTRACTS.authority, {
        from: deployer,
        args: [deployer, deployer, deployer, deployer],
        log: true,
        skipIfAlreadyDeployed: true,
    });
    console.log("Authority deployed at: " + authorityDeployment.address);


    const plusDeployment = await deploy(CONTRACTS.plus, {
        from: deployer,
        args: [authorityDeployment.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
    console.log("PLUS token deployed at: " + plusDeployment.address);

    let openTime = Date.now();
    openTime = (openTime - (openTime % 1000)) / 1000 + 100;

    const presaleDeployment = await deploy(CONTRACTS.presale, {
        from: deployer,
        args: [
            1055,
            deployer,
            plusDeployment.address,
            openTime,
            1643069744,
            1000000000000000,
            1000000000000,
        ],
        log: true,
        skipIfAlreadyDeployed: true,
    });
    console.log("Presale deployed at: " + presaleDeployment.address);


    const plus = PlutusERC20Token__factory.connect(plusDeployment.address, signer);

    await waitFor(plus.mint(presaleDeployment.address, INITIAL_MINT));

    console.log("Setup -- Mint " + INITIAL_MINT + " PLUS tokens to presale contract(" + presaleDeployment.address + ")");
    console.log("Deployment completed !");
}

main()
    .then(() => process.exit())
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
