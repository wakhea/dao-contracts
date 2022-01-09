// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.7.5;

import "./Crowdsale.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PlutusPresale is Crowdsale, Ownable {
    using SafeMath for uint256;

    // Timed Crowdsale
    uint256 public openingTime;
    uint256 public closingTime;

    // Capped presale
    uint256 public cap;

    // Individually capped
    mapping(address => uint256) public contributions;
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

    constructor(
        uint256 _rate,
        address payable _wallet,
        IERC20 _token,
        uint256 _openingTime,
        uint256 _closingTime,
        uint256 _cap,
        uint256 _individualCap
    ) Crowdsale(_rate, _wallet, _token) {
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
        return _weiRaised >= cap;
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

    /**
     * @dev Extend parent behavior requiring to be within contributing period.
     * @param beneficiary Token purchaser
     * @param weiAmount Amount of wei contributed
     */
    function _preValidatePurchase(address beneficiary, uint256 weiAmount) internal view override onlyWhileOpen {
        super._preValidatePurchase(beneficiary, weiAmount);
        require(_weiRaised.add(weiAmount) <= cap, "CappedCrowdsale: cap exceeded");
        require(contributions[beneficiary].add(weiAmount) <= individualCap, "CappedCrowdsale: beneficiary's cap exceeded");
    }

    /**
     * @dev Extend parent behavior to update beneficiary contributions.
     * @param beneficiary Token purchaser
     * @param weiAmount Amount of wei contributed
     */
    function _updatePurchasingState(address beneficiary, uint256 weiAmount) internal override {
        super._updatePurchasingState(beneficiary, weiAmount);
        contributions[beneficiary] = contributions[beneficiary].add(weiAmount);
    }
}
