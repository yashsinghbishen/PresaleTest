require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_MAINNET_RPC_URL, // Replace with your Infura or Alchemy API key
        blockNumber: 13165420,
      },
      addresses :{
        uniswapRouter : "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
        uniswapFactory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
        aerodromeRouter : "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        aerodromeFactory : "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
        weth : "0x4200000000000000000000000000000000000006",
        uncxLock : "0xa82685520c463a752d5319e6616e4e5fd0215e33",
        sablierLiner : "0xFCF737582d167c7D20A336532eb8BCcA8CF8e350"
      }
    },
    mainnetFork: {
      url: process.env.ALCHEMY_MAINNET_RPC_URL, // Replace with your Alchemy mainnet RPC URL
    },
  },
};
