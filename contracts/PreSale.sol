// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ITokenLock.sol";
import "./interfaces/IAerodromeRouter.sol";
import {ud60x18} from "@prb/math/src/UD60x18.sol";
import {ISablierV2LockupLinear} from "@sablier/v2-core/src/interfaces/ISablierV2LockupLinear.sol";
import {Broker, LockupLinear} from "@sablier/v2-core/src/types/DataTypes.sol";

contract PreSale is Ownable {
    IERC20 public investmentToken;
    IERC20 public icoToken;
    uint256 public threshold;
    uint256 public totalInvested;
    address public uniswapRouterAddress;
    address public aerodromeRouterAddress;
    address public treasury;
    address pair;
    bool isUniswapPair;
    uint256 conversionRate; // Ico token per investment token, ie. 1WETH = 3ICO, the value would be 3
    ITokenLock public UNCXLock;
    bool public allowWithdraw = false;
    uint256 public lockId = 0;
    Broker public broker;
    ISablierV2LockupLinear public sablierLinear;

    mapping(address => uint256) public investments;

    struct VestingRange {
        uint256 startRange;
        uint256 endRange;
        uint40 cliff;
        uint40 endingDuration;
    }

    VestingRange[] public vestingRanges;

    event Investment(
        address indexed investor,
        uint256 invested,
        uint256 received,
        uint256 sablierStreamId
    );

    event LiquidityPoolCreated(
        address indexed pair,
        uint256 amountETH,
        uint256 amountToken,
        uint256 lockId
    );

    modifier poolNotCreated() {
        require(lockId == 0, "Pool has been already creatd");
        _;
    }

    constructor(
        IERC20 _investmentToken,
        IERC20 _icoToken,
        uint256 _threshold,
        address _uniswapRouterAddress,
        address _aerodromeRouterAddress,
        uint256 _conversionRate,
        ITokenLock _UNCXLock,
        Broker memory _broker,
        ISablierV2LockupLinear _sablierLinear
    ) Ownable(msg.sender) {
        investmentToken = _investmentToken;
        icoToken = _icoToken;
        threshold = _threshold;
        uniswapRouterAddress = _uniswapRouterAddress;
        aerodromeRouterAddress = _aerodromeRouterAddress;
        conversionRate = _conversionRate;
        UNCXLock = _UNCXLock;
        broker = _broker;
        sablierLinear = _sablierLinear;

        // Giving infinite approval to sablier for ICO token
        icoToken.approve(address(sablierLinear), type(uint256).max);

        // Set Default range of cliff and end duration
        vestingRanges.push(
            VestingRange(0, type(uint256).max, 30 days, 150 days)
        );
    }

    // -------------------------------------------------------------------------------------
    // Admin methods
    // -------------------------------------------------------------------------------------
    /**
     * @notice Allows to setup the treasury address to transfer the ICO tokens.
     * @dev This method should get executed alteast once before starting Presale.
     * @param _treasury Address of treasury
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(
            icoToken.allowance(_treasury, address(this)) >=
                (threshold - totalInvested) * conversionRate,
            "Insufficient allowance"
        );
        treasury = _treasury;
    }

    /**
     * @notice Allow admin to update the vesting range along with cliff and duration of vesting.
     * @param index index from vestingRanges
     * @param _vestingRange updated range for the index
     */
    function setVestingRange(
        uint256 index,
        VestingRange calldata _vestingRange
    ) external onlyOwner {
        if (index == 0) {
            vestingRanges[0].cliff = _vestingRange.cliff;
            vestingRanges[0].endingDuration = _vestingRange.endingDuration;
        } else {
            require(index < vestingRanges.length, "Invalid index");
            vestingRanges[index] = _vestingRange;
        }
    }

    /**
     * @notice Allow to create a new range with new cliff and duration
     * @param _vestingRange New range for vesting cliff and duration
     */
    function addVestingRange(
        VestingRange calldata _vestingRange
    ) external onlyOwner {
        uint256 vestingLength = vestingRanges.length;
        VestingRange memory lastVestingRange = vestingRanges[vestingLength - 1];
        if (vestingLength > 1) {
            require(
                _vestingRange.startRange > lastVestingRange.endRange,
                "Invalid Start Range"
            );
        }
        require(
            _vestingRange.endRange > _vestingRange.startRange,
            "Invalid End Range"
        );
        vestingRanges.push(_vestingRange);
    }

    /**
     * @dev This method is being used to calculat dynamic cliff and duration
     * @param investedAmount amount to calculate the cliff and duration
     * @return returns cliff and duration in LockupLinear.Durations struct
     */
    function getDuration(
        uint256 investedAmount
    ) private view returns (LockupLinear.Durations memory) {
        uint256 vestingLength = vestingRanges.length;

        for (uint256 i = 1; i < vestingLength; i++) {
            VestingRange memory _vestingRange = vestingRanges[i];
            if (
                investedAmount > _vestingRange.startRange &&
                investedAmount <= _vestingRange.endRange
            ) {
                return
                    LockupLinear.Durations(
                        _vestingRange.cliff,
                        _vestingRange.endingDuration
                    );
            }
        }
        return
            LockupLinear.Durations(
                vestingRanges[0].cliff,
                vestingRanges[0].endingDuration
            );
    }

    /**
     * @notice Allows admin to change the broker details for vesting
     * @param _broker Broker details for Sablier vesting
     */
    function setBroker(Broker calldata _broker) external onlyOwner {
        broker = _broker;
    }

    /**
     * @notice Allows admin to change the threshold
     * @param _threshold new threshold for PreSale
     */
    function setThreshold(uint _threshold) external onlyOwner {
        require(
            totalInvested < _threshold,
            "The investment should be more than current investment"
        );
        threshold = _threshold;
    }

    /**
     * @notice Allows admin to conclude the presale, create the LP token and lock then in UNCX for 180 days
     * @param _icoTokenAmount The ICO token amount that will be used to create LP against WETH
     * @param createUniswapPool The DEX, true for Uniswap, false for Aerodrome
     */
    function createLiquidityPool(
        uint256 _icoTokenAmount,
        bool createUniswapPool
    ) external onlyOwner poolNotCreated {
        // Transfer ICO token in Presale
        require(
            totalInvested == threshold,
            "PreSale did not reached to threashold"
        );
        icoToken.transferFrom(treasury, address(this), _icoTokenAmount);

        uint256 tokenBalance = investmentToken.balanceOf(address(this));
        require(tokenBalance > 0, "No tokens available for liquidity");
        uint256 deadline = block.timestamp + 15 minutes;

        // Create liquidity pool
        if (createUniswapPool) {
            icoToken.approve(uniswapRouterAddress, _icoTokenAmount);
            IUniswapV2Router02 router = IUniswapV2Router02(
                uniswapRouterAddress
            );
            investmentToken.approve(uniswapRouterAddress, tokenBalance);

            router.addLiquidity(
                address(investmentToken),
                address(icoToken),
                tokenBalance,
                _icoTokenAmount,
                0,
                0,
                address(this),
                deadline
            );

            pair = IUniswapV2Factory(router.factory()).getPair(
                address(investmentToken),
                address(icoToken)
            );

            isUniswapPair = true;
        } else {
            icoToken.approve(aerodromeRouterAddress, _icoTokenAmount);
            IAerodromeRouter router = IAerodromeRouter(aerodromeRouterAddress);
            investmentToken.approve(aerodromeRouterAddress, tokenBalance);

            router.addLiquidity(
                address(investmentToken),
                address(icoToken),
                false,
                tokenBalance,
                _icoTokenAmount,
                0,
                0,
                address(this),
                deadline
            );

            pair = router.poolFor(
                address(investmentToken),
                address(icoToken),
                false,
                router.defaultFactory()
            );

            // Don't need to change isUniswapPair as it's false by default
        }

        //  Lock the token in UNCX liquidty locker
        IERC20 pairToken = IERC20(pair);
        uint amountToVest = pairToken.balanceOf(address(this));
        pairToken.approve(address(UNCXLock), amountToVest);

        ITokenLock.LockParams[] memory _params = new ITokenLock.LockParams[](1);
        _params[0] = ITokenLock.LockParams(
            payable(address(this)), // Allowing this address to withdraw the locked tokens
            amountToVest, // The LP tokens that will be vested
            block.timestamp, // Starting time of Locking
            block.timestamp + 180 days, // Ending time of Locking, locking for 6 months
            address(this) // The smart contract address to control the Locking
        );

        lockId = UNCXLock.NONCE();

        UNCXLock.lock(pair, _params);

        emit LiquidityPoolCreated(pair, _icoTokenAmount, tokenBalance, lockId);
    }

    /**
     * @dev method to withdraw all the LP locked in UNCX and transfer it to Admin's wallet
     */
    function _withdraw() private {
        uint256 _amount = UNCXLock.getWithdrawableTokens(lockId);
        require(
            _amount > 0,
            "Withdraw is not available, update the unlock conditions"
        );

        UNCXLock.withdraw(lockId, _amount);
        IERC20 pairToken = IERC20(pair);
        uint pairs = pairToken.balanceOf(address(this));
        pairToken.transfer(msg.sender, pairs);
    }

    /**
     * @notice Allows admin withdraw all the LP locked in UNCX and transfer it to Admin's wallet if the lock duration is completed.
     */
    function withdraw() external onlyOwner {
        _withdraw();
    }

    /**
     * @notice Allows admin withdraw all the LP locked in UNCX and transfer it to Admin's wallet even if the lock duration is not completed.
     */
    function panicWithdraw() external onlyOwner {
        allowWithdraw = true;
        _withdraw();
    }

    /**
     * @notice Failsafe method for Admin to retrieve the ERC20 is transferred accedently to this contract. Not recomedded in the smart contract is being audited. 
     * @param _token ERC20 token
     * @param _amount amount that admin want to extract
     */
    function extractERC20(IERC20 _token, uint256 _amount) external onlyOwner {
        _token.transfer(msg.sender, _amount);
    }


    // -------------------------------------------------------------------------------------
    // User methods
    // -------------------------------------------------------------------------------------
    /**
     * @notice Allows user to invest in Presale. 
     *  The invested tokens will be locked in this smart contact and ICO tokens will be vested into Sablier for user's wallet.
     * @param amount Amount of WETH user want's to invest.
     */
    function invest(uint256 amount) external poolNotCreated {
        require(treasury != address(0), "Treasury not defined");
        require(amount > 0, "Invalid amount");
        require(totalInvested < threshold, "PreSale completed");

        // As the requirement does not clearly specify the logic of exceeding the threshold in single smart contract,
        // Current approach allows to invest the amount that reaches the threshold, rest won't be invested
        // Another approach could be to allow the last tranasction which exceeds the threshold and manage a flag
        if (totalInvested + amount > threshold) {
            amount = threshold - totalInvested;
        }

        investmentToken.transferFrom(msg.sender, address(this), amount);

        investments[msg.sender] += amount;
        totalInvested += amount;

        uint256 _icoReceived = amount * conversionRate;

        icoToken.transferFrom(treasury, address(this), _icoReceived);

        LockupLinear.CreateWithDurations memory params;
        params.sender = msg.sender; // The sender will be able to cancel the stream
        params.recipient = msg.sender; // The recipient of the streamed assets
        params.totalAmount = uint128(_icoReceived); // Total amount is the amount inclusive of all fees
        params.asset = icoToken; // The streaming asset
        params.cancelable = true; // Whether the stream will be cancelable or not
        params.durations = getDuration(amount);
        params.broker = broker; // Optional parameter for charging a fee

        uint256 streamId = sablierLinear.createWithDurations(params);

        emit Investment(msg.sender, amount, _icoReceived, streamId);
    }

    // -------------------------------------------------------------------------------------
    // Public read methods
    // -------------------------------------------------------------------------------------
    /**
     * @notice this method is an interface for UNCX condition, for immature withdrawls this condition method will be validated to return true from UNCX
     */
    function unlockTokens() external view returns (bool) {
        // Here goes the business logic for resticting withdrawls
        return allowWithdraw;
    }

    /**
     * @notice Get the pair address along with provider where the LP was created
     * @return DEX provider Uniswap or Aerodrome
     * @return Address of pair
     */
    function getPair() external view returns (string memory, address) {
        require(lockId != 0, "Pool not created yet");
        if (isUniswapPair) {
            return ("Uniswap V2", pair);
        } else {
            return ("Aerodrome V2", pair);
        }
    }
}
