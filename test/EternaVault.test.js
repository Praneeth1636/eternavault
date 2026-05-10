const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const ONE_DAY = 24 * 60 * 60;
const ONE_HOUR = 60 * 60;
const ONE_MIN = 60;

const Status = {
  Active: 0,
  ClaimPeriod: 1,
  Distributed: 2,
  Cancelled: 3,
};

async function deployVault() {
  const Vault = await ethers.getContractFactory("EternaVault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();
  return vault;
}

async function deployToken(deployer) {
  const Token = await ethers.getContractFactory("MockToken", deployer);
  const token = await Token.deploy();
  await token.waitForDeployment();
  return token;
}

describe("EternaVault", function () {
  let vault, owner, alice, bob, carol, dave, eve, mallory;

  beforeEach(async function () {
    [owner, alice, bob, carol, dave, eve, mallory] = await ethers.getSigners();
    vault = await deployVault();
  });

  describe("createVault", function () {
    it("creates a vault with valid inputs and emits VaultCreated", async function () {
      const heirs = [alice.address, bob.address];
      const pcts = [60, 40];

      const tx = await vault.createVault(heirs, pcts, ONE_HOUR, ONE_MIN, 1, {
        value: ethers.parseEther("1.0"),
      });

      await expect(tx)
        .to.emit(vault, "VaultCreated")
        .withArgs(0n, owner.address, BigInt(ONE_HOUR), BigInt(ONE_MIN), 1n, 2n, ethers.parseEther("1.0"));

      const v = await vault.getVault(0);
      expect(v.owner).to.equal(owner.address);
      expect(v.ethBalance).to.equal(ethers.parseEther("1.0"));
      expect(v.status).to.equal(Status.Active);
      expect(v.claimsReceived).to.equal(0n);
      expect(v.claimThreshold).to.equal(1n);
      expect(v.pingInterval).to.equal(BigInt(ONE_HOUR));
    });

    it("reverts when percentages do not sum to 100", async function () {
      await expect(
        vault.createVault([alice.address, bob.address], [60, 30], ONE_HOUR, 0, 1)
      ).to.be.revertedWithCustomError(vault, "PercentagesMustSumTo100");
    });

    it("reverts when heir/percentage array lengths mismatch", async function () {
      await expect(
        vault.createVault([alice.address, bob.address], [100], ONE_HOUR, 0, 1)
      ).to.be.revertedWithCustomError(vault, "ArrayLengthMismatch");
    });

    it("reverts on duplicate heirs", async function () {
      await expect(
        vault.createVault([alice.address, alice.address], [50, 50], ONE_HOUR, 0, 1)
      ).to.be.revertedWithCustomError(vault, "DuplicateHeir");
    });

    it("reverts when an heir is the zero address", async function () {
      await expect(
        vault.createVault([alice.address, ethers.ZeroAddress], [50, 50], ONE_HOUR, 0, 1)
      ).to.be.revertedWithCustomError(vault, "ZeroAddressHeir");
    });

    it("reverts when an heir is the owner", async function () {
      await expect(
        vault.createVault([alice.address, owner.address], [50, 50], ONE_HOUR, 0, 1)
      ).to.be.revertedWithCustomError(vault, "HeirCannotBeOwner");
    });

    it("reverts when pingInterval is too short", async function () {
      await expect(
        vault.createVault([alice.address], [100], 30, 0, 1)
      ).to.be.revertedWithCustomError(vault, "InvalidPingInterval");
    });

    it("reverts when pingInterval is too long", async function () {
      const elevenYears = 11 * 365 * ONE_DAY;
      await expect(
        vault.createVault([alice.address], [100], elevenYears, 0, 1)
      ).to.be.revertedWithCustomError(vault, "InvalidPingInterval");
    });

    it("reverts when threshold exceeds heir count", async function () {
      await expect(
        vault.createVault([alice.address, bob.address], [50, 50], ONE_HOUR, 0, 3)
      ).to.be.revertedWithCustomError(vault, "InvalidThreshold");
    });

    it("reverts when threshold is zero", async function () {
      await expect(
        vault.createVault([alice.address], [100], ONE_HOUR, 0, 0)
      ).to.be.revertedWithCustomError(vault, "InvalidThreshold");
    });
  });

  describe("ping", function () {
    beforeEach(async function () {
      await vault.createVault([alice.address, bob.address], [50, 50], ONE_HOUR, ONE_MIN, 1, {
        value: ethers.parseEther("1.0"),
      });
    });

    it("only owner can ping", async function () {
      await expect(vault.connect(alice).ping(0)).to.be.revertedWithCustomError(vault, "NotOwner");
    });

    it("ping resets lastPing", async function () {
      await time.increase(ONE_MIN * 30);
      const before = (await vault.getVault(0)).lastPing;
      await vault.ping(0);
      const after = (await vault.getVault(0)).lastPing;
      expect(after).to.be.gt(before);
    });

    it("ping reverts after expiry", async function () {
      await time.increase(ONE_HOUR + 1);
      await expect(vault.ping(0)).to.be.revertedWithCustomError(vault, "VaultExpired");
    });
  });

  describe("deposits", function () {
    beforeEach(async function () {
      await vault.createVault([alice.address, bob.address], [50, 50], ONE_HOUR, 0, 1, {
        value: ethers.parseEther("1.0"),
      });
    });

    it("depositETH increases ethBalance", async function () {
      await vault.connect(alice).depositETH(0, { value: ethers.parseEther("0.5") });
      const v = await vault.getVault(0);
      expect(v.ethBalance).to.equal(ethers.parseEther("1.5"));
    });

    it("depositETH reverts on zero amount", async function () {
      await expect(vault.depositETH(0, { value: 0 })).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("depositERC20 increases token balance and tracks token", async function () {
      const token = await deployToken(owner);
      const amt = ethers.parseEther("100");
      await token.approve(await vault.getAddress(), amt);
      await vault.depositERC20(0, await token.getAddress(), amt);

      const extras = await vault.getVaultExtras(0);
      expect(extras.tokens.length).to.equal(1);
      expect(extras.tokens[0]).to.equal(await token.getAddress());
      expect(extras.tokenBalances[0]).to.equal(amt);
    });
  });

  describe("initiateClaim", function () {
    beforeEach(async function () {
      await vault.createVault([alice.address, bob.address, carol.address], [40, 30, 30], ONE_HOUR, ONE_MIN, 2, {
        value: ethers.parseEther("3.0"),
      });
    });

    it("reverts before expiry", async function () {
      await expect(
        vault.connect(alice).initiateClaim(0)
      ).to.be.revertedWithCustomError(vault, "VaultNotExpired");
    });

    it("reverts if caller is not an heir", async function () {
      await time.increase(ONE_HOUR + 1);
      await expect(
        vault.connect(dave).initiateClaim(0)
      ).to.be.revertedWithCustomError(vault, "NotHeir");
    });

    it("succeeds after expiry and increments claimsReceived", async function () {
      await time.increase(ONE_HOUR + 1);
      await expect(vault.connect(alice).initiateClaim(0))
        .to.emit(vault, "ClaimInitiated")
        .withArgs(0n, alice.address, 1n);

      const v = await vault.getVault(0);
      expect(v.claimsReceived).to.equal(1n);
      expect(v.status).to.equal(Status.Active); // threshold not yet met
    });

    it("flips status to ClaimPeriod when threshold is hit", async function () {
      await time.increase(ONE_HOUR + 1);
      await vault.connect(alice).initiateClaim(0);
      await vault.connect(bob).initiateClaim(0);

      const v = await vault.getVault(0);
      expect(v.status).to.equal(Status.ClaimPeriod);
      expect(v.claimsReceived).to.equal(2n);
    });

    it("reverts if heir tries to initiate twice", async function () {
      await time.increase(ONE_HOUR + 1);
      await vault.connect(alice).initiateClaim(0);
      await expect(
        vault.connect(alice).initiateClaim(0)
      ).to.be.revertedWithCustomError(vault, "AlreadyInitiated");
    });
  });

  describe("distribute", function () {
    it("reverts before threshold met", async function () {
      await vault.createVault([alice.address, bob.address], [50, 50], ONE_HOUR, 0, 2, {
        value: ethers.parseEther("1.0"),
      });
      await time.increase(ONE_HOUR + 1);
      await vault.connect(alice).initiateClaim(0);
      await expect(vault.distribute(0)).to.be.revertedWithCustomError(vault, "InvalidStatus");
    });

    it("reverts before grace period elapses", async function () {
      await vault.createVault([alice.address, bob.address], [50, 50], ONE_HOUR, ONE_HOUR, 1, {
        value: ethers.parseEther("1.0"),
      });
      await time.increase(ONE_HOUR + 1);
      await vault.connect(alice).initiateClaim(0);
      await expect(vault.distribute(0)).to.be.revertedWithCustomError(vault, "GracePeriodNotElapsed");
    });

    it("splits ETH by percentage exactly", async function () {
      await vault.createVault([alice.address, bob.address], [70, 30], ONE_HOUR, 0, 1, {
        value: ethers.parseEther("1.0"),
      });
      await time.increase(ONE_HOUR + 1);
      await vault.connect(alice).initiateClaim(0);

      const aliceBefore = await ethers.provider.getBalance(alice.address);
      const bobBefore = await ethers.provider.getBalance(bob.address);

      // distribute called by a non-heir (owner) so heir balances reflect only the share
      await vault.distribute(0);

      const aliceAfter = await ethers.provider.getBalance(alice.address);
      const bobAfter = await ethers.provider.getBalance(bob.address);

      expect(aliceAfter - aliceBefore).to.equal(ethers.parseEther("0.7"));
      expect(bobAfter - bobBefore).to.equal(ethers.parseEther("0.3"));

      const v = await vault.getVault(0);
      expect(v.status).to.equal(Status.Distributed);
      expect(v.ethBalance).to.equal(0n);
    });

    it("splits ERC-20 by percentage", async function () {
      const token = await deployToken(owner);
      await vault.createVault([alice.address, bob.address], [60, 40], ONE_HOUR, 0, 1, {
        value: 0,
      });
      const amt = ethers.parseEther("1000");
      await token.approve(await vault.getAddress(), amt);
      await vault.depositERC20(0, await token.getAddress(), amt);

      await time.increase(ONE_HOUR + 1);
      await vault.connect(alice).initiateClaim(0);
      await vault.distribute(0);

      expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("600"));
      expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("400"));
    });

    it("handles rounding dust by sending it to the last heir", async function () {
      // 7 wei split 33/33/34 — first two heirs each get (7*33/100) = 2 wei,
      // last heir receives the full remainder: 7 - 2 - 2 = 3 wei.
      await vault.createVault(
        [alice.address, bob.address, carol.address],
        [33, 33, 34],
        ONE_HOUR,
        0,
        1,
        { value: 7 }
      );
      await time.increase(ONE_HOUR + 1);
      await vault.connect(alice).initiateClaim(0);

      const aliceBefore = await ethers.provider.getBalance(alice.address);
      const bobBefore = await ethers.provider.getBalance(bob.address);
      const carolBefore = await ethers.provider.getBalance(carol.address);

      await vault.distribute(0);

      expect((await ethers.provider.getBalance(alice.address)) - aliceBefore).to.equal(2n);
      expect((await ethers.provider.getBalance(bob.address)) - bobBefore).to.equal(2n);
      expect((await ethers.provider.getBalance(carol.address)) - carolBefore).to.equal(3n);
    });
  });

  describe("cancel", function () {
    it("returns all ETH and tokens to the owner", async function () {
      const token = await deployToken(owner);
      await vault.createVault([alice.address, bob.address], [50, 50], ONE_HOUR, 0, 1, {
        value: ethers.parseEther("2.0"),
      });
      const amt = ethers.parseEther("500");
      await token.approve(await vault.getAddress(), amt);
      await vault.depositERC20(0, await token.getAddress(), amt);

      const ethBefore = await ethers.provider.getBalance(owner.address);
      const tokBefore = await token.balanceOf(owner.address);

      const tx = await vault.cancel(0);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const ethAfter = await ethers.provider.getBalance(owner.address);
      const tokAfter = await token.balanceOf(owner.address);

      expect(ethAfter - ethBefore + gasCost).to.equal(ethers.parseEther("2.0"));
      expect(tokAfter - tokBefore).to.equal(amt);

      const v = await vault.getVault(0);
      expect(v.status).to.equal(Status.Cancelled);
      expect(v.ethBalance).to.equal(0n);
    });

    it("only owner can cancel", async function () {
      await vault.createVault([alice.address], [100], ONE_HOUR, 0, 1, {
        value: ethers.parseEther("1.0"),
      });
      await expect(vault.connect(alice).cancel(0)).to.be.revertedWithCustomError(vault, "NotOwner");
    });

    it("works during ClaimPeriod (before distribute)", async function () {
      await vault.createVault([alice.address, bob.address], [50, 50], ONE_HOUR, ONE_HOUR, 1, {
        value: ethers.parseEther("1.0"),
      });
      await time.increase(ONE_HOUR + 1);
      await vault.connect(alice).initiateClaim(0);

      const v1 = await vault.getVault(0);
      expect(v1.status).to.equal(Status.ClaimPeriod);

      await expect(vault.cancel(0)).to.emit(vault, "Cancelled").withArgs(0n, owner.address);
      const v2 = await vault.getVault(0);
      expect(v2.status).to.equal(Status.Cancelled);
    });
  });

  describe("ReentrancyGuard", function () {
    it("blocks reentrant distribute via malicious heir", async function () {
      const Mal = await ethers.getContractFactory("MaliciousReceiver");
      const mal = await Mal.deploy();
      await mal.waitForDeployment();

      await vault.createVault(
        [await mal.getAddress(), bob.address],
        [50, 50],
        ONE_HOUR,
        0,
        1,
        { value: ethers.parseEther("1.0") }
      );

      await mal.setTarget(await vault.getAddress(), 0);

      await time.increase(ONE_HOUR + 1);
      await mal.initiateClaim();
      await vault.distribute(0);

      expect(await mal.reentrancyAttempted()).to.equal(true);
      expect(await mal.reentrancyBlocked()).to.equal(true);

      const v = await vault.getVault(0);
      expect(v.status).to.equal(Status.Distributed);
    });
  });

  describe("multi-vault isolation", function () {
    it("multiple vaults operate independently", async function () {
      // Vault 0: owner -> alice/bob 50/50
      await vault.createVault([alice.address, bob.address], [50, 50], ONE_HOUR, 0, 1, {
        value: ethers.parseEther("1.0"),
      });
      // Vault 1: alice (as owner) -> carol/dave 70/30
      await vault.connect(alice).createVault(
        [carol.address, dave.address],
        [70, 30],
        ONE_HOUR,
        0,
        1,
        { value: ethers.parseEther("2.0") }
      );

      const v0 = await vault.getVault(0);
      const v1 = await vault.getVault(1);

      expect(v0.owner).to.equal(owner.address);
      expect(v1.owner).to.equal(alice.address);
      expect(v0.ethBalance).to.equal(ethers.parseEther("1.0"));
      expect(v1.ethBalance).to.equal(ethers.parseEther("2.0"));

      // Cancel only vault 0 — vault 1 must remain Active
      await vault.cancel(0);
      const v0b = await vault.getVault(0);
      const v1b = await vault.getVault(1);
      expect(v0b.status).to.equal(Status.Cancelled);
      expect(v1b.status).to.equal(Status.Active);
      expect(v1b.ethBalance).to.equal(ethers.parseEther("2.0"));
    });
  });

  describe("getVaultsByOwner / getVaultsByHeir", function () {
    it("returns correct lists of vault IDs", async function () {
      await vault.createVault([alice.address, bob.address], [50, 50], ONE_HOUR, 0, 1, {
        value: ethers.parseEther("0.1"),
      });
      await vault.createVault([alice.address, carol.address], [60, 40], ONE_HOUR, 0, 1, {
        value: ethers.parseEther("0.2"),
      });
      await vault.connect(eve).createVault([alice.address], [100], ONE_HOUR, 0, 1, {
        value: ethers.parseEther("0.3"),
      });

      const ownerVaults = await vault.getVaultsByOwner(owner.address);
      expect(ownerVaults.map((x) => Number(x))).to.deep.equal([0, 1]);

      const eveVaults = await vault.getVaultsByOwner(eve.address);
      expect(eveVaults.map((x) => Number(x))).to.deep.equal([2]);

      const aliceHeirOf = await vault.getVaultsByHeir(alice.address);
      expect(aliceHeirOf.map((x) => Number(x))).to.deep.equal([0, 1, 2]);

      const carolHeirOf = await vault.getVaultsByHeir(carol.address);
      expect(carolHeirOf.map((x) => Number(x))).to.deep.equal([1]);
    });
  });

  describe("views", function () {
    it("isExpired and timeUntilExpiry track the deadline", async function () {
      await vault.createVault([alice.address], [100], ONE_HOUR, 0, 1, {
        value: ethers.parseEther("0.1"),
      });
      expect(await vault.isExpired(0)).to.equal(false);
      const remaining = await vault.timeUntilExpiry(0);
      expect(remaining).to.be.gt(0n);

      await time.increase(ONE_HOUR + 5);
      expect(await vault.isExpired(0)).to.equal(true);
      expect(await vault.timeUntilExpiry(0)).to.equal(0n);
    });

    it("getHeirs returns the heir array", async function () {
      await vault.createVault([alice.address, bob.address], [70, 30], ONE_HOUR, 0, 1, {
        value: 0,
      });
      const heirs = await vault.getHeirs(0);
      expect(heirs.length).to.equal(2);
      expect(heirs[0].wallet).to.equal(alice.address);
      expect(heirs[0].percentage).to.equal(70n);
      expect(heirs[1].wallet).to.equal(bob.address);
      expect(heirs[1].percentage).to.equal(30n);
    });
  });
});
