const { ethers } = require("ethers");
const { network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = network.config.chainId;

  // Replace placeholders with your actual contract addresses
  const ERC20 = await ethers.getContractFactory("ICOToken");
  const PreSale = await ethers.getContractFactory("PreSale");

  // ERC20 deployment arguments
  const tokenARGs = ["ICOToken", "ICOT"]


  // Deploy ERC20 contract
  const erc20Contract = await ERC20.deploy(...tokenARGs);
  await erc20Contract.deployed();

  const preSaleARGs = [
    network.config.addresses.weth,
    erc20Contract.address,
    network.config.options.threshold,
    network.config.addresses.uniswapRouter,
    network.config.addresses.aerodromeRouter,
    network.config.options.conversionRate,
    network.config.addresses.uncxLock,
    network.config.options.broker,
    network.config.addresses.sablierLiner,
  ]

  // Deploy PreSale contract with ERC20 address as argument
  const preSaleContract = await PreSale.deploy(...preSaleARGs);
  await preSaleContract.deployed();
  console.log(`PreSale deployed to: ${preSaleContract.address}`);

  // Approve ERC20 transfer for PreSale contract
  const approvalTx = await erc20Contract.approve(preSaleContract.address, erc20TotalSupply);
  await approvalTx.wait();
  console.log(`ERC20 approved for PreSale`);

  // Set treasury address in PreSale contract (deployer address)
  const treasuryTx = await preSaleContract.setTreasury(deployer.address);
  await treasuryTx.wait();
  console.log(`PreSale treasury set to: ${deployer.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
