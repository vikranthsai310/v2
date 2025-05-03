// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title GasOptimizedVotingSystem
 * @dev Ultra gas-efficient voting system with relayer/meta-vote support
 */
contract GasOptimizedVotingSystem is EIP712 {
    using ECDSA for bytes32;

    // Bitmap for storing votes (extremely gas efficient)
    mapping(uint256 => mapping(uint256 => uint256)) private voteMap;
    
    // Poll data structure (packed for gas savings)
    struct Poll {
        string title;
        address creator;
        uint64 endTime;
        uint16 candidateCount;
        bool isPublic;
        uint64 voterCount;
        uint64 maxVoters;
        uint8 whitelistMerkleDepth;
    }
    
    struct Candidate {
        string name;
        uint64 voteCount;
    }

    // Default relayer wallet & registry
    address public defaultRelayerWallet;
    mapping(address => bool) public authorizedRelayers;
    // relayer allowances: creator => relayer (or zero‐address) => amount
    mapping(address => mapping(address => uint256)) public relayerAllowance;

    // Poll and candidate storage
    Poll[] public polls;
    mapping(uint256 => mapping(uint16 => Candidate)) public candidates;
    mapping(uint256 => bytes32) public whitelistMerkleRoots;

    // EIP‑712 typehash for Vote
    bytes32 private constant VOTE_TYPEHASH =
        keccak256("Vote(uint256 pollId,uint16 candidateId,address voter)");

    event PollCreated(uint256 indexed pollId, address indexed creator);
    event Voted(uint256 indexed pollId, address indexed voter);
    event RelayerAdded(address indexed relayer, bool status);
    event DefaultRelayerUpdated(address indexed oldRelayer, address indexed newRelayer);

    constructor(address _defaultRelayerWallet)
        EIP712("GasOptimizedVotingSystem", "1")
    {
        require(_defaultRelayerWallet != address(0), "Invalid relayer");
        defaultRelayerWallet = _defaultRelayerWallet;
        authorizedRelayers[_defaultRelayerWallet] = true;
        emit RelayerAdded(_defaultRelayerWallet, true);
        emit DefaultRelayerUpdated(address(0), _defaultRelayerWallet);
    }

    /// @notice Create a new poll
    function createPoll(
        string calldata _title,
        string[] calldata _candidateNames,
        uint24 _durationHours,
        bool _isPublic,
        uint64 _maxVoters,
        bytes32 _merkleRoot,
        uint8 _merkleDepth
    ) external payable {
        require(_candidateNames.length > 0 && _candidateNames.length <= 100, "Invalid candidates");

        uint256 pollId = polls.length;
        polls.push(Poll({
            title: _title,
            creator: msg.sender,
            endTime: uint64(block.timestamp + _durationHours * 1 hours),
            candidateCount: uint16(_candidateNames.length),
            isPublic: _isPublic,
            voterCount: 0,
            maxVoters: _maxVoters,
            whitelistMerkleDepth: _isPublic ? 0 : _merkleDepth
        }));

        for (uint16 i = 0; i < _candidateNames.length; i++) {
            candidates[pollId][i] = Candidate({ name: _candidateNames[i], voteCount: 0 });
        }

        if (!_isPublic) {
            whitelistMerkleRoots[pollId] = _merkleRoot;
        }

        if (msg.value > 0) {
            relayerAllowance[msg.sender][address(0)] += msg.value;
        }

        emit PollCreated(pollId, msg.sender);
    }

    /// @notice Deposit funds for relayer reimbursements
    function depositFunds() external payable {
        require(msg.value > 0, "Send MATIC");
        relayerAllowance[msg.sender][address(0)] += msg.value;
    }

    /// @notice Allocate some of your general pool to a specific relayer
    function setRelayerAllowance(address _relayer, uint256 _amount) external {
        require(_relayer != address(0), "Invalid relayer");
        require(authorizedRelayers[_relayer], "Not authorized relayer");
        require(relayerAllowance[msg.sender][address(0)] >= _amount, "Insufficient funds");
        relayerAllowance[msg.sender][address(0)] -= _amount;
        relayerAllowance[msg.sender][_relayer] += _amount;
    }

    /// @notice Withdraw unused funds
    function withdrawFunds(uint256 _amount) external {
        require(relayerAllowance[msg.sender][address(0)] >= _amount, "Insufficient funds");
        relayerAllowance[msg.sender][address(0)] -= _amount;
        payable(msg.sender).transfer(_amount);
    }

    /// @notice Authorize or revoke a relayer (only default relayer)
    function setRelayerStatus(address _relayer, bool _status) external {
        require(msg.sender == defaultRelayerWallet, "Not default relayer");
        require(_relayer != address(0) && _relayer != defaultRelayerWallet, "Bad relayer");
        authorizedRelayers[_relayer] = _status;
        emit RelayerAdded(_relayer, _status);
    }

    /// @notice Change the default relayer (only current default)
    function updateDefaultRelayer(address _newDefault) external {
        require(msg.sender == defaultRelayerWallet, "Not default relayer");
        require(_newDefault != address(0) && _newDefault != defaultRelayerWallet, "Invalid new");
        address old = defaultRelayerWallet;
        defaultRelayerWallet = _newDefault;
        authorizedRelayers[_newDefault] = true;
        emit DefaultRelayerUpdated(old, _newDefault);
    }

    /// @notice Direct on‑chain vote (voter pays gas)
    function vote(uint256 _pollId, uint16 _candidateId) external {
        _processVote(_pollId, _candidateId, msg.sender);
    }

    /**
     * @notice Meta‑transaction vote: relayer pays gas, gets reimbursed
     * @param _pollId Poll to vote in
     * @param _candidateId Candidate index
     * @param _voter The voter's address
     * @param _merkleProof Proof if whitelist‑only
     * @param _signature EIP‑712 signature over (pollId, candidateId, voter)
     */
    function metaVote(
        uint256 _pollId,
        uint16 _candidateId,
        address _voter,
        bytes32[] calldata _merkleProof,
        bytes calldata _signature
    ) external {
        require(authorizedRelayers[msg.sender], "Relayer not authorized");
        Poll storage p = polls[_pollId];

        // Verify signature via EIP‐712
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                VOTE_TYPEHASH,
                _pollId,
                _candidateId,
                _voter
            ))
        );
        require(ECDSA.recover(digest, _signature) == _voter, "Bad signature");

        // Check relayer funds
        uint256 genPool = relayerAllowance[p.creator][address(0)];
        uint256 relPool = relayerAllowance[p.creator][msg.sender];
        require(genPool + relPool > 0, "Insufficient relayer funds");

        // Whitelist if needed
        if (!p.isPublic) {
            require(_verifyMerkleProof(_merkleProof, whitelistMerkleRoots[_pollId], _voter), "Not whitelisted");
        }

        // Process vote
        _processVote(_pollId, _candidateId, _voter);

        // Reimburse relayer: fixed 30k gas × gasprice
        uint256 reimbursement = 30000 * tx.gasprice;
        if (relPool >= reimbursement) {
            relayerAllowance[p.creator][msg.sender] -= reimbursement;
        } else {
            // use general pool
            relayerAllowance[p.creator][address(0)] -= reimbursement;
        }
        payable(msg.sender).transfer(reimbursement);
    }

    // ——— Internal Helpers ———

    function _processVote(uint256 _pollId, uint16 _candidateId, address _voter) internal {
        require(_pollId < polls.length, "Bad poll");
        Poll storage p = polls[_pollId];
        require(block.timestamp <= p.endTime, "Poll ended");
        require(_candidateId < p.candidateCount, "Bad candidate");
        require(p.voterCount < p.maxVoters, "Max voters reached");

        // Bitmap check
        uint256 word = uint256(uint160(_voter)) >> 8;      // /256
        uint256 bit  = uint256(uint160(_voter)) & 0xff;    // %256
        uint256 mask = 1 << bit;
        require((voteMap[_pollId][word] & mask) == 0, "Already voted");

        // Record
        voteMap[_pollId][word] |= mask;
        candidates[_pollId][_candidateId].voteCount++;
        p.voterCount++;

        emit Voted(_pollId, _voter);
    }

    function _verifyMerkleProof(
        bytes32[] calldata proof,
        bytes32 root,
        address leafAddr
    ) internal pure returns (bool) {
        bytes32 hash = keccak256(abi.encodePacked(leafAddr));
        for (uint i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            hash = hash <= p
                ? keccak256(abi.encodePacked(hash, p))
                : keccak256(abi.encodePacked(p, hash));
        }
        return hash == root;
    }

    // ——— Read‑only Views ———

    function getPollDetails(uint256 _pollId) external view returns (
        string memory title,
        address creator,
        uint64 endTime,
        uint16 candidateCount,
        bool isPublic,
        uint64 voterCount,
        uint64 maxVoters
    ) {
        require(_pollId < polls.length, "Bad poll");
        Poll storage p = polls[_pollId];
        return (p.title, p.creator, p.endTime, p.candidateCount, p.isPublic, p.voterCount, p.maxVoters);
    }

    function getCandidate(uint256 _pollId, uint16 _candidateId)
        external view returns (string memory name, uint64 voteCount)
    {
        require(_pollId < polls.length, "Bad poll");
        require(_candidateId < polls[_pollId].candidateCount, "Bad candidate");
        Candidate storage c = candidates[_pollId][_candidateId];
        return (c.name, c.voteCount);
    }

    function hasVoted(uint256 _pollId, address _voter) external view returns (bool) {
        uint256 word = uint256(uint160(_voter)) >> 8;
        uint256 bit  = uint256(uint160(_voter)) & 0xff;
        return (voteMap[_pollId][word] & (1 << bit)) != 0;
    }

    function getPollsCount() external view returns (uint256) {
        return polls.length;
    }

    function isAuthorizedRelayer(address _r) external view returns (bool) {
        return authorizedRelayers[_r];
    }
} 