// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface ITokenLock {
    struct LockParams {
        address payable owner; // the user who can withdraw tokens once the lock expires.
        uint256 amount; // amount of tokens to lock
        uint256 startEmission; // 0 if lock type 1, else a unix timestamp
        uint256 endEmission; // the unlock date as a unix timestamp (in seconds)
        address condition; // address(0) = no condition, otherwise the condition must implement IUnlockCondition
    }

    function lock(address _token, LockParams[] calldata _lock_params) external;

    function NONCE() external view returns(uint);

    function withdraw (uint256 _lockID, uint256 _amount) external;

    function getWithdrawableTokens (uint256 _lockID) external view returns (uint256);

    function getLock (uint256 _lockID) external view returns (uint256, address, uint256, uint256, uint256, uint256, uint256, uint256, address, address);
}
