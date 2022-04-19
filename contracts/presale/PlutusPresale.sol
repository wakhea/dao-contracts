// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.7.5;

import "./Crowdsale.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PlutusPresale is Crowdsale, Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Timed Crowdsale
    uint256 public openingTime;
    uint256 public closingTime;
    uint256 public vestingStart;
    uint256 public vestingTime;

    uint256 public immutable VESTING_TIME_DECIMALS = 10000000;

    // Capped presale
    uint256 public cap;

    // Individually capped
    struct PreBuy {
        uint256 weiAmount;
        uint256 plusAmountClaimed;
    }

    mapping(address => PreBuy) public preBuys;
    uint256 public totalPlusToDistribute;

    uint256 public individualCap;

    /**
     * Event for crowdsale extending
     * @param newClosingTime new closing time
     * @param prevClosingTime old closing time
     */
    event TimedCrowdsaleExtended(uint256 prevClosingTime, uint256 newClosingTime);

    /**
     * @dev Reverts if not in crowdsale time range.
     */
    modifier onlyWhileOpen() {
        require(isOpen(), "TimedCrowdsale: not open");
        _;
    }

    modifier onlyWhileClosed() {
        require(hasClosed(), "TimedCrowdsale: not closed");
        _;
    }

    constructor(
        uint256 _rate,
        uint256 _rateDecimals,
        address payable _wallet,
        IERC20 _token,
        IERC20 _busd,
        uint256 _openingTime,
        uint256 _closingTime,
        uint256 _cap,
        uint256 _individualCap,
        uint256 _vestingTime,
        uint256 _vestingStart
    ) Crowdsale(_rate, _rateDecimals, _wallet, _token, _busd) {
        // solhint-disable-next-line not-rely-on-time
        require(_openingTime >= block.timestamp, "TimedCrowdsale: opening time is before current time");
        // solhint-disable-next-line max-line-length
        require(_closingTime > _openingTime, "TimedCrowdsale: opening time is not before closing time");

        openingTime = _openingTime;
        closingTime = _closingTime;

        require(_cap > 0, "CappedCrowdsale: cap is 0");
        cap = _cap;

        require(_individualCap > 0, "CappedCrowdsale: individual cap is 0");
        individualCap = _individualCap;

        require(_vestingStart > _closingTime, "Vesting start time is not before closing time");
        vestingStart = _vestingStart;
        vestingTime = _vestingTime;
    }

    /**
     * @return true if the crowdsale is open, false otherwise.
     */
    function isOpen() public view returns (bool) {
        // solhint-disable-next-line not-rely-on-time
        return block.timestamp >= openingTime && block.timestamp <= closingTime;
    }

    /**
     * @dev Checks whether the period in which the crowdsale is open has already elapsed.
     * @return Whether crowdsale period has elapsed
     */
    function hasClosed() public view returns (bool) {
        // solhint-disable-next-line not-rely-on-time
        return block.timestamp > closingTime;
    }

    /**
     * @dev Checks whether the cap has been reached.
     * @return Whether the cap was reached
     */
    function capReached() public view returns (bool) {
        return weiRaised >= cap;
    }

    /**
     * @dev Extend crowdsale.
     * @param newClosingTime Crowdsale closing time
     */
    function extendTime(uint256 newClosingTime) external onlyOwner {
        require(!hasClosed(), "TimedCrowdsale: already closed");
        // solhint-disable-next-line max-line-length
        require(newClosingTime > closingTime, "TimedCrowdsale: new closing time is before current closing time");

        emit TimedCrowdsaleExtended(closingTime, newClosingTime);
        closingTime = newClosingTime;
    }

    function updateCap(uint256 newCap) external onlyOwner {
        require(cap > 0, "CappedCrowdsale: cap is 0");
        cap = newCap;
    }

    function setIndividualCap(uint256 newIndividualCap) external onlyOwner {
        require(individualCap > 0, "CappedCrowdsale: individual cap is 0");
        individualCap = newIndividualCap;
    }

    function setVestingStart(uint256 newVestingStart) external onlyOwner {
        require(newVestingStart > block.timestamp, "Vesting time start should be after current date");
        vestingStart = newVestingStart;
    }

    /**
     * @dev Extend parent behavior requiring to be within contributing period.
     * @param beneficiary Token purchaser
     * @param weiAmount Amount of wei contributed
     */
    function _preValidatePurchase(address beneficiary, uint256 weiAmount) internal view override onlyWhileOpen {
        super._preValidatePurchase(beneficiary, weiAmount);
        require(weiRaised.add(weiAmount) <= cap, "CappedCrowdsale: cap exceeded");
        require(
            preBuys[beneficiary].weiAmount.add(weiAmount) <= individualCap,
            "CappedCrowdsale: beneficiary's cap exceeded"
        );
    }

    /**
     * @dev Extend parent behavior to update beneficiary preBuys.
     * @param beneficiary Token purchaser
     * @param weiAmount Amount of wei contributed
     */
    function _updatePurchasingState(address beneficiary, uint256 weiAmount) internal override {
        super._updatePurchasingState(beneficiary, weiAmount);
        preBuys[beneficiary].weiAmount = preBuys[beneficiary].weiAmount.add(weiAmount);
        totalPlusToDistribute = totalPlusToDistribute.add(_getTokenAmount(weiAmount));
    }

    function getPercentReleased() public view returns (uint256) {
        // if the presale is still open
        if (block.timestamp <= vestingStart) {
            return 0;
        } else if (block.timestamp > vestingStart.add(vestingTime)) {
            // already 100% released
            return VESTING_TIME_DECIMALS;
        } else {
            // not fully released
            return block.timestamp.sub(vestingStart).mul(VESTING_TIME_DECIMALS).div(vestingTime);
        }
    }

    // allows pre-salers to redeem their plus over time (vestingTime) once the presale is closed
    function redeemPlus(address beneficiary) public onlyWhileClosed {
        require(block.timestamp >= vestingStart, "Vesting period has not started yet");
        uint256 percentReleased = getPercentReleased();

        uint256 totalPlusToClaim = _getTokenAmount(preBuys[beneficiary].weiAmount).mul(percentReleased).div(
            VESTING_TIME_DECIMALS
        );
        uint256 plusToClaim = totalPlusToClaim.sub(preBuys[beneficiary].plusAmountClaimed);
        preBuys[beneficiary].plusAmountClaimed = preBuys[beneficiary].plusAmountClaimed.add(plusToClaim);

        token.safeTransfer(beneficiary, plusToClaim);
    }

    // Allows operator wallet to retreive the rgk that won't be distributed
    function retreiveExcessPlus() external onlyWhileClosed onlyOwner {
        token.safeTransfer(wallet, token.balanceOf(address(this)).sub(totalPlusToDistribute));
    }
}
