// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @dev Rozhranie štandardu ERC-20 podľa EIP-20.
 */
interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/**
 * @title Tetrakis ($TTK)
 * @author Ivan Sabo (Basterix) [Ring 0 Sovereign]
 * @notice Natívny suverénny token ekosystému Trinity Omni-Core v11.2.0.
 * @dev Implementácia bez externých závislostí s fixným Hard Capom pripravená pre audit.
 */
contract TetrakisToken is IERC20 {
    string public constant name = "Tetrakis";
    string public constant symbol = "TTK";
    uint8 public constant decimals = 18;

    uint256 public constant HARD_CAP = 10_000_000 * 10**18; // Fixný strop: 10M TTK
    uint256 private _totalSupply;

    address public sovereignOwner; // Basterix Ring 0 peňaženka
    address public treasuryWorker;  // Cloudflare Worker #24 (Trinity Treasury)

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    event SovereignOwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TreasuryWorkerUpdated(address indexed previousWorker, address indexed newWorker);
    event TokensBurned(address indexed burner, uint256 amount);

    modifier onlySovereign() {
        require(msg.sender == sovereignOwner, "ERR_RING0_SOVEREIGN_ONLY");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == sovereignOwner || msg.sender == treasuryWorker, "ERR_UNAUTHORIZED_OPERATOR");
        _;
    }

    /**
     * @param _treasuryWorker Adresa Cloudflare Edge Workera #24 pre autonómne výplaty
     * @param _initialSupply Počiatočný objem tokenov vyrazený priamo pre Ring 0 Sovereigna
     */
    constructor(address _treasuryWorker, uint256 _initialSupply) {
        require(_initialSupply * 10**18 <= HARD_CAP, "ERR_EXCEEDS_HARD_CAP");
        sovereignOwner = msg.sender;
        treasuryWorker = _treasuryWorker;

        uint256 mintAmount = _initialSupply * 10**18;
        _totalSupply = mintAmount;
        _balances[msg.sender] = mintAmount;

        emit Transfer(address(0), msg.sender, mintAmount);
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 value) external override returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 value) external override returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= value, "ERR_INSUFFICIENT_ALLOWANCE");
            unchecked {
                _approve(from, msg.sender, currentAllowance - value);
            }
        }
        _transfer(from, to, value);
        return true;
    }

    /**
     * @notice Možnosť spáliť vlastné tokeny a permanentne znížiť celkovú ponuku
     */
    function burn(uint256 amount) external {
        require(_balances[msg.sender] >= amount, "ERR_INSUFFICIENT_BALANCE");
        unchecked {
            _balances[msg.sender] -= amount;
            _totalSupply -= amount;
        }
        emit TokensBurned(msg.sender, amount);
        emit Transfer(msg.sender, address(0), amount);
    }

    /**
     * @notice Dodatočný mint do výšky HARD_CAP – prísne viazaný na Ring 0
     */
    function mint(address to, uint256 amount) external onlySovereign {
        require(to != address(0), "ERR_MINT_TO_ZERO");
        require(_totalSupply + amount <= HARD_CAP, "ERR_CAP_EXCEEDED");

        _totalSupply += amount;
        _balances[to] += amount;

        emit Transfer(address(0), to, amount);
    }

    function updateTreasuryWorker(address _newWorker) external onlySovereign {
        require(_newWorker != address(0), "ERR_INVALID_ADDRESS");
        emit TreasuryWorkerUpdated(treasuryWorker, _newWorker);
        treasuryWorker = _newWorker;
    }

    function transferSovereignOwnership(address _newOwner) external onlySovereign {
        require(_newOwner != address(0), "ERR_INVALID_NEW_OWNER");
        emit SovereignOwnershipTransferred(sovereignOwner, _newOwner);
        sovereignOwner = _newOwner;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0), "ERR_TRANSFER_FROM_ZERO");
        require(to != address(0), "ERR_TRANSFER_TO_ZERO");
        require(_balances[from] >= value, "ERR_BALANCE_TOO_LOW");

        unchecked {
            _balances[from] -= value;
            _balances[to] += value;
        }

        emit Transfer(from, to, value);
    }

    function _approve(address owner, address spender, uint256 value) internal {
        require(owner != address(0), "ERR_APPROVE_FROM_ZERO");
        require(spender != address(0), "ERR_APPROVE_TO_ZERO");

        _allowances[owner][spender] = value;
        emit Approval(owner, spender, value);
    }
}
