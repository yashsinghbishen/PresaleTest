require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const { ethers } = require("ethers");
// require("hardhat-deploy");
// require("hardhat-deploy-ethers");
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_MAINNET_RPC_URL, // Replace with your Infura or Alchemy API key
        blockNumber: 13165420,
      },
      addresses: {
        uniswapRouter: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
        uniswapFactory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
        aerodromeRouter: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        aerodromeFactory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
        weth: "0x4200000000000000000000000000000000000006",
        uncxLock: "0xa82685520c463a752d5319e6616e4e5fd0215e33",
        sablierLiner: "0xFCF737582d167c7D20A336532eb8BCcA8CF8e350",
      },
    },
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_RPC_URL,
      accounts: [process.env.ADMIN_PRIVATE_KEY,],
      addresses: {
        uniswapRouter: "0x425141165d3DE9FEC831896C016617a52363b687",
        uniswapFactory: "0xB7f907f7A9eBC822a80BD25E224be42Ce0A698A0",
        aerodromeRouter: "0x0000000000000000000000000000000000000000",
        aerodromeFactory: "0x0000000000000000000000000000000000000000",
        weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
        uncxLock: "0x3dFC191d2ff5008e11d878345daD88A0C005fCf0",
        sablierLiner: "0x7a43F8a888fa15e68C103E18b0439Eb1e98E4301",
      },
      options: {
        threshold: ethers.parseEther("100"),
        conversionRate: ethers.parseEther("0.0001"),
        broker: ["0x0000000000000000000000000000000000000000", 0],
      },
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
