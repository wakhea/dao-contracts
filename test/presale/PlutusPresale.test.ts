import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
const advancement = require("../utils/advancement.js");

import {
    PlutusERC20Token,
    PlutusERC20Token__factory,
    PlutusAuthority__factory,
    PlutusPresale__factory,
    PlutusPresale
} from "../../types";

describe.only("PresaleTest", () => {
    const START_DATE = 1893499200;
    const END_DATE = 1896177600;
    const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");

    let deployer: SignerWithAddress;
    let bob: SignerWithAddress;
    let alice: SignerWithAddress;
    let plus: PlutusERC20Token;
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

        plus = await new PlutusERC20Token__factory(deployer).deploy(authority.address);
    });

    xdescribe("constructor", () => {
        it("can be constructed", async () => {
            presale = await new PlutusPresale__factory(deployer).deploy(
                100000,
                deployer.address,
                plus.address,
                START_DATE,
                END_DATE,
                10000000000000,
                1000000000000
            );

            expect(await presale._token()).to.equal(plus.address);
        });
    });

    xdescribe("Crowdsale", async () => {
        it("should allow a token buy", async () => {
            presale = await new PlutusPresale__factory(deployer).deploy(
                100000,
                deployer.address,
                plus.address,
                START_DATE,
                END_DATE,
                10000000000000,
                1000000000000
            );
            await plus.connect(deployer).mint(presale.address, 1000000000000);

            advancement.increaseTo(1894305511);

            await presale.connect(alice).buyTokens(alice.address, { value: 1000 });
            expect(await presale._weiRaised()).to.equal(1000);
        });
    });

    describe("TimedCrowdsale", async () => {
        it("shouldn't allow buy before open time", async () => {
            presale = await new PlutusPresale__factory(deployer).deploy(
                100000,
                deployer.address,
                plus.address,
                START_DATE,
                END_DATE,
                10000000000000,
                1000000000000
            );

            expect(await presale.isOpen()).to.be.false;
            await expect(presale.connect(alice).buyTokens(alice.address)).to.be.revertedWith(
                "TimedCrowdsale: not open"
            );
        });

        it("should allow buy during open time", async () => {
            presale = await new PlutusPresale__factory(deployer).deploy(
                100000,
                deployer.address,
                plus.address,
                START_DATE,
                END_DATE,
                10000000000000,
                1000000000000
            );

            advancement.increaseTo((START_DATE + END_DATE) / 2);
            await plus.connect(deployer).mint(presale.address, 1000000000000);

            expect(await presale.isOpen()).to.be.true;

            await presale.connect(alice).buyTokens(alice.address, { value: 1000 });
            expect(await presale._weiRaised()).to.equal(1000);
        });

        it("shouldn't allow buy after open time", async () => {
            presale = await new PlutusPresale__factory(deployer).deploy(
                100000,
                deployer.address,
                plus.address,
                END_DATE,
                END_DATE + 1000,
                10000000000000,
                1000000000000
            );

            advancement.increaseTo(END_DATE + 1500);

            expect(await presale.isOpen()).to.be.false;
            await expect(
                presale.connect(alice).buyTokens(alice.address, { value: 1000 })
            ).to.be.revertedWith("TimedCrowdsale: not open");
        });
    });
});
