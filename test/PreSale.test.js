const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const wethABi = require("./WETH_abi.json");

const { expect } = require("chai");
const { ethers: hardhatEther, network } = require("hardhat");
const { ethers } = require("ethers");

let routerV2address;
let wethAddress;
let factoryAddress;
let uncxAddress;
let sablierLinerAddress;
let aerodromeAddress;
let presaleContract;
let sablierLinerContract;
let icoToken;
let weth;
let factoryContract;
let provider;
let uncxContract;
let aerodromeContract;
let aerodromeFactory;

const conversionRate = ethers.toBigInt(3);
const threashold = ethers.parseEther("50");
const DAY = 24 * 60 * 60 * 1000;

async function config() {
  sablierLinerAddress = network.config.addresses.sablierLiner;
  routerV2address = network.config.addresses.uniswapRouter;
  wethAddress = network.config.addresses.weth;
  factoryAddress = network.config.addresses.uniswapFactory;
  uncxAddress = network.config.addresses.uncxLock;
  aerodromeAddress = network.config.addresses.aerodromeRouter;
  aerodromeFactory = network.config.addresses.aerodromeFactory;
}

async function setup() {
  provider = await hardhatEther.getSigners();
  // Connect to the WETH contract
  weth = new ethers.Contract(wethAddress, wethABi, provider[0]);

  // Deposit ETH and get WETH
  await weth.deposit({ value: ethers.parseEther("100") });

  icoToken = await hardhatEther.getContractFactory("ICOToken");
  icoToken = await icoToken.deploy("ICOToken", "ICOT");

  presaleContract = await hardhatEther.getContractFactory("PreSale");

  presaleContract = await presaleContract.deploy(
    wethAddress,
    icoToken.target,
    threashold,
    routerV2address,
    aerodromeAddress,
    conversionRate,
    uncxAddress,
    [provider[0].address, 0],
    sablierLinerAddress
  );

  routerContract = await hardhatEther.getContractAt(
    "IUniswapV2Router02",
    routerV2address,
    provider[0]
  );
  factoryContract = await hardhatEther.getContractAt(
    "IUniswapV2Factory",
    factoryAddress,
    provider[0]
  );
  sablierLinerContract = await hardhatEther.getContractAt(
    "ISablierV2LockupLinear",
    sablierLinerAddress,
    provider[0]
  );
  uncxContract = await hardhatEther.getContractAt(
    "ITokenLock",
    uncxAddress,
    provider[0]
  );
  aerodromeContract = await hardhatEther.getContractAt(
    "IAerodromeRouter",
    aerodromeAddress,
    provider[0]
  );

  // Transfer some allowance to presaleContract for testing
  await weth.approve(presaleContract.target, ethers.parseEther("2000"));
}

describe("Presale Contract", function () {
  this.beforeAll(async function () {
    // initialise addresses
    await config();
    await setup();
  });
  describe("Admin/Owner methods", function () {
    describe("setTreasury", function () {
      it("Should revert if caller is not owner", async function () {
        await expect(
          presaleContract.connect(provider[1]).setTreasury(provider[1].address)
        ).to.be.revertedWithCustomError(
          presaleContract,
          "OwnableUnauthorizedAccount"
        );
      });
      it("Should revert in invest method if treasury address is not defined", async function () {
        await expect(
          presaleContract.connect(provider[1]).invest(1)
        ).to.be.revertedWith("Treasury not defined");
      });
      it("Should revert if sufficient approval is not given from treasury", async function () {
        await expect(
          presaleContract.setTreasury(provider[1].address)
        ).to.be.revertedWith("Insufficient allowance");
      });
      it("Should set treasury address with correct approvals", async function () {
        await icoToken.approve(
          presaleContract.target,
          ethers.parseEther((threashold * conversionRate).toString())
        );
        await presaleContract.setTreasury(provider[0].address);
        await expect(await presaleContract.treasury()).to.be.equals(
          provider[0].address
        );
      });
      it("Should revert updating treasury if sufficient approval is not given from treasury", async function () {
        await expect(
          presaleContract.setTreasury(provider[1].address)
        ).to.be.revertedWith("Insufficient allowance");
      });
      it("Should update treasury address with correct approvals", async function () {
        await icoToken
          .connect(provider[1])
          .approve(
            presaleContract.target,
            ethers.parseEther((threashold * conversionRate).toString())
          );
        await presaleContract.setTreasury(provider[1].address);
        await expect(await presaleContract.treasury()).to.be.equals(
          provider[1].address
        );
      });
    });
    describe("addVestingRange", function () {
      it("Should revert if caller is not owner", async function () {
        await expect(
          presaleContract.connect(provider[1]).addVestingRange([1, 1, 1, 1])
        ).to.be.revertedWithCustomError(
          presaleContract,
          "OwnableUnauthorizedAccount"
        );
      });
      it("Should revert if end range is not greator the start range", async function () {
        await expect(
          presaleContract.addVestingRange([
            ethers.parseEther("10"),
            ethers.parseEther("10"),
            1,
            1,
          ])
        ).to.be.revertedWith("Invalid End Range");
      });
      it("Should add new range", async function () {
        let newCliff = 30 * DAY;
        let newDuration = 100 * DAY;
        let newStartRange = ethers.parseEther("10");
        let newEndRange = ethers.parseEther("50");

        await presaleContract.addVestingRange([
          newStartRange,
          newEndRange,
          newCliff,
          newDuration,
        ]);

        let range = await presaleContract.vestingRanges(1);

        await expect(range[0]).to.be.equals(newStartRange);
        await expect(range[1]).to.be.equals(newEndRange);
        await expect(range[2]).to.be.equals(newCliff);
        await expect(range[3]).to.be.equals(newDuration);
      });
      it("Should revert if start range is not greator the last end range", async function () {
        await expect(
          presaleContract.addVestingRange([
            ethers.parseEther("10"),
            ethers.parseEther("50"),
            1 * DAY,
            100 * DAY,
          ])
        ).to.be.revertedWith("Invalid Start Range");
      });
    });
    describe("setVestingRange", function () {
      it("Should revert if caller is not owner", async function () {
        await expect(
          presaleContract.connect(provider[1]).setVestingRange(1, [1, 1, 1, 1])
        ).to.be.revertedWithCustomError(
          presaleContract,
          "OwnableUnauthorizedAccount"
        );
      });
      it("Should revert if index is incorrect", async function () {
        await expect(
          presaleContract.setVestingRange(2, [1, 1, 1, 1])
        ).to.be.revertedWith("Invalid index");
      });
      it("Should update default cliff and duration", async function () {
        let newCliff = 20 * DAY;
        let newDuration = 60 * DAY;
        await presaleContract.setVestingRange(0, [1, 1, newCliff, newDuration]);
        let range = await presaleContract.vestingRanges(0);

        await expect(range[2]).to.be.equals(newCliff);

        await expect(range[3]).to.be.equals(newDuration);
      });
      it("Should update the existing range", async function () {
        let newCliff = 20 * DAY;
        let newDuration = 60 * DAY;
        let newStartRange = ethers.parseEther("10");
        let newEndRange = ethers.parseEther("50");

        await presaleContract.setVestingRange(1, [
          newStartRange,
          newEndRange,
          newCliff,
          newDuration,
        ]);
        let range = await presaleContract.vestingRanges(1);

        await expect(range[0]).to.be.equals(newStartRange);
        await expect(range[1]).to.be.equals(newEndRange);
        await expect(range[2]).to.be.equals(newCliff);
        await expect(range[3]).to.be.equals(newDuration);
      });
    });
    describe("setBroker", function () {
      it("Should revert if caller is not owner", async function () {
        await expect(
          presaleContract
            .connect(provider[1])
            .setBroker([provider[1].address, 0])
        ).to.be.revertedWithCustomError(
          presaleContract,
          "OwnableUnauthorizedAccount"
        );
      });
      it("Should update the broker details", async function () {
        let brokerAddress = provider[1].address;
        let brokerage = 10;
        await presaleContract.setBroker([brokerAddress, brokerage]);
        let broker = await presaleContract.broker();
        expect(broker[0]).to.be.equals(brokerAddress);
        expect(broker[1]).to.be.equals(brokerage);
      });
    });
    describe("setThreshold", function () {
      it("Should revert if caller is not owner", async function () {
        await expect(
          presaleContract.connect(provider[1]).setThreshold(100)
        ).to.be.revertedWithCustomError(
          presaleContract,
          "OwnableUnauthorizedAccount"
        );
      });
      it("Should revert if new threshold is higher than current investment", async function () {
        await presaleContract.setTreasury(provider[0].address);
        await presaleContract.invest(ethers.parseEther("10"))
        let totalInvested = await presaleContract.totalInvested();
        await expect(
          presaleContract.setThreshold(totalInvested - ethers.parseEther("1"))
        ).to.be.revertedWith(
          "The investment should be more than current investment"
        );
      });
      it("Should update the threshold", async function () {
        let totalInvested = await presaleContract.totalInvested();
        let newThreshold = totalInvested + ethers.parseEther("1")
        await presaleContract.setThreshold(
          newThreshold
        );
        expect(await presaleContract.threshold()).to.be.equals(
          newThreshold
        );
      });
    });
    describe("createLiquidity", function () {
      this.beforeAll(async function () {
        // initialise addresses
        await setup();

        // add allowance to presale contract from treasury
        await icoToken.approve(
          presaleContract.target,
          ethers.parseEther((threashold * conversionRate).toString())
        );

        // // set treasury
        await presaleContract.setTreasury(provider[0].address);
      });
      it("Should revert if caller is not owner", async function () {
        await expect(
          presaleContract
            .connect(provider[1])
            .createLiquidityPool(ethers.parseEther("100"), true)
        ).to.be.revertedWithCustomError(
          presaleContract,
          "OwnableUnauthorizedAccount"
        );
      });
      it("Should revert if threshold is not reached", async function () {
        await expect(
          presaleContract.createLiquidityPool(ethers.parseEther("100"), true)
        ).to.be.revertedWith("PreSale did not reached to threashold");
      });
      it("Should revert if there is no investment token available", async function () {
        await presaleContract.invest(threashold);
        await presaleContract.extractERC20(wethAddress, threashold);
        await expect(
          presaleContract.createLiquidityPool(threashold * conversionRate, true)
        ).to.be.revertedWith("No tokens available for liquidity");
      });
      it("Should Create LP in Uniswap", async function () {
        await weth.transfer(presaleContract.target, threashold);
        await presaleContract.createLiquidityPool(
          threashold * conversionRate,
          true
        );
        let pair = await factoryContract.getPair(icoToken.target, wethAddress);
        expect((await presaleContract.getPair())[1]).to.be.equals(pair);
      });
      it("Should Create lock Uniswap LP in UNCX", async function () {
        await weth.transfer(presaleContract.target, threashold);
        let lockId = await presaleContract.lockId();
        let pair = await factoryContract.getPair(icoToken.target, wethAddress);
        expect(lockId).to.not.be.equals(0);
        let lock = await uncxContract.getLock(lockId);
        expect(pair).to.be.equals(lock[1]);
        expect(presaleContract.target).to.be.equals(lock[8]);
      });
      it("Should Create LP in Aerodrome", async function () {
        // initialise addresses
        await setup();

        // add allowance to presale contract from treasury
        await icoToken.approve(
          presaleContract.target,
          ethers.parseEther((threashold * conversionRate).toString())
        );

        // // set treasury
        await presaleContract.setTreasury(provider[0].address);
        await presaleContract.invest(threashold);
        await presaleContract.createLiquidityPool(
          threashold * conversionRate,
          false
        );

        let pair = await aerodromeContract.poolFor(
          icoToken.target,
          wethAddress,
          false,
          aerodromeFactory
        );
        expect((await presaleContract.getPair())[1]).to.be.equals(pair);
      });
      it("Should Create lock Aerodrome LP in UNCX", async function () {
        await weth.transfer(presaleContract.target, threashold);
        let lockId = await presaleContract.lockId();
        let pair = await aerodromeContract.poolFor(
          icoToken.target,
          wethAddress,
          false,
          aerodromeFactory
        );
        expect(lockId).to.not.be.equals(0);
        let lock = await uncxContract.getLock(lockId);
        expect(pair).to.be.equals(lock[1]);
        expect(presaleContract.target).to.be.equals(lock[8]);
      });
      it("Should revert if pool is already created", async function () {
        await expect(
          presaleContract.createLiquidityPool(threashold * conversionRate, true)
        ).to.be.revertedWith("Pool has been already creatd");
      });
    });
    describe("panicwithdraw", function () {
      it("Should revert if caller is not owner", async function () {
        await expect(
          presaleContract.connect(provider[1]).panicWithdraw()
        ).to.be.revertedWithCustomError(
          presaleContract,
          "OwnableUnauthorizedAccount"
        );
      });
      it("should withdraw all locked tokens to owners address", async function () {
        const lockId = await presaleContract.lockId();

        const lock = await uncxContract.getLock(lockId);

        const withdrawableAmount = lock[2];

        const lpTokenContract = await hardhatEther.getContractAt(
          "IERC20",
          (
            await presaleContract.getPair()
          )[1],
          provider[0]
        );
        await presaleContract.panicWithdraw();
        const afterBalance = await lpTokenContract.balanceOf(
          provider[0].address
        );

        expect(withdrawableAmount).to.equal(afterBalance);
      });
    });
    describe("withdraw", function () {
      it("Should revert if caller is not owner", async function () {
        await expect(
          presaleContract.connect(provider[1]).withdraw()
        ).to.be.revertedWithCustomError(
          presaleContract,
          "OwnableUnauthorizedAccount"
        );
      });
      it("Should revert if token lock is not complete", async function () {
        it("Should revert if caller is not owner", async function () {
          await expect(
            presaleContract.connect(provider[1]).withdraw()
          ).to.be.revertedWith(
            "Withdraw is not available, update the unlock conditions"
          );
        });
      });
      it("should withdraw all locked tokens to owners address", async function () {
        // initialise addresses
        await setup();

        // add allowance to presale contract from treasury
        await icoToken.approve(
          presaleContract.target,
          ethers.parseEther((threashold * conversionRate).toString())
        );

        await presaleContract.setTreasury(provider[0].address);
        await presaleContract.invest(threashold);

        await presaleContract.createLiquidityPool(
          threashold * conversionRate,
          false
        );
        const lockId = await presaleContract.lockId();
        await hardhatEther.provider.send("evm_increaseTime", [180 * DAY]);
        await hardhatEther.provider.send("evm_mine");
        const withdrawableAmount = await uncxContract.getWithdrawableTokens(
          lockId.toString()
        );

        const lpTokenContract = await hardhatEther.getContractAt(
          "IERC20",
          (
            await presaleContract.getPair()
          )[1],
          provider[0]
        );
        await presaleContract.withdraw();
        const afterBalance = await lpTokenContract.balanceOf(
          provider[0].address
        );

        expect(withdrawableAmount).to.equal(afterBalance);
      });
    });
    describe("extractECR20", function () {
      it("Should revert if caller is not owner", async function () {
        await expect(
          presaleContract
            .connect(provider[1])
            .extractERC20(icoToken.target, ethers.parseEther("10"))
        ).to.be.revertedWithCustomError(
          presaleContract,
          "OwnableUnauthorizedAccount"
        );
      });
      it("should extract ERC20 tokens", async function () {
        const ownerBalance = await icoToken.balanceOf(provider[0].address);
        // Mint some tokens to yourContract
        await icoToken.transfer(
          presaleContract.target,
          ethers.parseEther("10")
        );

        // Call the extractERC20 function
        await presaleContract.extractERC20(
          icoToken.target,
          ethers.parseEther("10")
        );

        const currentownerBalance = await icoToken.balanceOf(
          provider[0].address
        );

        expect(ownerBalance).to.equal(currentownerBalance);
      });
    });
  });

  describe("invest", function () {
    this.beforeAll(async function () {
      // initialise addresses
      await setup();

      // add allowance to presale contract from treasury
      await icoToken.approve(
        presaleContract.target,
        ethers.parseEther((threashold * conversionRate).toString())
      );

      // // set treasury
      await presaleContract.setTreasury(provider[0].address);
    });

    it("should invest successfully when amount is valid and allowance is sufficient and have valid vesting", async function () {
      const amount = ethers.parseEther("10");

      let streamId;
      const captureValue = (value) => {
        streamId = value;
        return true;
      };
      await expect(presaleContract.invest(amount))
        .to.emit(presaleContract, "Investment")
        .withArgs(
          provider[0].address,
          amount,
          amount * conversionRate / ethers.parseEther("1"),
          captureValue
        );

      let data = await sablierLinerContract.getStream(streamId);
      let range = await presaleContract.vestingRanges(0);
      expect(await weth.balanceOf(presaleContract.target)).to.equal(amount);

      expect(await presaleContract.totalInvested()).to.equal(amount);

      expect(data[0]).to.equals(provider[0].address);
      expect(data[2] - data[1]).to.equals(range[2]);
      expect(data[6] - data[1]).to.equals(range[3]);
      expect(ethers.toBigInt(data[10][0])).to.equals((amount * conversionRate) / ethers.parseEther("1"));
    });

    it("should invest successfully when amount is less than threshold", async function () {
      const amount = ethers.parseEther("35");

      let userInvesments = await presaleContract.investments(
        provider[0].address
      );
      await presaleContract.invest(amount);
      expect(await presaleContract.investments(provider[0].address)).to.equal(
        amount + userInvesments
      );
    });

    it("should invest with new cliff and duration", async function () {
      const amount = ethers.parseEther("2");
      let newCliff = 10 * DAY;
      let newDurtion = 80 * DAY;
      await presaleContract.addVestingRange([
        ethers.parseEther("1"),
        ethers.parseEther("2.5"),
        newCliff,
        newDurtion,
      ]);

      let streamId;
      const captureValue = (value) => {
        streamId = value;
        return true;
      };
      await expect(presaleContract.invest(amount))
        .to.emit(presaleContract, "Investment")
        .withArgs(
          provider[0].address,
          amount,
          amount * conversionRate / ethers.parseEther("1"),
          captureValue
        );

      let data = await sablierLinerContract.getStream(streamId);

      expect(data[0]).to.equals(provider[0].address);
      expect(data[2] - data[1]).to.equals(newCliff);
      expect(data[6] - data[1]).to.equals(newDurtion);
      expect(ethers.toBigInt(data[10][0])).to.equals((amount * conversionRate) / ethers.parseEther("1"));
    });

    it("should invest up to threshold when amount exceeds threshold", async function () {
      const amount = ethers.parseEther("7");
      const expectedAmount =
        (await presaleContract.threshold()) -
        (await presaleContract.totalInvested());

      await expect(presaleContract.invest(amount))
        .to.emit(presaleContract, "Investment")
        .withArgs(anyValue, expectedAmount, anyValue, anyValue);
    });

    it("should revert when amount is zero", async function () {
      await expect(presaleContract.invest(0)).to.be.revertedWith(
        "Invalid amount"
      );
    });
  });
});
