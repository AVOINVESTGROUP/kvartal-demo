// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Privacy-safe, non-tradable property identity registry token.
/// @dev Partner Corporate Safes own tokens; the IREPN Registry/Admin Safe owns roles.
contract Bep721PropertyIdentityToken is ERC721, AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERSION_ROLE = keccak256("VERSION_ROLE");
    bytes32 public constant SUSPENDER_ROLE = keccak256("SUSPENDER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");
    bytes32 public constant REASSIGNER_ROLE = keccak256("REASSIGNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum RegistryStatus { NONE, ACTIVE, SUSPENDED, REVOKED, SUPERSEDED }

    struct IdentityRecord {
        bytes32 propertyReferenceHash;
        bytes32 canonicalVersionHash;
        bytes32 evidencePackageHash;
        RegistryStatus status;
    }

    mapping(uint256 tokenId => IdentityRecord) private _records;
    mapping(uint256 tokenId => string) private _tokenUris;

    error HolderOperationForbidden();
    error IdentityStateInvalid(uint256 tokenId, RegistryStatus status);
    error ZeroHashForbidden();

    event IdentityMinted(uint256 indexed tokenId, address indexed corporateSafe, bytes32 indexed propertyReferenceHash);
    event IdentityHashesUpdated(uint256 indexed tokenId, bytes32 canonicalVersionHash, bytes32 evidencePackageHash);
    event IdentityStatusChanged(uint256 indexed tokenId, RegistryStatus previousStatus, RegistryStatus nextStatus);
    event RegistryReassigned(uint256 indexed tokenId, address indexed previousSafe, address indexed nextSafe);

    constructor(address registryAdminSafe) ERC721("IREPN Property Identity", "IREPN-ID") {
        if (registryAdminSafe == address(0)) revert ERC721InvalidOwner(address(0));
        _grantRole(DEFAULT_ADMIN_ROLE, registryAdminSafe);
        _grantRole(ISSUER_ROLE, registryAdminSafe);
        _grantRole(VERSION_ROLE, registryAdminSafe);
        _grantRole(SUSPENDER_ROLE, registryAdminSafe);
        _grantRole(REVOKER_ROLE, registryAdminSafe);
        _grantRole(REASSIGNER_ROLE, registryAdminSafe);
        _grantRole(PAUSER_ROLE, registryAdminSafe);
    }

    function mintIdentity(
        address corporateSafe,
        uint256 tokenId,
        bytes32 propertyReferenceHash,
        bytes32 canonicalVersionHash,
        bytes32 evidencePackageHash,
        string calldata uri
    ) external onlyRole(ISSUER_ROLE) whenNotPaused {
        if (corporateSafe == address(0)) revert ERC721InvalidReceiver(address(0));
        if (propertyReferenceHash == bytes32(0) || canonicalVersionHash == bytes32(0) || evidencePackageHash == bytes32(0)) revert ZeroHashForbidden();
        _safeMint(corporateSafe, tokenId);
        _records[tokenId] = IdentityRecord(propertyReferenceHash, canonicalVersionHash, evidencePackageHash, RegistryStatus.ACTIVE);
        _tokenUris[tokenId] = uri;
        emit IdentityMinted(tokenId, corporateSafe, propertyReferenceHash);
    }

    function identityRecord(uint256 tokenId) external view returns (IdentityRecord memory) {
        _requireOwned(tokenId);
        return _records[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenUris[tokenId];
    }

    function updateHashes(uint256 tokenId, bytes32 canonicalVersionHash, bytes32 evidencePackageHash) external onlyRole(VERSION_ROLE) whenNotPaused {
        _requireActiveOrSuspended(tokenId);
        if (canonicalVersionHash == bytes32(0) || evidencePackageHash == bytes32(0)) revert ZeroHashForbidden();
        _records[tokenId].canonicalVersionHash = canonicalVersionHash;
        _records[tokenId].evidencePackageHash = evidencePackageHash;
        emit IdentityHashesUpdated(tokenId, canonicalVersionHash, evidencePackageHash);
    }

    function suspend(uint256 tokenId) external onlyRole(SUSPENDER_ROLE) { _setStatus(tokenId, RegistryStatus.ACTIVE, RegistryStatus.SUSPENDED); }
    function unsuspend(uint256 tokenId) external onlyRole(SUSPENDER_ROLE) { _setStatus(tokenId, RegistryStatus.SUSPENDED, RegistryStatus.ACTIVE); }

    function revoke(uint256 tokenId) external onlyRole(REVOKER_ROLE) {
        _requireOwned(tokenId);
        RegistryStatus previous = _records[tokenId].status;
        if (previous != RegistryStatus.ACTIVE && previous != RegistryStatus.SUSPENDED) revert IdentityStateInvalid(tokenId, previous);
        _records[tokenId].status = RegistryStatus.REVOKED;
        emit IdentityStatusChanged(tokenId, previous, RegistryStatus.REVOKED);
    }

    function registryReassign(uint256 tokenId, address nextCorporateSafe) external onlyRole(REASSIGNER_ROLE) whenNotPaused {
        if (nextCorporateSafe == address(0)) revert ERC721InvalidReceiver(address(0));
        _requireActiveOrSuspended(tokenId);
        address previous = ownerOf(tokenId);
        _update(nextCorporateSafe, tokenId, address(0));
        emit RegistryReassigned(tokenId, previous, nextCorporateSafe);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    function approve(address, uint256) public pure override { revert HolderOperationForbidden(); }
    function setApprovalForAll(address, bool) public pure override { revert HolderOperationForbidden(); }
    function transferFrom(address, address, uint256) public pure override { revert HolderOperationForbidden(); }
    function safeTransferFrom(address, address, uint256, bytes memory) public pure override { revert HolderOperationForbidden(); }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _setStatus(uint256 tokenId, RegistryStatus expected, RegistryStatus next) private {
        _requireOwned(tokenId);
        RegistryStatus previous = _records[tokenId].status;
        if (previous != expected) revert IdentityStateInvalid(tokenId, previous);
        _records[tokenId].status = next;
        emit IdentityStatusChanged(tokenId, previous, next);
    }

    function _requireActiveOrSuspended(uint256 tokenId) private view {
        _requireOwned(tokenId);
        RegistryStatus status = _records[tokenId].status;
        if (status != RegistryStatus.ACTIVE && status != RegistryStatus.SUSPENDED) revert IdentityStateInvalid(tokenId, status);
    }
}
