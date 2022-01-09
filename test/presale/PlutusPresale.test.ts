import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { FakeContract, smock } from "@defi-wonderland/smock";

import {
    PlutusERC20Token,
    PlutusERC20Token__factory,
    PlutusAuthority__factory,
    PlutusPresale__factory,
    IPLUS,
    PlutusPresale
} from "../../types";

describe.only("PresaleTest", () => {
    const START_DATE = 1893499200;
    const END_DATE = 1896177600;

    let deployer: SignerWithAddress;
    let bob: SignerWithAddress;
    let alice: SignerWithAddress;
    let plusFake: FakeContract<IPLUS>;
    let presale: PlutusPresale;

    beforeEach(async () => {
        [deployer, bob, alice] = await ethers.getSigners();

        const authority = await new PlutusAuthority__factory(deployer).deploy(
            deployer.address,
            deployer.address,
            deployer.address,
            deployer.address
        );
        await authority.deployed();

        plusFake = await smock.fake<IPLUS>("IPLUS");
    });

    describe("constructor", () => {
        it("can be constructed", async () => {
            presale = await new PlutusPresale__factory(deployer).deploy(
                100000,
                deployer.address,
                plusFake.address,
                START_DATE,
                END_DATE,
                10000000000000,
                1000000000000
            );

            expect(await presale._token()).to.equal(plusFake.address);
        })
    })
});
