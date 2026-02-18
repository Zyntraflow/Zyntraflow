// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract AccessPass1155 is ERC1155, Ownable {
    uint256 public immutable passTokenId;
    uint256 public price;

    event PassMinted(address indexed buyer, uint256 indexed tokenId, uint256 amount);

    constructor(string memory baseUri, uint256 initialPrice, uint256 tokenId)
        ERC1155(baseUri)
        Ownable(msg.sender)
    {
        passTokenId = tokenId;
        price = initialPrice;
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        price = newPrice;
    }

    function mint() external payable {
        require(msg.value >= price, "Insufficient payment");
        _mint(msg.sender, passTokenId, 1, "");
        emit PassMinted(msg.sender, passTokenId, 1);
    }

    function withdraw(address payable recipient) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        (bool success, ) = recipient.call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }
}
