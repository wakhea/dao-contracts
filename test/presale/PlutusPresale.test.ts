import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import BN from "bn.js";
import { expect } from "chai";
import { ethers } from "hardhat";
import { INITIAL_MINT } from "../../scripts/constants";

const time = require("../utils/advancement.js");

import {
    PlutusERC20Token,
    PlutusERC20Token__factory,
    PlutusAuthority__factory,
    PlutusPresale__factory,
    PlutusPresale,
} from "../../types";

describe("PresaleTest", () => {
    const LARGE_APPROVAL = "100000000000000000000000000000000";
    const START_DATE = 1893499200;
    const END_DATE = 1896177600;

    let deployer: SignerWithAddress;
    let bob: SignerWithAddress;
    let alice: SignerWithAddress;
    let plus: PlutusERC20Token;
    let busd: any;
    let presale: PlutusPresale;

    let openingTime: BN;
    let closingTime: BN;

    beforeEach(async () => {
        [deployer, bob, alice] = await ethers.getSigners();

        const authority = await new PlutusAuthority__factory(deployer).deploy(
            deployer.address,
            deployer.address,
            deployer.address,
            deployer.address
        );
        await authority.deployed();

        // Using DAI since factory already exists
        let busdFactory = await ethers.getContractFactory("DAI");

        busd = await busdFactory.deploy(0);
        await busd.mint(deployer.address, INITIAL_MINT);
        await busd.mint(alice.address, INITIAL_MINT);
        await busd.mint(bob.address, INITIAL_MINT);

        plus = await new PlutusERC20Token__factory(deployer).deploy(authority.address);
    });

    describe("constructor", () => {
        it("can be constructed", async () => {
            presale = await new PlutusPresale__factory(deployer).deploy(
                100000,
                1,
                deployer.address,
                plus.address,
                busd.address,
                START_DATE,
                END_DATE,
                10000000000000,
                1000000000000,
                345600
            );

            expect(await presale.token()).to.equal(plus.address);
        });
    });

    describe("Crowdsale", async () => {
        it("should allow a token buy", async () => {
            openingTime = (await time.latest()).add(time.duration.weeks(1));
            closingTime = openingTime.add(time.duration.weeks(1));

            presale = await new PlutusPresale__factory(deployer).deploy(
                96,
                1000000000,
                deployer.address,
                plus.address,
                busd.address,
                await openingTime.toNumber(),
                await closingTime.toNumber(),
                100000000000000,
                100000000000000,
                345600
            );

            await busd.connect(alice).approve(presale.address, LARGE_APPROVAL);

            await plus.connect(deployer).mint(presale.address, 1000000000000);

            time.increase(time.duration.days(10));

            let amount = 100000000000000;

            let oldBalance = await busd.balanceOf(alice.address);
            await presale.connect(alice).buyTokens(amount, alice.address);
            expect(await presale.weiRaised()).to.equal(amount);

            let newBalance = await busd.balanceOf(alice.address);
            expect(oldBalance.sub(newBalance).toNumber()).to.equal(amount);
        });
    });

    describe("TimedCrowdsale", async () => {
        beforeEach(async () => {
            openingTime = (await time.latest()).add(time.duration.weeks(1));
            closingTime = openingTime.add(time.duration.weeks(1));

            presale = await new PlutusPresale__factory(deployer).deploy(
                100000,
                1,
                deployer.address,
                plus.address,
                busd.address,
                await openingTime.toNumber(),
                await closingTime.toNumber(),
                10000000000000,
                1000000000000,
                345600
            );
        });

        it("shouldn't allow buy before open time", async () => {
            expect(await presale.isOpen()).to.be.false;
            await expect(presale.connect(alice).buyTokens(10, alice.address)).to.be.revertedWith(
                "TimedCrowdsale: not open"
            );
        });

        it("should allow buy during open time", async () => {
            time.increase(time.duration.days(10));
            await plus.connect(deployer).mint(presale.address, 1000000000000);

            expect(await presale.isOpen()).to.be.true;

            await busd.connect(alice).approve(presale.address, 1000);

            await presale.connect(alice).buyTokens(1000, alice.address);
            expect(await presale.weiRaised()).to.equal(1000);
        });

        it("shouldn't allow buy after open time", async () => {
            time.increase(time.duration.weeks(3));

            expect(await presale.isOpen()).to.be.false;
            await expect(presale.connect(alice).buyTokens(1000, alice.address)).to.be.revertedWith(
                "TimedCrowdsale: not open"
            );
        });

        it("should not allow time extension if not owner", async () => {
            await expect(presale.connect(alice).extendTime(150)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("should allow time extension if owner", async () => {
            let newClosingTime = closingTime.add(time.duration.weeks(3));
            
            await plus.connect(deployer).mint(presale.address, 1000000000000);
            await busd.connect(alice).approve(presale.address, 1000);

            await presale.connect(deployer).extendTime(await newClosingTime.toNumber());
            time.increase(time.duration.weeks(3));

            await presale.connect(alice).buyTokens(1000, alice.address);
            expect(await presale.weiRaised()).to.equal(1000);
            expect(await presale.hasClosed()).to.be.false;
        });
    });

    describe("Capped crowdsale", async () => {
        beforeEach(async () => {
            openingTime = (await time.latest()).add(time.duration.weeks(1));
            closingTime = openingTime.add(time.duration.weeks(1));

            presale = await new PlutusPresale__factory(deployer).deploy(
                100000,
                1,
                deployer.address,
                plus.address,
                busd.address,
                await openingTime.toNumber(),
                await closingTime.toNumber(),
                1000,
                10000, 
                345600
            );
            time.increase(time.duration.days(10));

            await plus.connect(deployer).mint(presale.address, 1000000000000);
        });

        it("should allow buy if under cap", async () => {
            // Check if open
            expect(await presale.isOpen()).to.be.true;

            await busd.connect(alice).approve(presale.address, 100);
            await busd.connect(bob).approve(presale.address, 100);

            await presale.connect(alice).buyTokens(100, alice.address);
            expect(await presale.weiRaised()).to.equal(100);

            await presale.connect(bob).buyTokens(100, bob.address);
            expect(await presale.weiRaised()).to.equal(200);
        });

        it("shouldn't allow buy if more than cap", async () => {
            expect(await presale.isOpen()).to.be.true;

            await expect(presale.connect(alice).buyTokens(1001, alice.address)).to.be.revertedWith(
                "CappedCrowdsale: cap exceeded"
            );
        });

        it("shouldn't allow buy if cap reached", async () => {
            expect(await presale.isOpen()).to.be.true;

            await busd.connect(alice).approve(presale.address, 900);

            await presale.connect(alice).buyTokens(900, alice.address);
            expect(await presale.weiRaised()).to.equal(900);

            await expect(presale.connect(alice).buyTokens(1001, alice.address)).to.be.revertedWith(
                "CappedCrowdsale: cap exceeded"
            );
        });

        it("shouldn't allow cap update if not owner", async () => {
            await expect(presale.connect(alice).updateCap(10000)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("should allow buy if cap updated", async () => {
            await expect(presale.connect(alice).buyTokens(2000, alice.address)).to.be.revertedWith(
                "CappedCrowdsale: cap exceeded"
            );

            await busd.connect(alice).approve(presale.address, 2000);

            await presale.connect(deployer).updateCap(2000);
            
            expect(await presale.cap()).to.equal(2000);

            await presale.connect(alice).buyTokens(2000, alice.address);
            expect(await presale.weiRaised()).to.equal(2000);
            expect(await presale.capReached()).to.be.true;
        });
    });

    describe("Individually capped crowdsale", async () => {
        beforeEach(async () => {
            openingTime = (await time.latest()).add(time.duration.weeks(1));
            closingTime = openingTime.add(time.duration.weeks(1));

            presale = await new PlutusPresale__factory(deployer).deploy(
                100000,
                1,
                deployer.address,
                plus.address,
                busd.address,
                await openingTime.toNumber(),
                await closingTime.toNumber(),
                100000000,
                1000,
                345600
            );

            time.increase(time.duration.days(10));
            
            await plus.connect(deployer).mint(presale.address, 1000000000000);
            await busd.connect(alice).approve(presale.address, 2000);
            await busd.connect(bob).approve(presale.address, 2000);
        });

        it("should allow buy if under individual cap", async () => {

            await presale.connect(alice).buyTokens(600, alice.address);
            expect(await presale.weiRaised()).to.equal(600);

            await presale.connect(bob).buyTokens(600, bob.address);
            expect(await presale.weiRaised()).to.equal(1200);

            expect(await (await presale.preBuys(alice.address)).weiAmount).to.equal(600);
            expect(await (await presale.preBuys(bob.address)).weiAmount).to.equal(600);
        });

        it("should not allow buy if individual cap reached", async () => {
            await presale.connect(alice).buyTokens(600, alice.address);
            expect(await presale.weiRaised()).to.equal(600);
            expect(await (await presale.preBuys(alice.address)).weiAmount).to.equal(600);

            await expect(presale.connect(alice).buyTokens(600, alice.address)).to.be.revertedWith(
                "CappedCrowdsale: beneficiary's cap exceeded"
            );
            expect(await presale.weiRaised()).to.equal(600);
            expect(await (await presale.preBuys(alice.address)).weiAmount).to.equal(600);

            await presale.connect(bob).buyTokens(600, bob.address);
            expect(await presale.weiRaised()).to.equal(1200);
        });

        it("should not allow individual cap if not owner", async () => {
            await expect(presale.connect(alice).setIndividualCap(10000)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("should allow owner to update individual cap", async () => {
            await expect(presale.connect(alice).buyTokens(2000, alice.address)).to.be.revertedWith(
                "CappedCrowdsale: beneficiary's cap exceeded"
            );

            await presale.connect(deployer).setIndividualCap(2000);

            expect(await presale.individualCap()).to.equal(2000);

            await presale.connect(alice).buyTokens(2000, alice.address);

            expect(await presale.weiRaised()).to.equal(2000);
            expect(await (await presale.preBuys(alice.address)).weiAmount).to.equal(2000);
        });
    });

    describe("Vesting time crowdsale", async () => {
        beforeEach(async () => {
            openingTime = (await time.latest()).add(time.duration.weeks(1));
            closingTime = openingTime.add(time.duration.weeks(1));

            presale = await new PlutusPresale__factory(deployer).deploy(
                1,
                1,
                deployer.address,
                plus.address,
                busd.address,
                await openingTime.toNumber(),
                await closingTime.toNumber(),
                100000000,
                100000000,
                345600
            );

            time.increase(time.duration.days(10));
            
            await plus.connect(deployer).mint(presale.address, 100000);
            await busd.connect(alice).approve(presale.address, 2000);
            await busd.connect(bob).approve(presale.address, 2000);
        });

        it("should not allow redemption before if presale is open", async() => {
            await expect(presale.connect(alice).redeemPlus(alice.address)).to.be.revertedWith(
                "TimedCrowdsale: not closed"
            );
        });

        it("should not allow to retrieve excess PLUS if presale is closed", async() => {
            await expect(presale.connect(alice).retreiveExcessPlus()).to.be.revertedWith(
                "TimedCrowdsale: not closed"
            );
        })

        it("should not allow to retrieve excess PLUS if not owner", async() => {
            time.increase(time.duration.days(5));

            await expect(presale.connect(alice).retreiveExcessPlus()).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("should redeem Plus after presale closing", async() => {
            // Buy token
            await busd.connect(alice).approve(presale.address, LARGE_APPROVAL);

            let amount = 1000;

            let oldBalance = await busd.balanceOf(alice.address);
            await presale.connect(alice).buyTokens(amount, alice.address);
            expect(await presale.weiRaised()).to.equal(amount);

            let newBalance = await busd.balanceOf(alice.address);
            expect(oldBalance.sub(newBalance).toNumber()).to.equal(amount);

            // 1 day after close
            await time.increase(time.duration.days(5));
            
            expect(await (await presale.getPercentReleased()).toNumber()).to.be.gte(2500000).and.lte(2501000);
            expect(await (await presale.preBuys(alice.address)).plusAmountClaimed).to.equal(0);            
            
            await presale.connect(alice).redeemPlus(alice.address);

            let plusAmountClaimed = (await (await presale.preBuys(alice.address)).plusAmountClaimed);
            expect(await plusAmountClaimed.toNumber()).to.equal(250);
            expect(await plus.balanceOf(alice.address)).to.equal(250);
            
            // After vesting period
            await time.increase(time.duration.days(5));

            await presale.connect(alice).redeemPlus(alice.address);

            plusAmountClaimed = (await (await presale.preBuys(alice.address)).plusAmountClaimed);
            expect(await plus.balanceOf(alice.address)).to.equal(1000);
            expect(await plusAmountClaimed.toNumber()).to.equal(1000);
        });

        it("should allow owner to retreive all the Plus if no sale", async() => {
            await time.increase(time.duration.days(5));

            await presale.connect(deployer).retreiveExcessPlus();

            expect(await (await plus.balanceOf(deployer.address)).toString()).to.eq("100000");
        })

        it("should allow owner to retreive only the unclaimed Plus if token has been sold", async() => {
            // Buy token
            await busd.connect(alice).approve(presale.address, LARGE_APPROVAL);
            await presale.connect(alice).buyTokens(10000, alice.address);

            await time.increase(time.duration.days(5));

            await presale.connect(deployer).retreiveExcessPlus();

            expect(await (await plus.balanceOf(deployer.address)).toString()).to.eq("90000");
        })
    });
});
