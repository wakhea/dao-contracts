import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { waitFor } from "../txHelper";
import { CONTRACTS, INITIAL_REWARD_RATE, INITIAL_INDEX, BOUNTY_AMOUNT } from "../constants";
import {
    PlutusAuthority__factory,
    Distributor__factory,
    PlutusERC20Token__factory,
    PlutusStaking__factory,
    SPlutus__factory,
    GPLUS__factory,
    PlutusTreasury__factory,
} from "../../types";

// TODO: Shouldn't run setup methods if the contracts weren't redeployed.
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, ethers } = hre;
    const { deployer } = await getNamedAccounts();
    const signer = await ethers.provider.getSigner(deployer);

    const authorityDeployment = await deployments.get(CONTRACTS.authority);
    const plusDeployment = await deployments.get(CONTRACTS.plus);
    const sPlusDeployment = await deployments.get(CONTRACTS.sPlus);
    const gPlusDeployment = await deployments.get(CONTRACTS.gPlus);
    const distributorDeployment = await deployments.get(CONTRACTS.distributor);
    const treasuryDeployment = await deployments.get(CONTRACTS.treasury);
    const stakingDeployment = await deployments.get(CONTRACTS.staking);

    const authorityContract = await PlutusAuthority__factory.connect(
        authorityDeployment.address,
        signer
    );
    const plus = PlutusERC20Token__factory.connect(plusDeployment.address, signer);
    const sPlus = SPlutus__factory.connect(sPlusDeployment.address, signer);
    const gPlus = GPLUS__factory.connect(gPlusDeployment.address, signer);
    const distributor = Distributor__factory.connect(distributorDeployment.address, signer);
    const staking = PlutusStaking__factory.connect(stakingDeployment.address, signer);
    const treasury = PlutusTreasury__factory.connect(treasuryDeployment.address, signer);

    // Step 1: Set treasury as vault on authority
    await waitFor(authorityContract.pushVault(treasury.address, true));
    console.log("Setup -- authorityContract.pushVault: set vault on authority");

    // Step 2: Set distributor as minter on treasury
    await waitFor(treasury.enable(8, distributor.address, ethers.constants.AddressZero)); // Allows distributor to mint plus.
    console.log("Setup -- treasury.enable(8):  distributor enabled to mint plus on treasury");

    // Step 3: Set distributor on staking
    await waitFor(staking.setDistributor(distributor.address));
    console.log("Setup -- staking.setDistributor:  distributor set on staking");

    // Step 4: Initialize sPLUS and set the index
    if ((await sPlus.gPLUS()) == ethers.constants.AddressZero) {
        await waitFor(sPlus.setIndex(INITIAL_INDEX)); // TODO
        await waitFor(sPlus.setgPLUS(gPlus.address));
        await waitFor(sPlus.initialize(staking.address, treasuryDeployment.address));
    }
    console.log("Setup -- splus initialized (index, gplus)");

    // Step 5: Set up distributor with bounty and recipient
    await waitFor(distributor.setBounty(BOUNTY_AMOUNT));
    await waitFor(distributor.addRecipient(staking.address, INITIAL_REWARD_RATE));
    console.log("Setup -- distributor.setBounty && distributor.addRecipient");

    // Approve staking contact to spend deployer's PLUS
    // TODO: Is this needed?
    // await plus.approve(staking.address, LARGE_APPROVAL);
};

func.tags = ["setup"];
func.dependencies = [CONTRACTS.plus, CONTRACTS.sPlus, CONTRACTS.gPlus];

export default func;
