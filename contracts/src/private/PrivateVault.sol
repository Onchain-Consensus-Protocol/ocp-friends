// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title PrivateVault
 * @notice Invitation-only OCP vault with either the original capital-majority
 *         resolution rule or a final result submitted by the creator.
 * @dev Staking, settlement and withdrawal intentionally mirror OCPVault.
 */
contract PrivateVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_ALLOWED_WALLETS = 100;

    enum Side {
        YES,
        NO,
        INVALID
    }
    enum Outcome {
        PENDING,
        YES,
        NO,
        INVALID
    }
    enum ResolutionMode {
        CORE_RULES,
        CREATOR_RESOLVED
    }

    IERC20 public immutable stakeToken;
    address public immutable factory;
    address public immutable creator;
    ResolutionMode public immutable resolutionMode;
    uint256 public immutable stakeEndTime;
    uint256 public immutable resolutionDeadline;
    uint256 public immutable minStake;

    struct StakeInfo {
        uint256 yes;
        uint256 no;
        uint256 invalid;
    }

    mapping(address => bool) public allowedWallets;
    mapping(address => bool) public hasParticipated;
    uint256 public allowedWalletCount;
    mapping(address => StakeInfo) private _stakeOf;
    mapping(address => bool) private _claimed;
    uint256[3] private _totalStakeBySide;
    uint256[3] private _participantCountBySide;
    uint256 private _totalPrincipal;
    uint256 private _totalParticipants;

    bool public finalized;
    Outcome public resolvedOutcome;
    uint256 public remainingEligibleClaims;
    uint256 public settlementPool;

    event WalletAllowed(address indexed wallet);
    event WalletRemoved(address indexed wallet);
    event Staked(address indexed user, Side indexed side, uint256 amount, uint256 totalAmount);
    event Finalized(Outcome outcome, uint256 totalYes, uint256 totalNo, uint256 totalInvalid);
    event CreatorResolved(address indexed creator, Outcome outcome, uint256 timestamp);
    event ResolutionExpired(uint256 timestamp);
    event Withdrawn(address indexed user, uint256 payout);

    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator");
        _;
    }

    modifier onlyAllowedWallet() {
        require(allowedWallets[msg.sender], "Wallet not invited");
        _;
    }

    constructor(
        address factory_,
        address creator_,
        address stakeToken_,
        ResolutionMode resolutionMode_,
        uint256 stakeEndTime_,
        uint256 resolutionDeadline_,
        uint256 minStake_,
        address[] memory initiallyAllowedWallets
    ) {
        require(factory_ != address(0), "Invalid factory");
        require(creator_ != address(0), "Invalid creator");
        require(stakeToken_ != address(0), "Invalid token");
        require(stakeEndTime_ > block.timestamp, "Invalid stake end time");
        require(minStake_ > 0, "Invalid min stake");
        if (resolutionMode_ == ResolutionMode.CREATOR_RESOLVED) {
            require(resolutionDeadline_ > stakeEndTime_, "Invalid resolution deadline");
        } else {
            require(resolutionDeadline_ == 0, "Unexpected resolution deadline");
        }

        factory = factory_;
        creator = creator_;
        stakeToken = IERC20(stakeToken_);
        resolutionMode = resolutionMode_;
        stakeEndTime = stakeEndTime_;
        resolutionDeadline = resolutionDeadline_;
        minStake = minStake_;
        resolvedOutcome = Outcome.PENDING;

        _allowWallet(creator_);
        for (uint256 i; i < initiallyAllowedWallets.length; ++i) {
            address wallet = initiallyAllowedWallets[i];
            require(wallet != address(0), "Invalid allowed wallet");
            _allowWallet(wallet);
        }
    }

    function protocolVersion() external pure returns (uint256) {
        return 1;
    }

    function resolutionTime() external view returns (uint256) {
        return stakeEndTime;
    }

    function resolved() external view returns (bool) {
        return finalized;
    }

    function outcome() external view returns (Outcome) {
        return resolvedOutcome;
    }

    function totalPrincipal() external view returns (uint256) {
        return _totalPrincipal;
    }

    function totalStakeYes() external view returns (uint256) {
        return _totalStakeBySide[0];
    }

    function totalStakeNo() external view returns (uint256) {
        return _totalStakeBySide[1];
    }

    function totalStakeInvalid() external view returns (uint256) {
        return _totalStakeBySide[2];
    }

    function stakeOf(address user) external view returns (uint256, uint256, uint256) {
        StakeInfo storage info = _stakeOf[user];
        return (info.yes, info.no, info.invalid);
    }

    function sideOf(address user) public view returns (Side side, bool hasPosition) {
        StakeInfo storage info = _stakeOf[user];
        if (info.yes > 0) return (Side.YES, true);
        if (info.no > 0) return (Side.NO, true);
        if (info.invalid > 0) return (Side.INVALID, true);
        return (Side.YES, false);
    }

    function hasClaimed(address user) external view returns (bool) {
        return _claimed[user];
    }

    function canResolve() public view returns (bool) {
        return !finalized && block.timestamp >= stakeEndTime;
    }

    function canResolveByCreator(address account) external view returns (bool) {
        return account == creator && resolutionMode == ResolutionMode.CREATOR_RESOLVED && !finalized
            && block.timestamp >= stakeEndTime && block.timestamp <= resolutionDeadline;
    }

    function canFinalizeExpiredResolution() external view returns (bool) {
        return !finalized && resolutionMode == ResolutionMode.CREATOR_RESOLVED
            && block.timestamp > resolutionDeadline;
    }

    function addAllowedWallets(address[] calldata wallets) external onlyCreator {
        require(block.timestamp < stakeEndTime, "Whitelist frozen");
        for (uint256 i; i < wallets.length; ++i) {
            require(wallets[i] != address(0), "Invalid allowed wallet");
            _allowWallet(wallets[i]);
        }
    }

    function removeAllowedWallet(address wallet) external onlyCreator {
        require(block.timestamp < stakeEndTime, "Whitelist frozen");
        require(wallet != creator, "Cannot remove creator");
        require(!hasParticipated[wallet], "Wallet already participated");
        require(allowedWallets[wallet], "Wallet not invited");
        allowedWallets[wallet] = false;
        --allowedWalletCount;
        emit WalletRemoved(wallet);
    }

    function stake(Side side, uint256 amount) external onlyAllowedWallet nonReentrant {
        require(!finalized, "Already finalized");
        require(block.timestamp < stakeEndTime, "Staking ended");
        require(amount >= minStake, "Amount below min stake");

        StakeInfo storage info = _stakeOf[msg.sender];
        (Side currentSide, bool hasPosition) = sideOf(msg.sender);
        require(!hasPosition || currentSide == side, "Position is locked to one side");

        // 按实际余额变化验证入账，避免收费币或伪成功代币制造没有资产支持的本金。
        uint256 balanceBefore = stakeToken.balanceOf(address(this));
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = stakeToken.balanceOf(address(this));
        require(
            balanceAfter >= balanceBefore && balanceAfter - balanceBefore == amount,
            "Unsupported token transfer"
        );
        uint256 index = uint256(side);
        if (!hasPosition) {
            hasParticipated[msg.sender] = true;
            _participantCountBySide[index] += 1;
            _totalParticipants += 1;
        }
        uint256 newAmount = _userPrincipal(info) + amount;
        _setSideAmount(info, side, newAmount);
        _totalStakeBySide[index] += amount;
        _totalPrincipal += amount;
        emit Staked(msg.sender, side, amount, newAmount);
    }

    function finalizeByCoreRules() external nonReentrant {
        require(resolutionMode == ResolutionMode.CORE_RULES, "Wrong resolution mode");
        require(!finalized, "Already finalized");
        require(block.timestamp >= stakeEndTime, "Staking not ended");
        _finalize(_deriveOutcome());
    }

    function resolveByCreator(Outcome outcome_) external onlyCreator nonReentrant {
        require(resolutionMode == ResolutionMode.CREATOR_RESOLVED, "Wrong resolution mode");
        require(!finalized, "Already resolved");
        require(block.timestamp >= stakeEndTime, "Stake period active");
        require(block.timestamp <= resolutionDeadline, "Resolution period expired");
        require(outcome_ != Outcome.PENDING, "Invalid outcome");
        _finalize(outcome_);
        emit CreatorResolved(creator, resolvedOutcome, block.timestamp);
    }

    function finalizeExpiredResolution() external nonReentrant {
        require(resolutionMode == ResolutionMode.CREATOR_RESOLVED, "Wrong resolution mode");
        require(!finalized, "Already resolved");
        require(block.timestamp > resolutionDeadline, "Resolution period active");
        _finalize(Outcome.INVALID);
        emit ResolutionExpired(block.timestamp);
    }

    function withdraw() external nonReentrant {
        require(finalized, "Not finalized");
        require(!_claimed[msg.sender], "Already claimed");
        StakeInfo storage info = _stakeOf[msg.sender];
        uint256 principal = _userPrincipal(info);
        require(principal > 0, "No stake");

        (Side userSide,) = sideOf(msg.sender);
        bool eligible = resolvedOutcome == Outcome.INVALID
            || (resolvedOutcome == Outcome.YES && userSide == Side.YES)
            || (resolvedOutcome == Outcome.NO && userSide == Side.NO);
        _claimed[msg.sender] = true;

        uint256 payout;
        if (eligible) {
            require(remainingEligibleClaims > 0, "No eligible claims");
            if (remainingEligibleClaims == 1) {
                // 产品规则：最后一位有资格领取的人拿走 Vault 当前全部余额。
                // 因此 finalize 后、最后一次领取执行前直接转入的 USDC 也归该领取者。
                payout = stakeToken.balanceOf(address(this));
            } else {
                uint256 denominator = resolvedOutcome == Outcome.INVALID
                    ? _totalPrincipal
                    : _totalStakeBySide[resolvedOutcome == Outcome.YES ? 0 : 1];
                payout = Math.mulDiv(settlementPool, principal, denominator);
            }
            remainingEligibleClaims -= 1;
        }
        if (payout > 0) stakeToken.safeTransfer(msg.sender, payout);
        emit Withdrawn(msg.sender, payout);
    }

    function _allowWallet(address wallet) private {
        if (allowedWallets[wallet]) return;
        require(allowedWalletCount < MAX_ALLOWED_WALLETS, "Too many allowed wallets");
        allowedWallets[wallet] = true;
        ++allowedWalletCount;
        emit WalletAllowed(wallet);
    }

    function _finalize(Outcome outcome_) private {
        if (_totalPrincipal == 0) outcome_ = Outcome.INVALID;
        resolvedOutcome = outcome_;
        finalized = true;
        settlementPool = stakeToken.balanceOf(address(this));
        remainingEligibleClaims = outcome_ == Outcome.INVALID
            ? _totalParticipants
            : _participantCountBySide[outcome_ == Outcome.YES ? 0 : 1];
        emit Finalized(outcome_, _totalStakeBySide[0], _totalStakeBySide[1], _totalStakeBySide[2]);
    }

    function _deriveOutcome() private view returns (Outcome) {
        if (_totalStakeBySide[0] > _totalPrincipal - _totalStakeBySide[0]) return Outcome.YES;
        if (_totalStakeBySide[1] > _totalPrincipal - _totalStakeBySide[1]) return Outcome.NO;
        return Outcome.INVALID;
    }

    function _setSideAmount(StakeInfo storage info, Side side, uint256 amount) private {
        info.yes = side == Side.YES ? amount : 0;
        info.no = side == Side.NO ? amount : 0;
        info.invalid = side == Side.INVALID ? amount : 0;
    }

    function _userPrincipal(StakeInfo storage info) private view returns (uint256) {
        return info.yes + info.no + info.invalid;
    }
}
