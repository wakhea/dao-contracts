import { PlutusERC20Token__factory } from "../types";
import { CONTRACTS, INITIAL_MINT } from "./constants";
import { waitFor } from "./txHelper";

const hre = require("hardhat");

async function main() {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deploy } = deployments;
    const { deployer, wallet } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

const authorityDeployment = await deploy(CONTRACTS.authority, {
        from: deployer,
        args: [deployer, deployer, deployer, deployer],
        log: true,
        skipIfAlreadyDeployed: true,
    });
    console.log("Authority deployed at: " + authorityDeployment.address);


    /*const plusDeployment = await deploy(CONTRACTS.plus, {
        from: deployer,
        args: [authorityDeployment.address],
        log: true,
        skipIfAlreadyDeployed: true,
    });
    console.log("PLUS token deployed at: " + plusDeployment.address);
*/
    let openTime = Date.now();
    openTime = (openTime - (openTime % 1000)) / 1000 + 100;
    // 1641958128
    const presaleDeployment = await deploy(CONTRACTS.presale, {
        from: deployer,
        args: [
            2,
            10000000000,
            wallet,
            "0x1D7f64e2Fb2Be8c1eac6914f49Ca4E897F5d7539",
            "0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee",
            openTime,
            1643583940,
            "10000000000000000000",
            "2000000000000000000",
        ],
        log: true,
        skipIfAlreadyDeployed: false,
    });
    console.log("Presale deployed at: " + presaleDeployment.address);


    const plus = PlutusERC20Token__factory.connect("0x1D7f64e2Fb2Be8c1eac6914f49Ca4E897F5d7539", signer);

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
