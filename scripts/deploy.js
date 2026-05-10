const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\nDeploying EternaVault to network: ${network}`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${hre.ethers.formatEther(balance)} ETH`);

  const Vault = await hre.ethers.getContractFactory("EternaVault");
  const vault = await Vault.deploy();
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log(`\nEternaVault deployed at: ${address}`);

  if (network !== "hardhat" && network !== "localhost") {
    console.log("\nWaiting for 5 confirmations before verifying...");
    const tx = vault.deploymentTransaction();
    if (tx) {
      await tx.wait(5);
    }

    if (process.env.ETHERSCAN_API_KEY) {
      console.log("Verifying on Etherscan...");
      try {
        await hre.run("verify:verify", {
          address,
          constructorArguments: [],
        });
        console.log("Verified successfully.");
      } catch (err) {
        console.warn(`Verification skipped/failed: ${err.message}`);
      }
    } else {
      console.log("ETHERSCAN_API_KEY not set; skipping verification.");
    }
  }

  console.log("\n--------------------------------------------------------");
  console.log("Copy this into web/.env.local:");
  console.log("--------------------------------------------------------");
  const chainId =
    network === "sepolia" ? 11155111 : network === "localhost" ? 31337 : "unknown";
  console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${address}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=${chainId}`);
  console.log("--------------------------------------------------------\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
