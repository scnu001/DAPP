// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title TicketNFT —— 多活动 NFT 门票（COMP7610 Final Project）
/// @notice 主办方 createEvent 开票 / 参与者 claim 领票 / 主办方 closeEvent 闭场。
///         每个地址在每场活动最多领一张（由 claimed[eventId][addr] 强制）。
contract TicketNFT is ERC721, Ownable {
    struct EventInfo {
        string name;      // 活动名
        string baseURI;   // 该活动 metadata 基地址，tokenURI = baseURI + tokenId + ".json"
        uint64 startAt;   // 领取开始时间（0 = 立即开始）
        uint64 endAt;     // 领取结束时间（0 = 不限制）
        uint32 maxSupply; // 门票上限（> 0 即视为活动存在）
        uint32 minted;    // 已领取数量
        bool open;        // 是否开放（closeEvent 置 false）
        address organizer; // 主办方
    }

    uint256 public nextEventId = 1; // eventId 从 1 开始
    uint256 private _nextTokenId = 1; // tokenId 从 1 开始

    mapping(uint256 => EventInfo) private _events;
    mapping(uint256 => mapping(address => bool)) public claimed; // eventId => 地址 => 是否已领
    mapping(uint256 => mapping(address => uint256)) public ticketOf; // eventId => 地址 => tokenId(0=未持有)
    mapping(uint256 => uint256) private _eventOfToken; // tokenId => eventId

    /* ---------------------------------- 事件 ---------------------------------- */
    // 注意：一个事件最多 3 个 indexed；string 不加 indexed（否则存的是哈希，前端拿不回原文）
    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        string name,
        uint32 maxSupply,
        uint64 startAt,
        uint64 endAt
    );
    event TicketClaimed(uint256 indexed eventId, address indexed attendee, uint256 indexed tokenId);
    event EventClosed(uint256 indexed eventId, uint32 totalMinted);
    event EventURIUpdated(uint256 indexed eventId, string baseURI);

    // OZ v5：Ownable 必须显式传入 initialOwner
    constructor() ERC721("COMP7610 Ticket", "TKT") Ownable(msg.sender) {}

    /* --------------------------------- 写操作 --------------------------------- */

    /// @notice 创建新活动（仅合约 owner / 主办方）
    /// @dev 交易函数的返回值前端拿不到，新 eventId 只能从 EventCreated 事件解析
    function createEvent(
        string calldata name,
        string calldata baseURI,
        uint64 startAt,
        uint64 endAt,
        uint32 maxSupply
    ) external onlyOwner returns (uint256 eventId) {
        require(maxSupply > 0, "Ticket: zero supply");
        require(endAt == 0 || endAt > startAt, "Ticket: bad time range");

        eventId = nextEventId;
        nextEventId += 1;

        _events[eventId] = EventInfo({
            name: name,
            baseURI: baseURI,
            startAt: startAt,
            endAt: endAt,
            maxSupply: maxSupply,
            minted: 0,
            open: true,
            organizer: msg.sender
        });

        emit EventCreated(eventId, msg.sender, name, maxSupply, startAt, endAt);
    }

    /// @notice 领取门票，每个地址每场活动限一张
    function claim(uint256 eventId) external returns (uint256 tokenId) {
        EventInfo storage e = _events[eventId];
        require(e.maxSupply != 0, "Ticket: event not found"); // 用 maxSupply != 0 判断存在性，省一个 slot
        require(e.open, "Ticket: event closed");
        require(e.startAt <= block.timestamp, "Ticket: not started");
        require(e.endAt == 0 || block.timestamp <= e.endAt, "Ticket: event ended");
        require(e.minted < e.maxSupply, "Ticket: sold out");
        require(!claimed[eventId][msg.sender], "Ticket: already claimed");

        // CEI：先把状态落定，再做外部调用（_safeMint 会回调接收者的 onERC721Received）
        claimed[eventId][msg.sender] = true;
        tokenId = _nextTokenId;
        _nextTokenId += 1;
        _eventOfToken[tokenId] = eventId;
        ticketOf[eventId][msg.sender] = tokenId;
        e.minted += 1;

        _safeMint(msg.sender, tokenId);
        emit TicketClaimed(eventId, msg.sender, tokenId);
    }

    /// @notice 关闭活动，停止发放（主办方或 owner）
    function closeEvent(uint256 eventId) external {
        EventInfo storage e = _events[eventId];
        require(e.maxSupply != 0, "Ticket: event not found");
        require(e.organizer == msg.sender || msg.sender == owner(), "Ticket: not organizer");
        require(e.open, "Ticket: already closed");

        e.open = false;
        emit EventClosed(eventId, e.minted);
    }

    /// @notice 更新 metadata 基地址（先开票、后传 IPFS 的场景）
    function updateEventURI(uint256 eventId, string calldata baseURI) external {
        EventInfo storage e = _events[eventId];
        require(e.maxSupply != 0, "Ticket: event not found");
        require(e.organizer == msg.sender || msg.sender == owner(), "Ticket: not organizer");

        e.baseURI = baseURI;
        emit EventURIUpdated(eventId, baseURI);
    }

    /* --------------------------------- 读操作 --------------------------------- */

    /// @dev 名字不能叫 getEvent：Ethers v6 的 Contract 自带 getEvent() 方法，会撞名
    function getEventInfo(uint256 eventId) external view returns (EventInfo memory) {
        return _events[eventId];
    }

    function eventCount() external view returns (uint256) {
        return nextEventId - 1;
    }

    /// @notice 某地址在某场活动的门票 tokenId，0 表示未持有（前端一次调用即可判断"领没领"）
    function eventOfToken(uint256 tokenId) external view returns (uint256) {
        _requireOwned(tokenId); // OZ v5：token 不存在自动 revert
        return _eventOfToken[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory base = _events[_eventOfToken[tokenId]].baseURI;
        if (bytes(base).length == 0) return "";
        return string.concat(base, Strings.toString(tokenId), ".json");
    }
}
