// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Trinity Crypto Token (TRNT)
 * @notice Official ERC-20 cryptographic utility token for Trinity 10.3 Autonomous Ecosystem.
 * @dev Deployed on Polygon PoS / Base L2 for ultra-fast, zero-friction agent transactions,
 *      domain leasing, compute staking, and commerce checkout settlement.
 *
 * Owner: Basterix (Ivan Sabo)
 * Contact: saboivan2008@gmail.com / +421949009722
 * Master Genesis Address: 0x67397A1D122c14061706c83B0017689D7289B57a
 */

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract TrinityToken is IERC20 {
    string public constant name = "Trinity Neural Token";
    string public constant symbol = "TRNT";
    uint8 public constant decimals = 18;

    uint256 private _totalSupply;
    address public owner;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => uint256) public stakedBalances;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event DomainPaymentSettled(address indexed payer, string domainName, uint256 trntAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Trinity: caller is not the owner");
        _;
    }

    constructor() {
        owner = 0x67397A1D122c14061706c83B0017689D7289B57a;
        emit OwnershipTransferred(address(0), owner);

        // Genesis Supply: 100,000,000 TRNT
        uint256 initialSupply = 100_000_000 * 10**uint256(decimals);
        _totalSupply = initialSupply;
        _balances[owner] = initialSupply;
        emit Transfer(address(0), owner, initialSupply);
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address tokenOwner, address spender) external view override returns (uint256) {
        return _allowances[tokenOwner][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "TRNT: transfer amount exceeds allowance");
        unchecked {
            _approve(from, msg.sender, currentAllowance - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    function stake(uint256 amount) external {
        require(amount > 0, "TRNT: cannot stake 0");
        require(_balances[msg.sender] >= amount, "TRNT: insufficient balance to stake");

        _balances[msg.sender] -= amount;
        stakedBalances[msg.sender] += amount;
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        require(amount > 0, "TRNT: cannot unstake 0");
        require(stakedBalances[msg.sender] >= amount, "TRNT: insufficient staked balance");

        stakedBalances[msg.sender] -= amount;
        _balances[msg.sender] += amount;
        emit Unstaked(msg.sender, amount);
    }

    function payDomainLease(string calldata domainName, uint256 amount) external {
        require(amount > 0, "TRNT: payment must be greater than 0");
        _transfer(msg.sender, owner, amount);
        emit DomainPaymentSettled(msg.sender, domainName, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "TRNT: transfer from the zero address");
        require(to != address(0), "TRNT: transfer to the zero address");
        require(_balances[from] >= amount, "TRNT: transfer amount exceeds balance");

        unchecked {
            _balances[from] -= amount;
            _balances[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _approve(address tokenOwner, address spender, uint256 amount) internal {
        require(tokenOwner != address(0), "TRNT: approve from the zero address");
        require(spender != address(0), "TRNT: approve to the zero address");

        _allowances[tokenOwner][spender] = amount;
        emit Approval(tokenOwner, spender, amount);
    }
}
