// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;

import "../interfaces/IERC20.sol";
import "../types/Ownable.sol";

contract PlusFaucet is Ownable {
    IERC20 public plus;

    constructor(address _plus) {
        plus = IERC20(_plus);
    }

    function setPlus(address _plus) external onlyOwner {
        plus = IERC20(_plus);
    }

    function dispense() external {
        plus.transfer(msg.sender, 1e9);
    }
}
