import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  PlutusERC20Token,
  PlutusERC20Token__factory,
  PlutusAuthority__factory
} from '../../types';

describe("PlutusTest", () => {
  let deployer: SignerWithAddress;
  let vault: SignerWithAddress;
  let bob: SignerWithAddress;
  let alice: SignerWithAddress;
  let ohm: PlutusERC20Token;

  beforeEach(async () => {
    [deployer, vault, bob, alice] = await ethers.getSigners();

    const authority = await (new PlutusAuthority__factory(deployer)).deploy(deployer.address, deployer.address, deployer.address, vault.address);
    await authority.deployed();

    ohm = await (new PlutusERC20Token__factory(deployer)).deploy(authority.address);

  });

  it("correctly constructs an ERC20", async () => {
    expect(await ohm.name()).to.equal("Plutus");
    expect(await ohm.symbol()).to.equal("PLUS");
    expect(await ohm.decimals()).to.equal(9);
  });

  describe("mint", () => {
    it("must be done by vault", async () => {
      await expect(ohm.connect(deployer).mint(bob.address, 100)).
        to.be.revertedWith("UNAUTHORIZED");
    });

    it("increases total supply", async () => {
      let supplyBefore = await ohm.totalSupply();
      await ohm.connect(vault).mint(bob.address, 100);
      expect(supplyBefore.add(100)).to.equal(await ohm.totalSupply());
    });
  });

  describe("burn", () => {
    beforeEach(async () => {
      await ohm.connect(vault).mint(bob.address, 100);
    });

    it("reduces the total supply", async () => {
      let supplyBefore = await ohm.totalSupply();
      await ohm.connect(bob).burn(10);
      expect(supplyBefore.sub(10)).to.equal(await ohm.totalSupply());
    });

    it("cannot exceed total supply", async () => {
      let supply = await ohm.totalSupply();
      await expect(ohm.connect(bob).burn(supply.add(1))).
        to.be.revertedWith("ERC20: burn amount exceeds balance");
    });

    it("cannot exceed bob's balance", async () => {
      await ohm.connect(vault).mint(alice.address, 15);
      await expect(ohm.connect(alice).burn(16)).
        to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
  });
});