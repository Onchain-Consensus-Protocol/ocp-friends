// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../private/PrivateVault.sol";

/**
 *  @title PrivateVaultFactory @notice Permissionless factory for invitation-only OCP vaults.
 */
contract PrivateVaultFactory {
    uint256 public constant MAX_ALLOWED_WALLETS = 100;
    uint256 public constant MAX_PAGE_SIZE = 100;
    address public immutable stakeToken;

    struct PrivateVaultParams {
        string claim;
        string description;
        address stakeToken;
        PrivateVault.ResolutionMode resolutionMode;
        uint256 stakePeriod;
        uint256 resolutionPeriod;
        uint256 minStake;
        address[] allowedWallets;
    }

    struct VaultMeta {
        string claim;
        string description;
    }

    address[] public allPrivateVaults;
    mapping(address => address[]) private _creatorPrivateVaults;
    mapping(address => bool) public isPrivateVault;
    mapping(address => VaultMeta) private _metaByVault;

    event PrivateVaultCreated(
        address indexed vault,
        address indexed creator,
        PrivateVault.ResolutionMode resolutionMode,
        uint256 stakeEndTime
    );

    constructor(address stakeToken_) {
        require(stakeToken_ != address(0), "Invalid token");
        require(stakeToken_.code.length > 0, "Token has no code");
        stakeToken = stakeToken_;
    }

    function createPrivateVault(PrivateVaultParams calldata params)
        external
        returns (address vault)
    {
        // Factory 在部署时绑定唯一结算代币；前端配置不能绕过此链上约束。
        require(params.stakeToken == stakeToken, "Unsupported stake token");
        require(params.stakePeriod > 0, "Invalid stake period");
        require(params.minStake > 0, "Invalid min stake");
        require(params.allowedWallets.length <= MAX_ALLOWED_WALLETS, "Too many allowed wallets");
        if (params.resolutionMode == PrivateVault.ResolutionMode.CREATOR_RESOLVED) {
            require(params.resolutionPeriod > 0, "Invalid resolution period");
        } else {
            require(params.resolutionPeriod == 0, "Unexpected resolution period");
        }

        uint256 uniqueWallets = 1;
        for (uint256 i; i < params.allowedWallets.length; ++i) {
            address wallet = params.allowedWallets[i];
            require(wallet != address(0), "Invalid allowed wallet");
            if (wallet == msg.sender) continue;
            bool duplicate;
            for (uint256 j; j < i; ++j) {
                if (params.allowedWallets[j] == wallet) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) ++uniqueWallets;
        }
        require(uniqueWallets <= MAX_ALLOWED_WALLETS, "Too many allowed wallets");

        uint256 stakeEndTime = block.timestamp + params.stakePeriod;
        uint256 resolutionDeadline = params.resolutionMode
            == PrivateVault.ResolutionMode.CREATOR_RESOLVED
            ? stakeEndTime + params.resolutionPeriod
            : 0;

        PrivateVault privateVault = new PrivateVault(
            address(this),
            msg.sender,
            params.stakeToken,
            params.resolutionMode,
            stakeEndTime,
            resolutionDeadline,
            params.minStake,
            params.allowedWallets
        );
        vault = address(privateVault);
        allPrivateVaults.push(vault);
        _creatorPrivateVaults[msg.sender].push(vault);
        isPrivateVault[vault] = true;
        _metaByVault[vault] = VaultMeta({claim: params.claim, description: params.description});
        emit PrivateVaultCreated(vault, msg.sender, params.resolutionMode, stakeEndTime);
    }

    function privateVaultCount() external view returns (uint256) {
        return allPrivateVaults.length;
    }

    function getPrivateVaults(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory vaults)
    {
        require(limit > 0 && limit <= MAX_PAGE_SIZE, "Invalid page size");
        uint256 count = allPrivateVaults.length;
        if (offset >= count) return new address[](0);

        uint256 remaining = count - offset;
        uint256 pageLength = limit < remaining ? limit : remaining;
        uint256 end = offset + pageLength;
        vaults = new address[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            vaults[i - offset] = allPrivateVaults[i];
        }
    }

    function creatorPrivateVaultCount(address creator) external view returns (uint256) {
        return _creatorPrivateVaults[creator].length;
    }

    function getCreatorPrivateVaults(address creator, uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory vaults)
    {
        require(limit > 0 && limit <= MAX_PAGE_SIZE, "Invalid page size");
        address[] storage creatorVaults = _creatorPrivateVaults[creator];
        uint256 count = creatorVaults.length;
        if (offset >= count) return new address[](0);

        uint256 remaining = count - offset;
        uint256 pageLength = limit < remaining ? limit : remaining;
        vaults = new address[](pageLength);
        for (uint256 i; i < pageLength; ++i) {
            vaults[i] = creatorVaults[offset + i];
        }
    }

    function getPrivateVaultMeta(address vault)
        external
        view
        returns (string memory claim, string memory description)
    {
        VaultMeta storage meta = _metaByVault[vault];
        return (meta.claim, meta.description);
    }
}
