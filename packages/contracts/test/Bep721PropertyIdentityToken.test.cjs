const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Bep721PropertyIdentityToken", function () {
  async function deploy() {
    const [registrySafe, partnerSafe, other, attacker] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("Bep721PropertyIdentityToken");
    const contract = await factory.deploy(registrySafe.address);
    await contract.waitForDeployment();
    return { contract, registrySafe, partnerSafe, other, attacker };
  }

  it("mints to the Partner Corporate Safe and stores only privacy-safe hashes", async function () {
    const { contract, partnerSafe } = await deploy();
    const h1 = ethers.keccak256(ethers.toUtf8Bytes("property"));
    const h2 = ethers.keccak256(ethers.toUtf8Bytes("version"));
    const h3 = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
    await expect(contract.mintIdentity(partnerSafe.address, 42, h1, h2, h3, "ipfs://safe-metadata")).to.emit(contract, "IdentityMinted");
    expect(await contract.ownerOf(42)).to.equal(partnerSafe.address);
    const record = await contract.identityRecord(42);
    expect(record.propertyReferenceHash).to.equal(h1);
    expect(record.status).to.equal(1);
  });

  it("forbids ordinary holder transfer and approval operations", async function () {
    const { contract, partnerSafe, other } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("x"));
    await contract.mintIdentity(partnerSafe.address, 1, hash, hash, hash, "");
    await expect(contract.connect(partnerSafe).transferFrom(partnerSafe.address, other.address, 1)).to.be.revertedWithCustomError(contract, "HolderOperationForbidden");
    await expect(contract.connect(partnerSafe).approve(other.address, 1)).to.be.revertedWithCustomError(contract, "HolderOperationForbidden");
  });

  it("allows only registry roles to suspend, revoke and reassign", async function () {
    const { contract, partnerSafe, other, attacker } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("x"));
    await contract.mintIdentity(partnerSafe.address, 7, hash, hash, hash, "");
    await expect(contract.connect(attacker).suspend(7)).to.be.reverted;
    await contract.suspend(7);
    expect((await contract.identityRecord(7)).status).to.equal(2);
    await contract.registryReassign(7, other.address);
    expect(await contract.ownerOf(7)).to.equal(other.address);
    await contract.revoke(7);
    expect((await contract.identityRecord(7)).status).to.equal(3);
  });
});
