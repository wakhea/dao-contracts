import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { FakeContract, smock } from '@defi-wonderland/smock'

import {
  IStaking,
  IERC20,
  IgPLUS,
  PlutusERC20Token,
  PlutusERC20Token__factory,
  SPlutus,
  SPlutus__factory,
  GPLUS,
  PlutusAuthority__factory,
  ITreasury,
} from '../../types';

const TOTAL_GONS = 5000000000000000;
const ZERO_ADDRESS = ethers.utils.getAddress("0x0000000000000000000000000000000000000000");

describe("sPlus", () => {
  let initializer: SignerWithAddress;
  let treasury: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let ohm: PlutusERC20Token;
  let sPlus: SPlutus;
  let gPlusFake: FakeContract<GPLUS>;
  let stakingFake: FakeContract<IStaking>;
  let treasuryFake: FakeContract<ITreasury>;

  beforeEach(async () => {
    [initializer, alice, bob] = await ethers.getSigners();
    stakingFake = await smock.fake<IStaking>('IStaking');
    treasuryFake = await smock.fake<ITreasury>('ITreasury');
    gPlusFake = await smock.fake<GPLUS>('gPLUS');

    const authority = await (new PlutusAuthority__factory(initializer)).deploy(initializer.address, initializer.address, initializer.address, initializer.address);
    ohm = await (new PlutusERC20Token__factory(initializer)).deploy(authority.address);
    sPlus = await (new SPlutus__factory(initializer)).deploy();
  });

  it("is constructed correctly", async () => {
    expect(await sPlus.name()).to.equal("Staked PLUS");
    expect(await sPlus.symbol()).to.equal("sPLUS");
    expect(await sPlus.decimals()).to.equal(9);
  });

  describe("initialization", () => {
    describe("setIndex", () => {
      it("sets the index", async () => {
        await sPlus.connect(initializer).setIndex(3);
        expect(await sPlus.index()).to.equal(3);
      });

      it("must be done by the initializer", async () => {
        await expect(sPlus.connect(alice).setIndex(3)).to.be.reverted;
      });

      it("cannot update the index if already set", async () => {
        await sPlus.connect(initializer).setIndex(3);
        await expect(sPlus.connect(initializer).setIndex(3)).to.be.reverted;
      });
    });

    describe("setgPLUS", () => {
      it("sets gPlusFake", async () => {
        await sPlus.connect(initializer).setgPLUS(gPlusFake.address);
        expect(await sPlus.gPLUS()).to.equal(gPlusFake.address);
      });

      it("must be done by the initializer", async () => {
        await expect(sPlus.connect(alice).setgPLUS(gPlusFake.address)).to.be.reverted;
      });

      it("won't set gPlusFake to 0 address", async () => {
        await expect(sPlus.connect(initializer).setgPLUS(ZERO_ADDRESS)).to.be.reverted;
      });
    });

    describe("initialize", () => {
      it("assigns TOTAL_GONS to the stakingFake contract's balance", async () => {
        await sPlus.connect(initializer).initialize(stakingFake.address, treasuryFake.address);
        expect(await sPlus.balanceOf(stakingFake.address)).to.equal(TOTAL_GONS);
      });

      it("emits Transfer event", async () => {
        await expect(sPlus.connect(initializer).initialize(stakingFake.address, treasuryFake.address)).
          to.emit(sPlus, "Transfer").withArgs(ZERO_ADDRESS, stakingFake.address, TOTAL_GONS);
      });

      it("emits LogStakingContractUpdated event", async () => {
        await expect(sPlus.connect(initializer).initialize(stakingFake.address, treasuryFake.address)).
          to.emit(sPlus, "LogStakingContractUpdated").withArgs(stakingFake.address);
      });

      it("unsets the initializer, so it cannot be called again", async () => {
        await sPlus.connect(initializer).initialize(stakingFake.address, treasuryFake.address);
        await expect(sPlus.connect(initializer).initialize(stakingFake.address, treasuryFake.address)).to.be.reverted;
      });
    });
  });

  describe("post-initialization", () => {
    beforeEach(async () => {
      await sPlus.connect(initializer).setIndex(1);
      await sPlus.connect(initializer).setgPLUS(gPlusFake.address);
      await sPlus.connect(initializer).initialize(stakingFake.address, treasuryFake.address);
    });

    describe("approve", () => {
      it("sets the allowed value between sender and spender", async () => {
        await sPlus.connect(alice).approve(bob.address, 10);
        expect(await sPlus.allowance(alice.address, bob.address)).to.equal(10);
      });

      it("emits an Approval event", async () => {
        await expect(await sPlus.connect(alice).approve(bob.address, 10)).
          to.emit(sPlus, "Approval").withArgs(alice.address, bob.address, 10);
      });
    });

    describe("increaseAllowance", () => {
      it("increases the allowance between sender and spender", async () => {
        await sPlus.connect(alice).approve(bob.address, 10);
        await sPlus.connect(alice).increaseAllowance(bob.address, 4);

        expect(await sPlus.allowance(alice.address, bob.address)).to.equal(14);
      });

      it("emits an Approval event", async () => {
        await sPlus.connect(alice).approve(bob.address, 10);
        await expect(await sPlus.connect(alice).increaseAllowance(bob.address, 4)).
          to.emit(sPlus, "Approval").withArgs(alice.address, bob.address, 14);
      });
    });

    describe("decreaseAllowance", () => {
      it("decreases the allowance between sender and spender", async () => {
        await sPlus.connect(alice).approve(bob.address, 10);
        await sPlus.connect(alice).decreaseAllowance(bob.address, 4);

        expect(await sPlus.allowance(alice.address, bob.address)).to.equal(6);
      });

      it("will not make the value negative", async () => {
        await sPlus.connect(alice).approve(bob.address, 10);
        await sPlus.connect(alice).decreaseAllowance(bob.address, 11);

        expect(await sPlus.allowance(alice.address, bob.address)).to.equal(0);
      });

      it("emits an Approval event", async () => {
        await sPlus.connect(alice).approve(bob.address, 10);
        await expect(await sPlus.connect(alice).decreaseAllowance(bob.address, 4)).
          to.emit(sPlus, "Approval").withArgs(alice.address, bob.address, 6);
      });
    });

    describe("circulatingSupply", () => {
      it("is zero when all owned by stakingFake contract", async () => {
        await stakingFake.supplyInWarmup.returns(0);
        await gPlusFake.totalSupply.returns(0);
        await gPlusFake.balanceFrom.returns(0);

        const totalSupply = await sPlus.circulatingSupply();
        expect(totalSupply).to.equal(0);
      });

      it("includes all supply owned by gPlusFake", async () => {
        await stakingFake.supplyInWarmup.returns(0);
        await gPlusFake.totalSupply.returns(10);
        await gPlusFake.balanceFrom.returns(10);

        const totalSupply = await sPlus.circulatingSupply();
        expect(totalSupply).to.equal(10);
      });


      it("includes all supply in warmup in stakingFake contract", async () => {
        await stakingFake.supplyInWarmup.returns(50);
        await gPlusFake.totalSupply.returns(0);
        await gPlusFake.balanceFrom.returns(0);

        const totalSupply = await sPlus.circulatingSupply();
        expect(totalSupply).to.equal(50);
      });
    });
  });
});