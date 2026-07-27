// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @notice Privacy-safe, non-tradable property identity registry token.
/// @dev The single Fixer.guru registry wallet owns tokens and roles. Agency
/// wallets are attached as independent representation records; they never own
/// or transfer the canonical identity token.
contract Bep721PropertyIdentityToken is ERC721, AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERSION_ROLE = keccak256("VERSION_ROLE");
    bytes32 public constant SUSPENDER_ROLE = keccak256("SUSPENDER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");
    bytes32 public constant REASSIGNER_ROLE = keccak256("REASSIGNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant REPRESENTATION_ROLE = keccak256("REPRESENTATION_ROLE");

    enum RegistryStatus { NONE, ACTIVE, SUSPENDED, REVOKED, SUPERSEDED }
    enum RepresentationStatus { NONE, ACTIVE, SUSPENDED, REVOKED }

    struct IdentityRecord {
        bytes32 propertyReferenceHash;
        bytes32 canonicalVersionHash;
        bytes32 evidencePackageHash;
        RegistryStatus status;
    }

    struct RepresentationRecord {
        bytes32 evidenceHash;
        uint64 validFrom;
        uint64 validUntil;
        RepresentationStatus status;
    }

    mapping(uint256 tokenId => IdentityRecord) private _records;
    mapping(uint256 tokenId => string) private _tokenUris;
    mapping(uint256 tokenId => mapping(address agencyWallet => RepresentationRecord)) private _representations;

    error HolderOperationForbidden();
    error IdentityStateInvalid(uint256 tokenId, RegistryStatus status);
    error ZeroHashForbidden();
    error RepresentationStateInvalid(uint256 tokenId, address agencyWallet, RepresentationStatus status);
    error ValidityRangeInvalid();
    error RegistryWalletMismatch();

    event IdentityMinted(uint256 indexed tokenId, address indexed registryWallet, bytes32 indexed propertyReferenceHash);
    event IdentityHashesUpdated(uint256 indexed tokenId, bytes32 canonicalVersionHash, bytes32 evidencePackageHash);
    event IdentityStatusChanged(uint256 indexed tokenId, RegistryStatus previousStatus, RegistryStatus nextStatus);
    event RegistryReassigned(uint256 indexed tokenId, address indexed previousSafe, address indexed nextSafe);
    event RepresentationAttested(uint256 indexed tokenId, address indexed agencyWallet, bytes32 indexed evidenceHash, uint64 validFrom, uint64 validUntil);
    event RepresentationStatusChanged(uint256 indexed tokenId, address indexed agencyWallet, RepresentationStatus previousStatus, RepresentationStatus nextStatus);

    constructor(address registryAdminWallet) ERC721("IREPN Property Identity", "IREPN-ID") {
        if (registryAdminWallet == address(0)) revert ERC721InvalidOwner(address(0));
        _grantRole(DEFAULT_ADMIN_ROLE, registryAdminWallet);
        _grantRole(ISSUER_ROLE, registryAdminWallet);
        _grantRole(VERSION_ROLE, registryAdminWallet);
        _grantRole(SUSPENDER_ROLE, registryAdminWallet);
        _grantRole(REVOKER_ROLE, registryAdminWallet);
        _grantRole(REASSIGNER_ROLE, registryAdminWallet);
        _grantRole(PAUSER_ROLE, registryAdminWallet);
        _grantRole(REPRESENTATION_ROLE, registryAdminWallet);
    }

    function mintIdentity(
        address registryWallet,
        uint256 tokenId,
        bytes32 propertyReferenceHash,
        bytes32 canonicalVersionHash,
        bytes32 evidencePackageHash,
        string calldata uri
    ) external onlyRole(ISSUER_ROLE) whenNotPaused {
        if (registryWallet == address(0)) revert ERC721InvalidReceiver(address(0));
        if (registryWallet != msg.sender) revert RegistryWalletMismatch();
        if (propertyReferenceHash == bytes32(0) || canonicalVersionHash == bytes32(0) || evidencePackageHash == bytes32(0)) revert ZeroHashForbidden();
        _safeMint(registryWallet, tokenId);
        _records[tokenId] = IdentityRecord(propertyReferenceHash, canonicalVersionHash, evidencePackageHash, RegistryStatus.ACTIVE);
        _tokenUris[tokenId] = uri;
        emit IdentityMinted(tokenId, registryWallet, propertyReferenceHash);
    }

    function representationOf(uint256 tokenId, address agencyWallet) external view returns (RepresentationRecord memory) {
        _requireOwned(tokenId);
        return _representations[tokenId][agencyWallet];
    }

    function attestRepresentation(uint256 tokenId, address agencyWallet, bytes32 evidenceHash, uint64 validFrom, uint64 validUntil) external onlyRole(REPRESENTATION_ROLE) whenNotPaused {
        _requireActiveOrSuspended(tokenId);
        if (agencyWallet == address(0)) revert ERC721InvalidReceiver(address(0));
        if (evidenceHash == bytes32(0)) revert ZeroHashForbidden();
        if (validUntil != 0 && validUntil <= validFrom) revert ValidityRangeInvalid();
        RepresentationStatus previous = _representations[tokenId][agencyWallet].status;
        if (previous == RepresentationStatus.ACTIVE || previous == RepresentationStatus.SUSPENDED) revert RepresentationStateInvalid(tokenId, agencyWallet, previous);
        _representations[tokenId][agencyWallet] = RepresentationRecord(evidenceHash, validFrom, validUntil, RepresentationStatus.ACTIVE);
        emit RepresentationAttested(tokenId, agencyWallet, evidenceHash, validFrom, validUntil);
    }

    function suspendRepresentation(uint256 tokenId, address agencyWallet) external onlyRole(REPRESENTATION_ROLE) {
        _setRepresentationStatus(tokenId, agencyWallet, RepresentationStatus.ACTIVE, RepresentationStatus.SUSPENDED);
    }

    function reactivateRepresentation(uint256 tokenId, address agencyWallet) external onlyRole(REPRESENTATION_ROLE) {
        _setRepresentationStatus(tokenId, agencyWallet, RepresentationStatus.SUSPENDED, RepresentationStatus.ACTIVE);
    }

    function revokeRepresentation(uint256 tokenId, address agencyWallet) external onlyRole(REPRESENTATION_ROLE) {
        _requireOwned(tokenId);
        RepresentationStatus previous = _representations[tokenId][agencyWallet].status;
        if (previous != RepresentationStatus.ACTIVE && previous != RepresentationStatus.SUSPENDED) revert RepresentationStateInvalid(tokenId, agencyWallet, previous);
        _representations[tokenId][agencyWallet].status = RepresentationStatus.REVOKED;
        emit RepresentationStatusChanged(tokenId, agencyWallet, previous, RepresentationStatus.REVOKED);
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

    function _setRepresentationStatus(uint256 tokenId, address agencyWallet, RepresentationStatus expected, RepresentationStatus next) private {
        _requireOwned(tokenId);
        RepresentationStatus previous = _representations[tokenId][agencyWallet].status;
        if (previous != expected) revert RepresentationStateInvalid(tokenId, agencyWallet, previous);
        _representations[tokenId][agencyWallet].status = next;
        emit RepresentationStatusChanged(tokenId, agencyWallet, previous, next);
    }
}
