import { expect } from "chai";
import { ethers } from "hardhat";
import { runInThisContext } from "vm";
import { Contracts } from "../networks/compoundMainnet.json";
const compAbi = require("../external/compound.json");
const ERC20 = require("../external/erc20.json");

const COMP_API = "https://api.compound.finance/api/v2/ctoken";
const USDC_MAINNET = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

//THE biggest hodler of USDC - Maker
const MAKER_ADDRESS = "0x0a59649758aa4d66e25f08dd01271e891fe52199";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
const CUSDC_DECIMALS = 8;

describe("Compound USDC APY", function () {
  const USDC_AMOUNT = 100;
  const ONE_USDC = ethers.utils.parseUnits("1.0", 6);
  const SUPPLY_AMOUNT = ONE_USDC.mul(USDC_AMOUNT);

  before(async function () {
    this.signers = await ethers.getSigners();
    this.deployer = this.signers[0];

    this.cUSDC = new ethers.Contract(
      Contracts.cUSDC,
      compAbi["cErc20Delegate"],
      this.deployer
    );
    this.Comptroller = new ethers.Contract(
      Contracts.Comptroller,
      compAbi["Comptroller"],
      this.deployer
    );
    this.COMP = new ethers.Contract(Contracts.COMP, ERC20, this.deployer);
    this.USDC = new ethers.Contract(USDC_MAINNET, ERC20, this.deployer);

    //unblock USDC contract
    await ethers.provider.send("hardhat_impersonateAccount", [MAKER_ADDRESS]);

    this.makerSigner = await ethers.getSigner(MAKER_ADDRESS);

    //transfer SUPPLY_AMOUNT USDC to deployer
    let tx = await this.USDC.connect(this.makerSigner).transfer(
      this.deployer.address,
      SUPPLY_AMOUNT
    );
    await tx.wait();

    //INTEGRITY CHECK
    this.startBalance = await this.USDC.balanceOf(this.deployer.address);
    expect(this.startBalance).to.be.not.eq(ethers.constants.Zero);
    console.log(
      "DEPLOYER USDC balance = ",
      ethers.utils.formatUnits(this.startBalance, 6)
    );
  });

  it("Estimate USDC APY based on earnings", async function () {
    // Approve USDC to be spent
    let tx = await this.USDC.connect(this.deployer).approve(
      this.cUSDC.address,
      SUPPLY_AMOUNT
    );
    await tx.wait();
    // mint some cUSDC
    tx = await this.cUSDC.connect(this.deployer).mint(SUPPLY_AMOUNT);
    await tx.wait();

    let block = await ethers.provider.getBlock(tx.blockNumber);
    let startBlock = block.number;
    let startTimestamp = block.timestamp;
    let ctokenBalance = await this.cUSDC.balanceOf(this.deployer.address);
    expect(ctokenBalance).to.be.not.eq(ethers.constants.Zero);
    console.log(
      "cUSDC balance = ",
      ethers.utils.formatUnits(ctokenBalance, CUSDC_DECIMALS)
    );

    //Wait for 30s
    console.log("Waiting for 30 seconds...");
    await delay(30000);
    console.log("Redeem start...");

    // Redeem cUSDC
    tx = await this.cUSDC.redeem(ctokenBalance);
    await tx.wait();

    // Redeem Comp
    tx = await this.Comptroller.claimComp(this.deployer.address);
    await tx.wait();

    block = await ethers.provider.getBlock(tx.blockNumber);
    let endTimestamp = block.timestamp;
    let endBlock = block.number;
    let diff = (endBlock - startBlock) * 13.15; //endTimestamp - startTimestamp;
    console.log(`TIME SPENT:${diff}`);
    let periods = (6570 * 365) / diff;

    let endBalance = await this.USDC.balanceOf(this.deployer.address);
    console.log(
      "DEPLOYER USDC after redeem balance = ",
      ethers.utils.formatUnits(endBalance, 6)
    );

    // TODO: use this in APR calculation
    let exchangeRate = await this.cUSDC.exchangeRateStored();
    // FIXME: APR will fluctuate based on the amount of cUSDC supplied vs cUSDC borrowed
    // PS: the supply is d.p. with the APY

    let totalSupply = await this.cUSDC.totalSupply();
    let profit = endBalance - this.startBalance;
    let calculatedAPR =
      (((profit * periods) / USDC_AMOUNT) * 365 * 100) / Math.pow(10, 7);
    let profitYear = (calculatedAPR * USDC_AMOUNT) / 100;

    console.log(
      `Earned ${ethers.utils.formatUnits(
        profit,
        6
      )} with ${calculatedAPR.toString()}% APR (${
        Math.round(profitYear * 1000) / 1000
      } $/year)`
    );
    let earnedCOMP = await this.COMP.balanceOf(this.deployer.address);
    console.log(`Earned ${ethers.utils.formatEther(earnedCOMP)}COMP`);
    /// As Stated by Compound Docs
    const ethMantissa = 1e18;
    const blocksPerDay = 6570; // 13.15 seconds per block
    const daysPerYear = 365;
    const supplyRatePerBlock = await this.cUSDC.supplyRatePerBlock();
    /* Where supplyRatePerBlock:
     * underlying = totalSupply * exchangeRate
     * borrowsPer = totalBorrows / underlying
     * supplyRatePerBlock = borrowRate * (1-reserveFactor)*borrowsPer
     */
    const cUSDCApy =
      (Math.pow(
        (supplyRatePerBlock / ethMantissa) * blocksPerDay + 1,
        daysPerYear
      ) -
        1) *
      100;
    console.log(`Official Supply APY for USDC ${cUSDCApy} %`);
  });
});
