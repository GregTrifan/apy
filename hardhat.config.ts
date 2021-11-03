import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-deploy";
import "hardhat-deploy-ethers";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const accounts = {
  mnemonic: `${process.env.MNEMONIC}`,
};

const providerUrl: string = process.env.MAINNET_PROVIDER_URL as string;

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts,
    },
    hardhat: {
      forking: {
        url: providerUrl,
      },
      gasPrice: 0,
      initialBaseFeePerGas: 0,
      loggingEnabled: true,
      accounts,
      chainId: 1, // metamask -> accounts -> settings -> networks -> localhost 8545 -> set chainId to 1
    },
    local: {
      url: "http://127.0.0.1:8545",
      hardfork: "berlin",
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  namedAccounts: {
    deployer: {
      default: 0, // here this will by default take the first account as deployer
      1: `${process.env.DEPLOYER_ADDRESS}`, // for mainnet
      4: `${process.env.DEPLOYER_ADDRESS}`, // for rinkeby
    },
    tokenOwner: 1,
    randomAddress: 2,
  },
  mocha: {
    timeout: 20000000,
    fullTrace: false,
    forbidPending: false,
  },
};

export default config;
