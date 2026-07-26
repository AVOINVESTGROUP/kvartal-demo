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

  it("rejects zero hashes, zero recipients and duplicate identities", async function () {
    const { contract, partnerSafe } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("x"));
    await expect(contract.mintIdentity(ethers.ZeroAddress, 1, hash, hash, hash, "")).to.be.reverted;
    await expect(contract.mintIdentity(partnerSafe.address, 1, ethers.ZeroHash, hash, hash, "")).to.be.revertedWithCustomError(contract, "ZeroHashForbidden");
    await contract.mintIdentity(partnerSafe.address, 1, hash, hash, hash, "ipfs://one");
    await expect(contract.mintIdentity(partnerSafe.address, 1, hash, hash, hash, "ipfs://duplicate")).to.be.reverted;
    expect(await contract.tokenURI(1)).to.equal("ipfs://one");
  });

  it("blocks every holder transfer entry point", async function () {
    const { contract, partnerSafe, other } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("x"));
    await contract.mintIdentity(partnerSafe.address, 9, hash, hash, hash, "");
    await expect(contract.connect(partnerSafe)["safeTransferFrom(address,address,uint256)"](partnerSafe.address, other.address, 9)).to.be.revertedWithCustomError(contract, "HolderOperationForbidden");
    await expect(contract.connect(partnerSafe)["safeTransferFrom(address,address,uint256,bytes)"](partnerSafe.address, other.address, 9, "0x")).to.be.revertedWithCustomError(contract, "HolderOperationForbidden");
    await expect(contract.connect(partnerSafe).setApprovalForAll(other.address, true)).to.be.revertedWithCustomError(contract, "HolderOperationForbidden");
  });

  it("keeps revoke terminal and enforces lifecycle transitions", async function () {
    const { contract, partnerSafe, other } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("x"));
    await contract.mintIdentity(partnerSafe.address, 11, hash, hash, hash, "");
    await expect(contract.unsuspend(11)).to.be.revertedWithCustomError(contract, "IdentityStateInvalid");
    await contract.suspend(11);
    await contract.unsuspend(11);
    await contract.revoke(11);
    await expect(contract.suspend(11)).to.be.revertedWithCustomError(contract, "IdentityStateInvalid");
    await expect(contract.registryReassign(11, other.address)).to.be.revertedWithCustomError(contract, "IdentityStateInvalid");
    await expect(contract.updateHashes(11, hash, hash)).to.be.revertedWithCustomError(contract, "IdentityStateInvalid");
  });

  it("preserves identity data across registry reassignment", async function () {
    const { contract, partnerSafe, other } = await deploy();
    const propertyHash = ethers.keccak256(ethers.toUtf8Bytes("property"));
    const versionHash = ethers.keccak256(ethers.toUtf8Bytes("version"));
    const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
    await contract.mintIdentity(partnerSafe.address, 12, propertyHash, versionHash, evidenceHash, "ipfs://identity");
    await expect(contract.registryReassign(12, ethers.ZeroAddress)).to.be.reverted;
    await contract.registryReassign(12, other.address);
    const record = await contract.identityRecord(12);
    expect(await contract.ownerOf(12)).to.equal(other.address);
    expect(record.propertyReferenceHash).to.equal(propertyHash);
    expect(record.canonicalVersionHash).to.equal(versionHash);
    expect(record.evidencePackageHash).to.equal(evidenceHash);
    expect(record.status).to.equal(1);
    expect(await contract.tokenURI(12)).to.equal("ipfs://identity");
  });

  it("enforces role separation and emergency pause", async function () {
    const { contract, registrySafe, partnerSafe, attacker } = await deploy();
    const hash = ethers.keccak256(ethers.toUtf8Bytes("x"));
    await expect(contract.connect(attacker).mintIdentity(partnerSafe.address, 20, hash, hash, hash, "")).to.be.reverted;
    await expect(contract.connect(attacker).pause()).to.be.reverted;
    await contract.pause();
    await expect(contract.mintIdentity(partnerSafe.address, 20, hash, hash, hash, "")).to.be.revertedWithCustomError(contract, "EnforcedPause");
    await contract.unpause();
    await contract.mintIdentity(partnerSafe.address, 20, hash, hash, hash, "");
    const nextHash = ethers.keccak256(ethers.toUtf8Bytes("next"));
    await expect(contract.connect(attacker).updateHashes(20, nextHash, nextHash)).to.be.reverted;
    await contract.connect(registrySafe).updateHashes(20, nextHash, nextHash);
    expect((await contract.identityRecord(20)).canonicalVersionHash).to.equal(nextHash);
  });
});
